import "server-only";

import { LeadStatus, TaskStatus, UserRole, type Lead } from "@prisma/client";
import { isEnterprise, isPro } from "@/lib/plan-access";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { createLeadTask, dueDateCallLead, dueDateFollowUp, dueDateReminder, taskPriorityFromTitle } from "@/lib/task-engine";
import { prisma } from "@/lib/prisma";

// --- Tier + operational thresholds (single source for detectors + auto-actions) ---

export const NEXA_IDLE_LEAD_MS = 2 * 24 * 60 * 60 * 1000;
export const NEXA_DELAYED_INSTALL_MS = 7 * 24 * 60 * 60 * 1000;

const CLOSED: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

/** Roles considered for fair lead distribution (field-loaded first for Enterprise scoring). */
const ASSIGN_ROLES_PRO: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.SALES_HEAD,
  UserRole.ADMIN,
  UserRole.MANAGER,
];

const ASSIGN_ROLES_ENTERPRISE: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.SALES_HEAD,
];

// --- Insight types (scalable: add detectors without changing callers) ---

export type NexaEngineInsight = {
  type: string;
  message: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  suggestedAction: string;
  actionKey: "fix_now" | "auto_handle";
};

/** Structured signals returned from {@link detectOperationalSignals} and {@link handleNewLead}. */
export type NexaOperationalInsight = {
  kind: "idle_leads" | "pending_payments" | "overdue_payments" | "delays" | "pending_followups";
  count: number;
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
};

export type LeadAnalysis = {
  summary: string;
  score: number;
  flags: string[];
};

export type NexaHandleNewLeadInput = {
  leadId: string;
  companyId: string;
  actorUserId: string;
};

export type NexaHandleNewLeadResult = {
  handled: boolean;
  tier: "NONE" | "PRO" | "ENTERPRISE";
  analysis?: LeadAnalysis;
  assignedUserId: string | null;
  reassigned: boolean;
  taskIds: string[];
  whatsappSimulated: boolean;
  insights: NexaOperationalInsight[];
};

// --- Operational snapshot (shared queries) ---

export type NexaOperationalSnapshot = {
  now: Date;
  idleLeadCount: number;
  pendingInvoiceCount: number;
  overdueInvoiceCount: number;
  delayedInstallCount: number;
  pendingFollowUpTaskCount: number;
};

export async function getNexaOperationalSnapshot(
  companyId: string,
  now = new Date(),
): Promise<NexaOperationalSnapshot> {
  const idleSince = new Date(now.getTime() - NEXA_IDLE_LEAD_MS);
  const installStale = new Date(now.getTime() - NEXA_DELAYED_INSTALL_MS);

  const [
    idleLeadCount,
    pendingInvoiceCount,
    overdueInvoiceCount,
    delayedInstallCount,
    pendingFollowUpTaskCount,
  ] = await Promise.all([
    prisma.lead.count({
      where: {
        companyId,
        status: { notIn: CLOSED },
        updatedAt: { lt: idleSince },
      },
    }),
    prisma.invoice.count({
      where: { companyId, status: { not: "PAID" } },
    }),
    prisma.invoice.count({
      where: {
        companyId,
        status: { not: "PAID" },
        dueDate: { lt: now },
      },
    }),
    prisma.installation.count({
      where: {
        companyId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        createdAt: { lt: installStale },
      },
    }),
    prisma.task.count({
      where: { companyId, status: TaskStatus.PENDING },
    }),
  ]);

  return {
    now,
    idleLeadCount,
    pendingInvoiceCount,
    overdueInvoiceCount,
    delayedInstallCount,
    pendingFollowUpTaskCount,
  };
}

