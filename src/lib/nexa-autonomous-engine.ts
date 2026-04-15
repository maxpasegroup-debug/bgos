import "server-only";

import { LeadStatus, TaskStatus, UserRole } from "@prisma/client";
import { logActivity, ACTIVITY_TYPES } from "@/lib/activity-log";
import { parseAutomationCenterFromDashboardConfig } from "@/lib/automation-center-config";
import { prisma } from "@/lib/prisma";
import { dueDateReminder } from "@/lib/task-engine";

type NexaEvent = "lead_created" | "lead_idle" | "onboarding_completed" | "employee_inactive";
type NexaActionStatus = "DONE" | "FAILED" | "SKIPPED";

async function loadSettings(companyId: string) {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { dashboardConfig: true, subscriptionStatus: true },
  });
  return {
    settings: parseAutomationCenterFromDashboardConfig(row?.dashboardConfig),
    subscriptionStatus: row?.subscriptionStatus ?? null,
  };
}

async function createNexaAction(input: {
  companyId: string;
  actorUserId?: string | null;
  type: string;
  event: NexaEvent;
  target: string;
  status: NexaActionStatus;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.nexaAction.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      event: input.event,
      target: input.target,
      status: input.status,
      message: input.message,
      ...(input.metadata ? { metadata: input.metadata as object } : {}),
    },
  });
}

