import "server-only";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

/** Lead with no movement for this long gets a "Reminder task" when backfilling. */
export const LEAD_STALE_MS = 72 * 60 * 60 * 1000;

function endOfDayUtc(base: Date, addDays: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + addDays);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** New lead — call soon (next business day EOD UTC). */
export function dueDateCallLead(): Date {
  return endOfDayUtc(new Date(), 1);
}

/** Proposal / general follow-up — a few days out. */
export function dueDateFollowUp(): Date {
  return endOfDayUtc(new Date(), 3);
}

/** Reminder after delay — short horizon. */
export function dueDateReminder(): Date {
  return endOfDayUtc(new Date(), 1);
}

/** Default pipeline task due (legacy + non-specific stages). */
export function defaultTaskDueDate(): Date {
  return endOfDayUtc(new Date(), 3);
}

export function taskTitleCallLead(leadName: string): string {
  return `Call lead — ${leadName}`;
}

/** @deprecated Use taskTitleCallLead */
export function taskTitleNewLead(leadName: string): string {
  return taskTitleCallLead(leadName);
}

export function taskTitleProposalFollowUp(leadName: string): string {
  return `Follow-up — ${leadName}`;
}

export function taskTitleReminder(leadName: string): string {
  return `Reminder task — ${leadName}`;
}

/** Higher sorts first in default task lists. */
export function taskPriorityFromTitle(title: string): number {
  if (title.startsWith("Reminder task")) return 10;
  if (title.startsWith("Call lead")) return 8;
  if (title.startsWith("Follow-up") || title.startsWith("Follow up")) return 6;
  if (title.startsWith("Pipeline:")) return 5;
  if (title.startsWith("Next:")) return 5;
  return 5;
}

export function taskPriorityAfterStatusChange(newStatus: LeadStatus): number {
  if (newStatus === LeadStatus.PROPOSAL_SENT) return 7;
  return 5;
}

/**
 * Title for the next task after a pipeline move. No task for terminal statuses.
 */
export function taskTitleAfterStatusChange(
  leadName: string,
  newStatus: LeadStatus,
): string | null {
  if (newStatus === LeadStatus.WON || newStatus === LeadStatus.LOST) {
    return null;
  }
  if (newStatus === LeadStatus.PROPOSAL_SENT) {
    return taskTitleProposalFollowUp(leadName);
  }
  return `Pipeline: ${leadName} → ${leadStatusLabel(newStatus)}`;
}

export function isLeadStale(lead: { updatedAt: Date }): boolean {
  return Date.now() - lead.updatedAt.getTime() > LEAD_STALE_MS;
}

/**
 * Auto title for an open lead that currently has no pending task.
 */
export function autoTaskTitleForOpenLead(lead: {
  name: string;
  status: LeadStatus;
  updatedAt: Date;
}): string {
  if (isLeadStale(lead)) {
    return taskTitleReminder(lead.name);
  }
  if (lead.status === LeadStatus.PROPOSAL_SENT) {
    return taskTitleProposalFollowUp(lead.name);
  }
  if (
    lead.status === LeadStatus.NEW ||
    lead.status === LeadStatus.CONTACTED
  ) {
    return taskTitleCallLead(lead.name);
  }
  return `Next: ${lead.name} — ${leadStatusLabel(lead.status)}`;
}

export function dueDateForAutoTitle(title: string): Date {
  if (title.startsWith("Reminder task")) return dueDateReminder();
  if (title.startsWith("Follow-up")) return dueDateFollowUp();
  if (title.startsWith("Call lead")) return dueDateCallLead();
  return defaultTaskDueDate();
}

export async function createLeadTask(
  db: Pick<typeof prisma, "task">,
  input: {
    title: string;
    userId: string;
    leadId: string;
    companyId: string;
    dueDate: Date;
    priority?: number;
  },
) {
  await db.task.create({
    data: {
      title: input.title,
      userId: input.userId,
      leadId: input.leadId,
      companyId: input.companyId,
      dueDate: input.dueDate,
      status: TaskStatus.PENDING,
      priority: input.priority ?? taskPriorityFromTitle(input.title),
    },
  });
}

const CLOSED: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

/**
 * Ensure one pending task exists for a single open lead (e.g. after completing a task).
 */
export async function ensurePendingTaskForLead(
  companyId: string,
  leadId: string,
  fallbackUserId: string,
): Promise<boolean> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId, status: { notIn: CLOSED } },
    select: {
      id: true,
      name: true,
      status: true,
      assignedTo: true,
      updatedAt: true,
      companyId: true,
    },
  });
  if (!lead) return false;

  const pending = await prisma.task.count({
    where: { leadId: lead.id, companyId, status: TaskStatus.PENDING },
  });
  if (pending > 0) return false;

  const title = autoTaskTitleForOpenLead(lead);
  await prisma.task.create({
    data: {
      title,
      userId: lead.assignedTo ?? fallbackUserId,
      leadId: lead.id,
      companyId: lead.companyId,
      dueDate: dueDateForAutoTitle(title),
      status: TaskStatus.PENDING,
      priority: taskPriorityFromTitle(title),
    },
  });
  return true;
}

/**
 * For every open lead with no pending task, create one (keeps pipeline covered).
 */
export async function ensurePendingTasksForOpenLeads(
  companyId: string,
  fallbackUserId: string,
): Promise<number> {
  const openLeads = await prisma.lead.findMany({
    where: {
      companyId,
      status: { notIn: CLOSED },
    },
    select: {
      id: true,
      name: true,
      status: true,
      assignedTo: true,
      updatedAt: true,
      companyId: true,
    },
  });

  if (openLeads.length === 0) return 0;

  const leadIds = openLeads.map((l) => l.id);
  const grouped = await prisma.task.groupBy({
    by: ["leadId"],
    where: {
      leadId: { in: leadIds },
      companyId,
      status: TaskStatus.PENDING,
    },
    _count: { _all: true },
  });

  const hasPending = new Set(
    grouped.filter((g) => g.leadId !== null && g._count._all > 0).map((g) => g.leadId as string),
  );

  const toCreate = openLeads.filter((l) => !hasPending.has(l.id));
  if (toCreate.length === 0) return 0;

  await prisma.$transaction(
    toCreate.map((lead) => {
      const title = autoTaskTitleForOpenLead(lead);
      return prisma.task.create({
        data: {
          title,
          userId: lead.assignedTo ?? fallbackUserId,
          leadId: lead.id,
          companyId: lead.companyId,
          dueDate: dueDateForAutoTitle(title),
          status: TaskStatus.PENDING,
          priority: taskPriorityFromTitle(title),
        },
      });
    }),
  );

  return toCreate.length;
}

export function computeTaskOverdue(task: {
  status: TaskStatus;
  dueDate: Date | null;
}): boolean {
  if (task.status !== TaskStatus.PENDING || !task.dueDate) return false;
  return task.dueDate.getTime() < Date.now();
}