/** Map snapshot → portable insights (extensible: add rows as new `kind`s). */
export function snapshotToOperationalInsights(snapshot: NexaOperationalSnapshot): NexaOperationalInsight[] {
  const out: NexaOperationalInsight[] = [];

  if (snapshot.idleLeadCount > 0) {
    out.push({
      kind: "idle_leads",
      count: snapshot.idleLeadCount,
      message: `${snapshot.idleLeadCount} open lead(s) idle since last activity.`,
      severity: snapshot.idleLeadCount > 10 ? "HIGH" : "MEDIUM",
    });
  }

  if (snapshot.pendingInvoiceCount > 0) {
    out.push({
      kind: "pending_payments",
      count: snapshot.pendingInvoiceCount,
      message: `${snapshot.pendingInvoiceCount} invoice(s) awaiting payment.`,
      severity: snapshot.overdueInvoiceCount > 0 ? "MEDIUM" : "LOW",
    });
  }

  if (snapshot.overdueInvoiceCount > 0) {
    out.push({
      kind: "overdue_payments",
      count: snapshot.overdueInvoiceCount,
      message: `${snapshot.overdueInvoiceCount} overdue invoice(s) — collections risk.`,
      severity: "HIGH",
    });
  }

  if (snapshot.delayedInstallCount > 0) {
    out.push({
      kind: "delays",
      count: snapshot.delayedInstallCount,
      message: `${snapshot.delayedInstallCount} installation(s) stalled past SLA window.`,
      severity: "HIGH",
    });
  }

  if (snapshot.pendingFollowUpTaskCount > 0) {
    out.push({
      kind: "pending_followups",
      count: snapshot.pendingFollowUpTaskCount,
      message: `${snapshot.pendingFollowUpTaskCount} pending follow-up task(s) company-wide.`,
      severity: snapshot.pendingFollowUpTaskCount > 15 ? "HIGH" : "MEDIUM",
    });
  }

  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return out.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export async function detectOperationalSignals(companyId: string): Promise<NexaOperationalInsight[]> {
  const snap = await getNexaOperationalSnapshot(companyId);
  return snapshotToOperationalInsights(snap);
}

// --- Lead analysis (Pro path) ---

export function analyzeLead(lead: Pick<Lead, "name" | "phone" | "email" | "value" | "status" | "source">): LeadAnalysis {
  let score = 45;
  const flags: string[] = [];

  if (lead.phone?.trim()) {
    score += 20;
  } else {
    flags.push("missing_phone");
  }

  if (lead.email?.trim()) {
    score += 10;
    flags.push("has_email");
  }

  if (lead.value != null && lead.value > 0) {
    score += 15;
    flags.push("has_estimated_value");
  }

  if (lead.source?.trim()) {
    score += 5;
    flags.push("attributed_source");
  }

  if (lead.status !== LeadStatus.NEW) {
    score += 5;
  }

  score = Math.min(100, Math.max(0, score));

  const summary = `NEXA score ${score}/100 for “${lead.name}” (${lead.status}). ${flags.length ? flags.join(", ") : "Healthy intake payload"}.`;

  return { score, flags, summary };
}

// --- Assignee selection (load-aware, role-biased for Enterprise) ---

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

function enterpriseAssignScore(pending: number, role: UserRole): number {
  if (role === UserRole.SALES_EXECUTIVE || role === UserRole.TELECALLER) {
    return pending - 3;
  }
  if (role === UserRole.SALES_HEAD) {
    return pending - 1;
  }
  return pending;
}

async function pickAssigneeForCompany(
  companyId: string,
  fallbackUserId: string,
  roles: UserRole[],
  mode: "pro_fair" | "enterprise_best",
): Promise<string> {
  const memberships = await prisma.userCompany.findMany({
    where: { companyId, jobRole: { in: roles } },
    select: { userId: true, jobRole: true },
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
  const roleByUser = new Map(memberships.map((m) => [m.userId, m.jobRole] as const));

  let bestId = userIds[0]!;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const uid of userIds) {
    const pending = loads.get(uid) ?? 0;
    const role = roleByUser.get(uid) ?? UserRole.SALES_EXECUTIVE;
    const score =
      mode === "enterprise_best" ? enterpriseAssignScore(pending, role) : pending;
    if (score < bestScore || (score === bestScore && uid < bestId)) {
      bestScore = score;
      bestId = uid;
    }
  }

  return bestId;
}

// --- handleNewLead ---

/**
 * NEXA automation for a newly created lead: Pro vs Enterprise behaviors, plus current operational insights.
 *
 * - **PRO:** analyze lead, ensure assignee (fair load if unassigned), add NEXA follow-up task.
 * - **ENTERPRISE:** auto-assign best-fit sales user, simulate outbound WhatsApp intro, add NEXA tasks.
 * - **BASIC:** no mutation; still returns operational `insights` for dashboards.
 */
export async function handleNewLead(input: NexaHandleNewLeadInput): Promise<NexaHandleNewLeadResult> {
  const { leadId, companyId, actorUserId } = input;

  const [company, snapshot, lead] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
    getNexaOperationalSnapshot(companyId),
    prisma.lead.findFirst({
      where: { id: leadId, companyId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        value: true,
        status: true,
        source: true,
        assignedTo: true,
        companyId: true,
      },
    }),
  ]);

  const insights = snapshotToOperationalInsights(snapshot);

  const emptyResult = (tier: NexaHandleNewLeadResult["tier"]): NexaHandleNewLeadResult => ({
    handled: false,
    tier,
    assignedUserId: lead?.assignedTo ?? null,
    reassigned: false,
    taskIds: [],
    whatsappSimulated: false,
    insights,
  });

  if (!company || !lead) {
    return { ...emptyResult("NONE"), handled: false };
  }

  if (isPlanLockedToBasic() || !isPro(company.plan)) {
    return emptyResult("NONE");
  }

  const tier: "PRO" | "ENTERPRISE" = isEnterprise(company.plan) ? "ENTERPRISE" : "PRO";

  if (tier === "PRO") {
    const analysis = analyzeLead(lead);
    let assignedUserId = lead.assignedTo;
    let reassigned = false;

    if (!assignedUserId) {
      assignedUserId = await pickAssigneeForCompany(
        companyId,
        actorUserId,
        ASSIGN_ROLES_PRO,
        "pro_fair",
      );
      await prisma.lead.update({
        where: { id: lead.id },
        data: { assignedTo: assignedUserId },
      });
      reassigned = true;
    }

    const task = await prisma.task.create({
      data: {
        title: `NEXA [Pro]: Qualify & next step — ${lead.name}`,
        description: analysis.summary,
        companyId,
        leadId: lead.id,
        userId: assignedUserId,
        status: TaskStatus.PENDING,
        dueDate: dueDateFollowUp(),
        priority: Math.max(6, Math.round(analysis.score / 12)),
      },
    });

    await logActivity(prisma, {
      companyId,
      userId: actorUserId,
      type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
      message: `NEXA Pro: lead “${lead.name}” analyzed (${analysis.score}/100), task scheduled.`,
      metadata: {
        leadId: lead.id,
        nexaTier: "PRO",
        analysis,
        taskId: task.id,
        reassigned,
      },
    });

    return {
      handled: true,
      tier: "PRO",
      analysis,
      assignedUserId,
      reassigned,
      taskIds: [task.id],
      whatsappSimulated: false,
      insights,
    };
  }

  // ENTERPRISE
  const analysis = analyzeLead(lead);
  const bestId = await pickAssigneeForCompany(
    companyId,
    actorUserId,
    ASSIGN_ROLES_ENTERPRISE.length ? ASSIGN_ROLES_ENTERPRISE : ASSIGN_ROLES_PRO,
    "enterprise_best",
  );
  const reassigned = lead.assignedTo !== bestId;
  await prisma.lead.update({
    where: { id: lead.id },
    data: { assignedTo: bestId },
  });

  const firstName = lead.name.trim().split(/\s+/)[0] ?? "there";
  const waMessage = `Hi ${firstName}, thanks for your interest in our solar solutions — a specialist will reach you shortly at ${lead.phone}. Reply YES to confirm.`;
  await logActivity(prisma, {
    companyId,
    userId: null,
    type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
    message: `[WhatsApp sim — NEXA Enterprise] ${waMessage}`,
    metadata: {
      leadId: lead.id,
      channel: "whatsapp_simulated",
      source: "nexa_engine",
      tier: "ENTERPRISE",
    },
  });

  const tasks = await prisma.$transaction([
    prisma.task.create({
      data: {
        title: `NEXA [Ent]: First call — ${lead.name}`,
        companyId,
        leadId: lead.id,
        userId: bestId,
        status: TaskStatus.PENDING,
        dueDate: dueDateCallLead(),
        priority: taskPriorityFromTitle("Call lead"),
      },
    }),
    prisma.task.create({
      data: {
        title: `NEXA [Ent]: Confirm WhatsApp + qualify — ${lead.name}`,
        description: analysis.summary,
        companyId,
        leadId: lead.id,
        userId: bestId,
        status: TaskStatus.PENDING,
        dueDate: dueDateFollowUp(),
        priority: 7,
      },
    }),
  ]);

  await logActivity(prisma, {
    companyId,
    userId: actorUserId,
    type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
    message: `NEXA Enterprise: lead “${lead.name}” auto-assigned, WhatsApp intro simulated, 2 tasks created.`,
    metadata: {
      leadId: lead.id,
      nexaTier: "ENTERPRISE",
      assigneeId: bestId,
      taskIds: tasks.map((t) => t.id),
      reassigned,
    },
  });

  return {
    handled: true,
    tier: "ENTERPRISE",
    analysis,
    assignedUserId: bestId,
    reassigned,
    taskIds: tasks.map((t) => t.id),
    whatsappSimulated: true,
    insights,
  };
}

