import "server-only";

import { DealStatus, LeadStatus, TaskStatus } from "@prisma/client";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { leadStatusLabel, validateLeadStatusTransition } from "@/lib/lead-pipeline";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";
import {
  createLeadTask,
  defaultTaskDueDate,
  taskTitleStatusChange,
} from "@/lib/task-engine";

const assignInclude = {
  assignee: { select: { id: true, name: true, email: true } as const },
} as const;

export type LeadStatusChangeResult =
  | { ok: true; lead: ReturnType<typeof serializeLead> }
  | {
      ok: false;
      status: number;
      body: { ok: false; error: string; code: string };
    };

/**
 * Apply pipeline status change with activity + task engine. Optional assignee gate for ICECONNECT.
 */
export async function applyLeadStatusChange(input: {
  actorId: string;
  companyId: string;
  leadId: string;
  nextStatus: LeadStatus;
  /** If set, lead must be assigned to this user. */
  requireAssigneeUserId?: string;
}): Promise<LeadStatusChangeResult> {
  const { actorId, companyId, leadId, nextStatus, requireAssigneeUserId } = input;

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
    include: assignInclude,
  });

  if (!existing) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, error: "Lead not found", code: "NOT_FOUND" },
    };
  }

  if (requireAssigneeUserId !== undefined && existing.assignedTo !== requireAssigneeUserId) {
    return {
      ok: false,
      status: 403,
      body: { ok: false, error: "Not assigned to you", code: "FORBIDDEN" },
    };
  }

  const transition = validateLeadStatusTransition(existing.status, nextStatus);
  if (!transition.ok) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: transition.error, code: "INVALID_TRANSITION" },
    };
  }

  if (existing.status === nextStatus) {
    return { ok: true, lead: serializeLead(existing) };
  }

  const lead = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: { status: nextStatus },
      include: assignInclude,
    });

    await logActivity(tx, {
      companyId,
      userId: actorId,
      type: ACTIVITY_TYPES.LEAD_STATUS_CHANGED,
      message: `Lead "${updated.name}" (${updated.id}): ${leadStatusLabel(existing.status)} → ${leadStatusLabel(nextStatus)}`,
      metadata: {
        leadId: updated.id,
        leadName: updated.name,
        previousStatus: existing.status,
        nextStatus,
      },
    });

    if (nextStatus === LeadStatus.WON || nextStatus === LeadStatus.LOST) {
      const existingDeal = await tx.deal.findFirst({ where: { leadId: updated.id } });
      if (!existingDeal) {
        const won = nextStatus === LeadStatus.WON;
        const dealStatus = won ? DealStatus.WON : DealStatus.LOST;
        const dealValue = won ? (updated.value ?? 0) : 0;
        const deal = await tx.deal.create({
          data: {
            leadId: updated.id,
            value: dealValue,
            status: dealStatus,
          },
        });
        await logActivity(tx, {
          companyId,
          userId: actorId,
          type: ACTIVITY_TYPES.DEAL_CLOSED,
          message: won
            ? `Deal won: "${updated.name}" — value ${dealValue}`
            : `Deal lost: "${updated.name}"`,
          metadata: {
            leadId: updated.id,
            leadName: updated.name,
            dealId: deal.id,
            outcome: won ? "won" : "lost",
            value: dealValue,
          },
        });
      }
    }

    await tx.task.updateMany({
      where: { leadId: updated.id, status: TaskStatus.PENDING },
      data: { status: TaskStatus.COMPLETED },
    });

    const ownerId = updated.assignedTo ?? actorId;
    await createLeadTask(tx, {
      title: taskTitleStatusChange(updated.name, nextStatus),
      userId: ownerId,
      leadId: updated.id,
      dueDate: defaultTaskDueDate(),
    });

    return updated;
  });

  return { ok: true, lead: serializeLead(lead) };
}
