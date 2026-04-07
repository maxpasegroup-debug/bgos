import "server-only";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { createLeadTask, dueDateReminder, taskPriorityFromTitle } from "@/lib/task-engine";
import { prisma } from "@/lib/prisma";

export type NexaEngineInsight = {
  type: string;
  message: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  suggestedAction: string;
  actionKey: "fix_now" | "auto_handle";
};

export async function generateNexaInsights(companyId: string): Promise<NexaEngineInsight[]> {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  const [
    pendingFollowUps,
    unpaidInvoices,
    delayedInstallations,
    wonLeads,
    lostLeads,
    monthlyExpenses,
    prevMonthlyExpenses,
  ] = await Promise.all([
    prisma.task.count({ where: { companyId, status: TaskStatus.PENDING } }),
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
        createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
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

  if (pendingFollowUps > 0) {
    insights.push({
      type: "FOLLOW_UPS",
      message: `${pendingFollowUps} pending follow-ups need action.`,
      priority: pendingFollowUps > 10 ? "HIGH" : "MEDIUM",
      suggestedAction: "Assign and complete priority follow-up tasks.",
      actionKey: "fix_now",
    });
  }
  if (unpaidInvoices > 0) {
    insights.push({
      type: "UNPAID_INVOICES",
      message: `${unpaidInvoices} overdue unpaid invoice(s).`,
      priority: "HIGH",
      suggestedAction: "Trigger collection calls and payment reminder tasks.",
      actionKey: "auto_handle",
    });
  }
  if (delayedInstallations > 0) {
    insights.push({
      type: "DELAYED_INSTALLATIONS",
      message: `${delayedInstallations} installation(s) delayed.`,
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
  const now = new Date();
  const idleSince = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  let actions = 0;

  const idleLeads = await prisma.lead.findMany({
    where: {
      companyId,
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
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
      createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
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