// --- Dashboard insights (rules + operational snapshot) ---

export async function generateNexaInsights(companyId: string): Promise<NexaEngineInsight[]> {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  const [snapshot, wonLeads, lostLeads, monthlyExpenses, prevMonthlyExpenses] = await Promise.all([
    getNexaOperationalSnapshot(companyId, now),
    prisma.lead.count({ where: { companyId, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { companyId, status: LeadStatus.LOST } }),
    prisma.expense.aggregate({
      where: { companyId, date: { gte: startMonth } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        companyId,
        date: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
          lt: startMonth,
        },
      },
      _sum: { amount: true },
    }),
  ]);

  const insights: NexaEngineInsight[] = [];

  if (snapshot.idleLeadCount > 0) {
    insights.push({
      type: "IDLE_LEADS",
      message: `${snapshot.idleLeadCount} open lead(s) without recent activity.`,
      priority: snapshot.idleLeadCount > 12 ? "HIGH" : "MEDIUM",
      suggestedAction: "Trigger NEXA auto-handle or reassign idle pipeline.",
      actionKey: "auto_handle",
    });
  }

  if (snapshot.pendingFollowUpTaskCount > 0) {
    insights.push({
      type: "FOLLOW_UPS",
      message: `${snapshot.pendingFollowUpTaskCount} pending follow-ups need action.`,
      priority: snapshot.pendingFollowUpTaskCount > 10 ? "HIGH" : "MEDIUM",
      suggestedAction: "Assign and complete priority follow-up tasks.",
      actionKey: "fix_now",
    });
  }

  if (snapshot.overdueInvoiceCount > 0) {
    insights.push({
      type: "UNPAID_INVOICES",
      message: `${snapshot.overdueInvoiceCount} overdue unpaid invoice(s).`,
      priority: "HIGH",
      suggestedAction: "Trigger collection calls and payment reminder tasks.",
      actionKey: "auto_handle",
    });
  } else if (snapshot.pendingInvoiceCount > 0) {
    insights.push({
      type: "PENDING_PAYMENTS",
      message: `${snapshot.pendingInvoiceCount} invoice(s) still awaiting payment.`,
      priority: "MEDIUM",
      suggestedAction: "Review upcoming dues and send friendly payment reminders.",
      actionKey: "fix_now",
    });
  }

  if (snapshot.delayedInstallCount > 0) {
    insights.push({
      type: "DELAYED_INSTALLATIONS",
      message: `${snapshot.delayedInstallCount} installation(s) delayed.`,
      priority: "HIGH",
      suggestedAction: "Escalate to operations and assign recovery tasks.",
      actionKey: "auto_handle",
    });
  }

  const closed = wonLeads + lostLeads;
  if (closed >= 5) {
    const winRate = wonLeads / closed;
    if (winRate < 0.2) {
      insights.push({
        type: "LOW_CONVERSION",
        message: `Low conversion rate (${Math.round(winRate * 100)}%).`,
        priority: "MEDIUM",
        suggestedAction: "Review lead qualification and strengthen follow-up scripts.",
        actionKey: "fix_now",
      });
    }
  }

  const cur = Number(monthlyExpenses._sum.amount ?? 0);
  const prev = Number(prevMonthlyExpenses._sum.amount ?? 0);
  if (cur > 0 && prev > 0 && cur > prev * 1.35) {
    insights.push({
      type: "HIGH_EXPENSES",
      message: `Expenses are up ${Math.round(((cur - prev) / prev) * 100)}% this month.`,
      priority: "MEDIUM",
      suggestedAction: "Audit categories and pause non-critical spending.",
      actionKey: "fix_now",
    });
  }

  return insights.sort((a, b) => {
    const w = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    return w[a.priority] - w[b.priority];
  });
}

