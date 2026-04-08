import "server-only";

import { TaskStatus, UserRole } from "@prisma/client";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { isPro } from "@/lib/plan-access";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { prisma } from "@/lib/prisma";
import {
  parseSalesBoosterFromDashboardConfig,
  type SalesBoosterOnLeadCreated,
} from "@/lib/sales-booster-config";

const ASSIGN_ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.SALES_HEAD,
  UserRole.ADMIN,
  UserRole.MANAGER,
];

export const SB_TASK_PREFIX = "Sales Booster:";

export function salesBoosterDayTitle(leadName: string, day: 1 | 3 | 5): string {
  return `${SB_TASK_PREFIX} Day ${day} reminder — ${leadName}`;
}

function dueEodDaysAfter(anchor: Date, addDays: number): Date {
  const d = new Date(anchor);
  d.setUTCDate(d.getUTCDate() + addDays);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

async function pendingTaskCounts(
  companyId: string,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const grouped = await prisma.task.groupBy({
    by: ["userId"],
    where: {
      companyId,
      status: TaskStatus.PENDING,
      userId: { in: userIds },
    },
    _count: { id: true },
  });
  const map = new Map<string, number>();
  for (const u of userIds) map.set(u, 0);
  for (const row of grouped) {
    if (row.userId) map.set(row.userId, row._count.id);
  }
  return map;
}

async function pickLightestSalesAssignee(
  companyId: string,
  fallbackUserId: string,
): Promise<string> {
  const memberships = await prisma.userCompany.findMany({
    where: { companyId, jobRole: { in: ASSIGN_ROLES } },
    select: { userId: true },
  });
  if (memberships.length === 0) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { ownerId: true },
    });
    return company?.ownerId ?? fallbackUserId;
  }
  const userIds = [...new Set(memberships.map((m) => m.userId))];
  const loads = await pendingTaskCounts(companyId, userIds);
  let bestId = userIds[0]!;
  let best = Number.POSITIVE_INFINITY;
  for (const uid of userIds) {
    const n = loads.get(uid) ?? 0;
    if (n < best || (n === best && uid < bestId)) {
      best = n;
      bestId = uid;
    }
  }
  return bestId;
}

async function migratePendingTasksToAssignee(
  companyId: string,
  leadId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  if (fromUserId === toUserId) return;
  await prisma.task.updateMany({
    where: {
      companyId,
      leadId,
      status: TaskStatus.PENDING,
      userId: fromUserId,
    },
    data: { userId: toUserId },
  });
}

async function ensureBoosterTask(args: {
  companyId: string;
  leadId: string;
  userId: string;
  title: string;
  dueDate: Date;
  priority: number;
  description?: string;
}): Promise<{ created: boolean; taskId: string }> {
  const existing = await prisma.task.findFirst({
    where: {
      companyId: args.companyId,
      leadId: args.leadId,
      status: TaskStatus.PENDING,
      title: args.title,
    },
    select: { id: true },
  });
  if (existing) {
    return { created: false, taskId: existing.id };
  }
  const t = await prisma.task.create({
    data: {
      title: args.title,
      description: args.description,
      companyId: args.companyId,
      leadId: args.leadId,
      userId: args.userId,
      status: TaskStatus.PENDING,
      dueDate: args.dueDate,
      priority: args.priority,
    },
  });
  return { created: true, taskId: t.id };
}

function modeRunsAssign(mode: SalesBoosterOnLeadCreated): boolean {
  return mode === "assign" || mode === "both";
}

function modeRunsWhatsapp(mode: SalesBoosterOnLeadCreated): boolean {
  return mode === "whatsapp" || mode === "both";
}

export type RunSalesBoosterOnLeadCreatedInput = {
  leadId: string;
  companyId: string;
  actorUserId: string;
  /** True when the client sent `assignedToUserId` on lead create. */
  assigneeExplicit: boolean;
  /** Assignee ID from the create transaction (before Nexa / booster migrations). */
  initialAssigneeId: string;
};

