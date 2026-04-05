import "server-only";

import { LeadStatus, TaskStatus } from "@prisma/client";
import { leadStatusLabel } from "@/lib/lead-pipeline";
import { prisma } from "@/lib/prisma";

export function defaultTaskDueDate(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function taskTitleNewLead(leadName: string): string {
  return `Follow up: ${leadName} (new lead)`;
}

export function taskTitleStatusChange(leadName: string, newStatus: LeadStatus): string {
  return `Pipeline: ${leadName} → ${leadStatusLabel(newStatus)}`;
}

export function taskTitleCatchUp(leadName: string, currentStatus: LeadStatus): string {
  return `Follow up: ${leadName} (${leadStatusLabel(currentStatus)})`;
}

export async function createLeadTask(
  db: Pick<typeof prisma, "task">,
  input: {
    title: string;
    userId: string;
    leadId: string;
    dueDate: Date;
  },
) {
  await db.task.create({
    data: {
      title: input.title,
      userId: input.userId,
      leadId: input.leadId,
      dueDate: input.dueDate,
      status: TaskStatus.PENDING,
    },
  });
}

const CLOSED: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

/**
 * For every open lead in the company with no pending task, create one (core “no task → auto create”).
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
    select: { id: true, name: true, status: true, assignedTo: true },
  });

  if (openLeads.length === 0) return 0;

  const leadIds = openLeads.map((l) => l.id);
  const grouped = await prisma.task.groupBy({
    by: ["leadId"],
    where: {
      leadId: { in: leadIds },
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
    toCreate.map((lead) =>
      prisma.task.create({
        data: {
          title: taskTitleCatchUp(lead.name, lead.status),
          userId: lead.assignedTo ?? fallbackUserId,
          leadId: lead.id,
          dueDate: defaultTaskDueDate(),
          status: TaskStatus.PENDING,
        },
      }),
    ),
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