export async function runNexaAutoActions(companyId: string, actorUserId: string): Promise<number> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true },
  });
  if (!company || isPlanLockedToBasic() || !isPro(company.plan)) return 0;

  const now = new Date();
  const idleSince = new Date(now.getTime() - NEXA_IDLE_LEAD_MS);
  let actions = 0;

  const idleLeads = await prisma.lead.findMany({
    where: {
      companyId,
      status: { notIn: CLOSED },
      updatedAt: { lt: idleSince },
    },
    select: { id: true, name: true, assignedTo: true, companyId: true },
    take: 50,
  });

  for (const lead of idleLeads) {
    const exists = await prisma.task.findFirst({
      where: {
        companyId,
        leadId: lead.id,
        status: TaskStatus.PENDING,
        title: { startsWith: "NEXA: Lead idle" },
      },
      select: { id: true },
    });
    if (exists) continue;
    await createLeadTask(prisma, {
      title: `NEXA: Lead idle > 2 days — ${lead.name}`,
      userId: lead.assignedTo ?? actorUserId,
      leadId: lead.id,
      companyId: lead.companyId,
      dueDate: dueDateReminder(),
      priority: taskPriorityFromTitle("Reminder task"),
    });
    actions += 1;
  }

  const overdueInvoices = await prisma.invoice.findMany({
    where: { companyId, status: { not: "PAID" }, dueDate: { lt: now } },
    select: { id: true, leadId: true, invoiceNumber: true },
    take: 50,
  });
  for (const inv of overdueInvoices) {
    if (!inv.leadId) continue;
    const exists = await prisma.task.findFirst({
      where: {
        companyId,
        leadId: inv.leadId,
        status: TaskStatus.PENDING,
        title: { startsWith: "NEXA: Overdue invoice" },
      },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.task.create({
      data: {
        title: `NEXA: Overdue invoice follow-up — ${inv.invoiceNumber}`,
        companyId,
        leadId: inv.leadId,
        userId: actorUserId,
        status: TaskStatus.PENDING,
        dueDate: dueDateReminder(),
        priority: 9,
      },
    });
    actions += 1;
  }

  const delayedInstalls = await prisma.installation.findMany({
    where: {
      companyId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      createdAt: { lt: new Date(now.getTime() - NEXA_DELAYED_INSTALL_MS) },
      leadId: { not: null },
    },
    select: { id: true, leadId: true },
    take: 50,
  });
  for (const inst of delayedInstalls) {
    if (!inst.leadId) continue;
    const exists = await prisma.task.findFirst({
      where: {
        companyId,
        leadId: inst.leadId,
        status: TaskStatus.PENDING,
        title: { startsWith: "NEXA: Installation delayed" },
      },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.task.create({
      data: {
        title: "NEXA: Installation delayed — ops escalation",
        companyId,
        leadId: inst.leadId,
        userId: actorUserId,
        status: TaskStatus.PENDING,
        dueDate: dueDateReminder(),
        priority: 10,
      },
    });
    const existingAlert = await prisma.nexaAction.findFirst({
      where: {
        companyId,
        event: "INSTALLATION_DELAY_ALERT",
        target: inst.id,
        status: "OPEN",
      },
      select: { id: true },
    });
    if (!existingAlert) {
      await prisma.nexaAction.create({
        data: {
          type: "ALERT",
          event: "INSTALLATION_DELAY_ALERT",
          target: inst.id,
          status: "OPEN",
          message: "Installation delay detected — ops escalation required.",
          companyId,
          actorUserId,
          metadata: { installationId: inst.id, leadId: inst.leadId },
        },
      });
    }
    actions += 1;
  }

  if (actions > 0) {
    await logActivity(prisma, {
      companyId,
      userId: actorUserId,
      type: ACTIVITY_TYPES.AUTOMATION_SIMULATED,
      message: `NEXA auto-actions generated ${actions} task(s).`,
      metadata: { actions },
    });
  }

  return actions;
}