export type RunSalesBoosterOnLeadCreatedResult = {
  ran: boolean;
  mode: SalesBoosterOnLeadCreated;
  reassigned: boolean;
  assignedUserId: string | null;
  whatsappLogged: boolean;
  followUpTasksCreated: number;
};

/**
 * Sales Booster: on new lead (Pro+), optionally auto-assign, mock WhatsApp + activity log,
 * and schedule Day 1 / 3 / 5 reminder tasks (deduped by title).
 */
export async function runSalesBoosterOnLeadCreated(
  input: RunSalesBoosterOnLeadCreatedInput,
): Promise<RunSalesBoosterOnLeadCreatedResult> {
  const empty = (mode: SalesBoosterOnLeadCreated): RunSalesBoosterOnLeadCreatedResult => ({
    ran: false,
    mode,
    reassigned: false,
    assignedUserId: null,
    whatsappLogged: false,
    followUpTasksCreated: 0,
  });

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { plan: true, dashboardConfig: true },
  });

  const defaults = parseSalesBoosterFromDashboardConfig(company?.dashboardConfig);
  const mode = defaults.onLeadCreated;

  if (!company || isPlanLockedToBasic() || !isPro(company.plan)) {
    return empty(mode);
  }

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, companyId: input.companyId },
    select: {
      id: true,
      name: true,
      phone: true,
      assignedTo: true,
      createdAt: true,
    },
  });
  if (!lead) return empty(mode);

  let assignedUserId = lead.assignedTo ?? input.actorUserId;
  let reassigned = false;

  if (modeRunsAssign(mode) && !input.assigneeExplicit) {
    const picked = await pickLightestSalesAssignee(input.companyId, input.actorUserId);
    const prev = assignedUserId;
    if (picked !== prev) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { assignedTo: picked },
      });
      await migratePendingTasksToAssignee(input.companyId, lead.id, prev, picked);
      assignedUserId = picked;
      reassigned = true;
    }
  }

  let whatsappMessage: string | null = null;
  if (modeRunsWhatsapp(mode)) {
    const first = lead.name.trim().split(/\s+/)[0] ?? "there";
    whatsappMessage = `Hi ${first} — thanks for your interest in solar. We’ll keep you posted on next steps. Reply here anytime.`;
  }

  let followUpTasksCreated = 0;
  if (defaults.followUpScheduleEnabled) {
    const anchor = lead.createdAt;
    const schedule: Array<{ day: 1 | 3 | 5; priority: number }> = [
      { day: 1, priority: 7 },
      { day: 3, priority: 6 },
      { day: 5, priority: 6 },
    ];
    for (const { day, priority } of schedule) {
      const title = salesBoosterDayTitle(lead.name, day);
      const { created } = await ensureBoosterTask({
        companyId: input.companyId,
        leadId: lead.id,
        userId: assignedUserId,
        title,
        dueDate: dueEodDaysAfter(anchor, day),
        priority,
        description: `Sales Booster scheduled follow-up (day ${day}).`,
      });
      if (created) followUpTasksCreated += 1;
    }
  }

  const whatsappLogged = whatsappMessage !== null;
  if (reassigned || followUpTasksCreated > 0 || whatsappLogged) {
    const parts = [
      reassigned && "Auto-assigned to sales load balance",
      whatsappMessage && `[WhatsApp sim — Sales Booster] ${whatsappMessage}`,
      followUpTasksCreated > 0 && `${followUpTasksCreated} Day 1/3/5 reminder task(s)`,
    ].filter(Boolean);
    await logActivity(prisma, {
      companyId: input.companyId,
      userId: input.actorUserId,
      type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
      message: `Sales Booster: “${lead.name}” — ${parts.join(" · ")}`,
      metadata: {
        source: "sales_booster",
        leadId: lead.id,
        mode,
        reassigned,
        followUpTasksCreated,
        whatsappLogged,
        channel: whatsappLogged ? "whatsapp_simulated" : undefined,
        phoneLast4: whatsappLogged ? lead.phone.replace(/\D/g, "").slice(-4) || null : undefined,
      },
    });
  }

  return {
    ran: true,
    mode,
    reassigned,
    assignedUserId,
    whatsappLogged,
    followUpTasksCreated,
  };
}