async function autoAssignLead(companyId: string, leadId: string, actorUserId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, assignedTo: true, companyId: true },
  });
  if (!lead || lead.companyId !== companyId) return;

  const members = await prisma.userCompany.findMany({
    where: {
      companyId,
      jobRole: { in: [UserRole.SALES_EXECUTIVE, UserRole.TELECALLER, UserRole.SALES_HEAD, UserRole.MANAGER] },
      user: { isActive: true },
    },
    select: { userId: true, jobRole: true, user: { select: { lastLogin: true } } },
  });
  if (members.length === 0) return;

  const ids = members.map((m) => m.userId);
  const [pendingTasks, openLeads, wonLeads] = await Promise.all([
    prisma.task.groupBy({
      by: ["userId"],
      where: { companyId, status: TaskStatus.PENDING, userId: { in: ids } },
      _count: { id: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { companyId, assignedTo: { in: ids }, status: { notIn: [LeadStatus.WON, LeadStatus.LOST] } },
      _count: { id: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { companyId, assignedTo: { in: ids }, status: LeadStatus.WON },
      _count: { id: true },
    }),
  ]);
  const pendingMap = new Map(pendingTasks.filter((x) => x.userId).map((x) => [x.userId as string, x._count.id]));
  const openMap = new Map(openLeads.filter((x) => x.assignedTo).map((x) => [x.assignedTo as string, x._count.id]));
  const wonMap = new Map(wonLeads.filter((x) => x.assignedTo).map((x) => [x.assignedTo as string, x._count.id]));

  const ranked = members
    .map((m) => {
      const pending = pendingMap.get(m.userId) ?? 0;
      const open = openMap.get(m.userId) ?? 0;
      const won = wonMap.get(m.userId) ?? 0;
      const activeBonus = m.user.lastLogin && Date.now() - m.user.lastLogin.getTime() < 2 * 86400000 ? 10 : 0;
      const perf = won * 2 + activeBonus;
      return { userId: m.userId, score: pending + open - perf };
    })
    .sort((a, b) => a.score - b.score);

  const best = ranked[0]?.userId;
  if (!best || best === lead.assignedTo) return;

  await prisma.lead.update({ where: { id: lead.id }, data: { assignedTo: best } });
  await prisma.task.updateMany({
    where: { companyId, leadId: lead.id, status: TaskStatus.PENDING },
    data: { userId: best },
  });
  const message = `I assigned lead ${lead.name} to a lower workload rep.`;
  await createNexaAction({
    companyId,
    actorUserId,
    type: "ASSIGN_LEAD",
    event: "lead_created",
    target: best,
    status: "DONE",
    message,
    metadata: { leadId: lead.id },
  });
  await logActivity(prisma, {
    companyId,
    userId: actorUserId,
    type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
    message: `Nexa assigned lead "${lead.name}" to team member ${best}.`,
    metadata: { leadId: lead.id, targetUserId: best },
  });
}

async function createLeadIdleReminders(companyId: string, actorUserId: string) {
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
  const idle = await prisma.lead.findMany({
    where: {
      companyId,
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      updatedAt: { lt: twoDaysAgo },
      assignedTo: { not: null },
    },
    select: { id: true, name: true, assignedTo: true },
    take: 20,
  });
  let created = 0;
  for (const lead of idle) {
    const exists = await prisma.task.findFirst({
      where: {
        companyId,
        leadId: lead.id,
        status: TaskStatus.PENDING,
        title: { startsWith: "NEXA: Follow up today" },
      },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.task.create({
      data: {
        companyId,
        userId: lead.assignedTo,
        leadId: lead.id,
        title: `NEXA: Follow up today — ${lead.name}`,
        description: "Lead is idle for 2+ days.",
        dueDate: dueDateReminder(),
        status: TaskStatus.PENDING,
        priority: 8,
      },
    });
    created += 1;
  }
  if (created > 0) {
    await createNexaAction({
      companyId,
      actorUserId,
      type: "CREATE_REMINDER",
      event: "lead_idle",
      target: `leads:${created}`,
      status: "DONE",
      message: `I created ${created} follow-up reminders for idle leads.`,
    });
  }
}

async function createOnboardingTasks(companyId: string, actorUserId: string) {
  const members = await prisma.userCompany.findMany({
    where: { companyId, user: { isActive: true } },
    select: { userId: true, jobRole: true },
  });
  let created = 0;
  for (const m of members) {
    if (m.jobRole === UserRole.ADMIN) continue;
    await prisma.task.create({
      data: {
        companyId,
        userId: m.userId,
        title: "NEXA: Start your first task",
        description: "Onboarding is complete. Start work now.",
        status: TaskStatus.PENDING,
        dueDate: dueDateReminder(),
        priority: 6,
      },
    });
    created += 1;
  }
  await createNexaAction({
    companyId,
    actorUserId,
    type: "CREATE_TASKS",
    event: "onboarding_completed",
    target: `team:${created}`,
    status: "DONE",
    message: `I created ${created} kickoff tasks for your team.`,
  });
}

async function triggerInactivityAlert(companyId: string, actorUserId: string) {
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
  const inactive = await prisma.userCompany.count({
    where: {
      companyId,
      user: { isActive: true, lastLogin: { lt: twoDaysAgo } },
    },
  });
  if (inactive <= 0) return;
  await createNexaAction({
    companyId,
    actorUserId,
    type: "INACTIVITY_ALERT",
    event: "employee_inactive",
    target: `inactive:${inactive}`,
    status: "DONE",
    message: `I flagged ${inactive} inactive team members for follow-up.`,
  });
}

async function createUpgradeSuggestion(companyId: string, actorUserId: string, onboardingWeekCount: number, hasSubscription: boolean) {
  if (onboardingWeekCount < 3 || hasSubscription) return;
  await createNexaAction({
    companyId,
    actorUserId,
    type: "UPGRADE_SUGGESTION",
    event: "employee_inactive",
    target: "company",
    status: "DONE",
    message: "You're ready to scale. Upgrade to Pro.",
  });
}

export async function runNexaAutonomousEvent(input: {
  companyId: string;
  actorUserId: string;
  event: NexaEvent;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { settings, subscriptionStatus } = await loadSettings(input.companyId);
  if (!settings.enabled || settings.autonomyLevel !== "LEVEL_2") {
    await createNexaAction({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      type: "AUTONOMY_GATE",
      event: input.event,
      target: "company",
      status: "SKIPPED",
      message: "Nexa autonomy is off or not in Level 2.",
    });
    return;
  }

  try {
    if (input.event === "lead_created" && settings.autoAssignLeads) {
      const leadId = String(input.payload?.leadId ?? "");
      if (leadId) await autoAssignLead(input.companyId, leadId, input.actorUserId);
    }
    if (input.event === "lead_idle" && settings.autoReminders) {
      await createLeadIdleReminders(input.companyId, input.actorUserId);
    }
    if (input.event === "onboarding_completed" && settings.autoTaskCreation) {
      await createOnboardingTasks(input.companyId, input.actorUserId);
    }
    if (input.event === "employee_inactive" && settings.autoInactivityAlerts) {
      await triggerInactivityAlert(input.companyId, input.actorUserId);
    }
    if (settings.autoUpgradeSuggestions) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const count = await prisma.onboarding.count({
        where: { companyId: input.companyId, status: "COMPLETED", createdAt: { gte: weekStart } },
      });
      const hasSubscription = subscriptionStatus === "ACTIVE" || subscriptionStatus === "TRIAL";
      await createUpgradeSuggestion(input.companyId, input.actorUserId, count, hasSubscription);
    }
  } catch (error) {
    await createNexaAction({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      type: "EVENT_FAILURE",
      event: input.event,
      target: "company",
      status: "FAILED",
      message: "Something didn't go through. Please retry.",
      metadata: { error: error instanceof Error ? error.message : "Unknown" },
    });
    throw error;
  }
}
