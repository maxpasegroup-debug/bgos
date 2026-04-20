import "server-only";

import { DealStatus, LeadResponseStatus, LeadStatus, TaskStatus } from "@prisma/client";
import { ACTIVITY_TYPES, logActivity } from "@/lib/activity-log";
import { leadStatusLabel, validateLeadStatusTransition } from "@/lib/lead-pipeline";
import { serializeLead } from "@/lib/lead-serialize";
import { prisma } from "@/lib/prisma";
import { runStageEnteredAutomations } from "@/lib/automation-execution";
import {
  createLeadTask,
  defaultTaskDueDate,
  dueDateFollowUp,
  taskPriorityAfterStatusChange,
  taskTitleAfterStatusChange,
} from "@/lib/task-engine";
import { findUserInCompany } from "@/lib/user-company";
import { touchCompanyUsageAfterLimitsOrPlanChange } from "@/lib/usage-metrics-engine";

const assignInclude = {
  assignee: { select: { id: true, name: true, email: true } as const },
} as const;

export type LeadUpdateResult =
  | { ok: true; lead: ReturnType<typeof serializeLead> }
  | {
      ok: false;
      status: number;
      body: { ok: false; error: string; code: string };
    };

export type LeadPipelineUpdateInput = {
  actorId: string;
  companyId: string;
  leadId: string;
  /** Omit to leave status unchanged. */
  nextStatus?: LeadStatus;
  /** `null` unassigns. Omit to leave assignee unchanged. */
  assignedToUserId?: string | null;
  /** If set, lead must currently be assigned to this user (ICECONNECT telecaller). */
  requireAssigneeUserId?: string;
};

/**
 * Update lead status and/or assignee in one transaction; logs LEAD_STATUS_CHANGED / LEAD_ASSIGNED.
 */
export async function applyLeadPipelineUpdate(
  input: LeadPipelineUpdateInput,
): Promise<LeadUpdateResult> {
  const { actorId, companyId, leadId, nextStatus, assignedToUserId, requireAssigneeUserId } =
    input;

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

  let resolvedAssigneeId: string | null | undefined;
  if (assignedToUserId !== undefined) {
    if (assignedToUserId === null) {
      resolvedAssigneeId = null;
    } else {
      const assigneeUser = await findUserInCompany(assignedToUserId, companyId);
      if (!assigneeUser) {
        return {
          ok: false,
          status: 404,
          body: {
            ok: false,
            error: "Assignee not found in your company",
            code: "ASSIGNEE_NOT_FOUND",
          },
        };
      }
      resolvedAssigneeId = assigneeUser.id;
    }
  }

  if (nextStatus !== undefined) {
    const transition = validateLeadStatusTransition(existing.status, nextStatus);
    if (!transition.ok) {
      return {
        ok: false,
        status: 400,
        body: { ok: false, error: transition.error, code: "INVALID_TRANSITION" },
      };
    }
  }

  const statusChanging =
    nextStatus !== undefined && existing.status !== nextStatus;
  const assigneeChanging =
    resolvedAssigneeId !== undefined && existing.assignedTo !== resolvedAssigneeId;

  if (!statusChanging && !assigneeChanging) {
    return { ok: true, lead: serializeLead(existing) };
  }

  const targetStatus = statusChanging ? nextStatus! : existing.status;

  const lead = await prisma.$transaction(async (tx) => {
    const updated: any = await tx.lead.update({
      where: { id: leadId },
      data: {
        ...(statusChanging ? { status: targetStatus } : {}),
        lastActivityAt: new Date(),
        activityCount: { increment: 1 },
        responseStatus: LeadResponseStatus.RESPONSIVE,
        currentStage: statusChanging ? targetStatus : existing.currentStage ?? existing.status,
        nextActionDue: new Date(Date.now() + 24 * 36e5),
        confidenceScore: Math.min(100, (existing.confidenceScore ?? 50) + (statusChanging ? 5 : 2)),
        nexaPriority: false,
        ...(assigneeChanging ? { assignedTo: resolvedAssigneeId as string | null } : {}),
      },
      include: assignInclude,
    });

    if (statusChanging) {
      await logActivity(tx, {
        companyId,
        userId: actorId,
        type: ACTIVITY_TYPES.LEAD_STATUS_CHANGED,
        message: `Lead "${updated.name}" (${updated.id}): ${leadStatusLabel(existing.status)} → ${leadStatusLabel(targetStatus)}`,
        metadata: {
          leadId: updated.id,
          leadName: updated.name,
          previousStatus: existing.status,
          nextStatus: targetStatus,
        },
      });
    }

    if (assigneeChanging) {
      const prevName = existing.assignee?.name ?? null;
      const nextName = updated.assignee?.name ?? null;
      await logActivity(tx, {
        companyId,
        userId: actorId,
        type: ACTIVITY_TYPES.LEAD_ASSIGNED,
        message: `Lead "${updated.name}" (${updated.id}): assignee ${prevName ?? "none"} → ${nextName ?? "unassigned"}`,
        metadata: {
          leadId: updated.id,
          leadName: updated.name,
          previousAssigneeId: existing.assignedTo,
          nextAssigneeId: resolvedAssigneeId,
        },
      });
    }

    if (statusChanging && (targetStatus === LeadStatus.WON || targetStatus === LeadStatus.LOST)) {
      const existingDeal = await tx.deal.findFirst({
        where: { leadId: updated.id, companyId },
      });
      if (!existingDeal) {
        const won = targetStatus === LeadStatus.WON;
        const dealStatus = won ? DealStatus.WON : DealStatus.LOST;
        const dealValue = won ? (updated.value ?? 0) : 0;
        const deal = await tx.deal.create({
          data: {
            leadId: updated.id,
            companyId,
            value: dealValue,
            status: dealStatus,
            stage: targetStatus,
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

        if (won) {
          // Solar automation: winning a deal creates (or refreshes) downstream execution records.
          await (tx as any).installation.upsert({
            where: {
              companyId_leadId: {
                companyId,
                leadId: updated.id,
              },
            },
            update: {
              status: "PENDING",
              notes: "Auto-created by Nexa after deal WON",
            },
            create: {
              companyId,
              leadId: updated.id,
              status: "PENDING",
              notes: "Auto-created by Nexa after deal WON",
            },
          });
          await (tx as any).project.upsert({
            where: {
              companyId_leadId: {
                companyId,
                leadId: updated.id,
              },
            },
            update: {
              status: "PLANNED",
              name: `${updated.name} - Solar project`,
            },
            create: {
              companyId,
              leadId: updated.id,
              status: "PLANNED",
              name: `${updated.name} - Solar project`,
              description: "Auto-created from deal WON",
            },
          });
        }
      }
    }

    if (statusChanging && targetStatus === LeadStatus.WON && updated.partnerId) {
      const existingCommission = await (tx as any).commission.findFirst({
        where: { companyId, leadId: updated.id },
        select: { id: true },
      });
      if (!existingCommission) {
        const baseValue = Number(updated.value ?? 0);
        const commissionAmount = Math.max(0, Math.round(baseValue * 0.02 * 100) / 100);
        if (commissionAmount > 0) {
          await (tx as any).commission.create({
            data: {
              companyId,
              partnerId: updated.partnerId,
              leadId: updated.id,
              amount: commissionAmount,
              type: "DIRECT",
              status: "PENDING",
            },
          });
        }
      }
    }

    if (statusChanging) {
      await tx.task.updateMany({
        where: { leadId: updated.id, companyId, status: TaskStatus.PENDING },
        data: { status: TaskStatus.COMPLETED },
      });

      const nextTitle = taskTitleAfterStatusChange(updated.name, targetStatus);
      if (nextTitle !== null) {
        const ownerId = updated.assignedTo ?? actorId;
        const due =
          targetStatus === LeadStatus.PROPOSAL_SENT
            ? dueDateFollowUp()
            : defaultTaskDueDate();
        await createLeadTask(tx, {
          title: nextTitle,
          userId: ownerId,
          leadId: updated.id,
          companyId,
          dueDate: due,
          priority: taskPriorityAfterStatusChange(targetStatus),
        });
      }

      if (targetStatus === LeadStatus.NEGOTIATION) {
        const ownerId = updated.assignedTo ?? actorId;
        const now = Date.now();
        await createLeadTask(tx, {
          title: `Call follow-up: ${updated.name}`,
          userId: ownerId,
          leadId: updated.id,
          companyId,
          dueDate: new Date(now + 2 * 36e5),
          priority: 3,
        });
        await createLeadTask(tx, {
          title: `Send message template: ${updated.name}`,
          userId: ownerId,
          leadId: updated.id,
          companyId,
          dueDate: new Date(now + 6 * 36e5),
          priority: 2,
        });
        await createLeadTask(tx, {
          title: `Reminder check-in: ${updated.name}`,
          userId: ownerId,
          leadId: updated.id,
          companyId,
          dueDate: new Date(now + 24 * 36e5),
          priority: 2,
        });
      }
    }

    if (statusChanging && targetStatus === LeadStatus.QUALIFIED && updated.assignedTo) {
      await (tx as any).siteVisit.upsert({
        where: {
          companyId_leadId: {
            companyId,
            leadId: updated.id,
          },
        },
        update: {
          assignedTo: updated.assignedTo,
          status: "SCHEDULED",
        },
        create: {
          companyId,
          leadId: updated.id,
          assignedTo: updated.assignedTo,
          status: "SCHEDULED",
        },
      });
    }

    if (assigneeChanging) {
      const taskOwner = updated.assignedTo ?? actorId;
      await tx.task.updateMany({
        where: { leadId: updated.id, companyId, status: TaskStatus.PENDING },
        data: { userId: taskOwner },
      });
    }

    return updated;
  });

  if (statusChanging) {
    await runStageEnteredAutomations(companyId, targetStatus, {
      id: lead.id,
      name: lead.name,
      companyId: lead.companyId,
      assignedTo: lead.assignedTo,
    });
  }
  void touchCompanyUsageAfterLimitsOrPlanChange(companyId).catch((e) => {
    console.error("[usage-metrics] failed after lead pipeline update", e);
  });

  return { ok: true, lead: serializeLead(lead) };
}

/** Status-only update (backward compatible). */
export async function applyLeadStatusChange(input: {
  actorId: string;
  companyId: string;
  leadId: string;
  nextStatus: LeadStatus;
  requireAssigneeUserId?: string;
}): Promise<LeadUpdateResult> {
  return applyLeadPipelineUpdate({
    ...input,
    assignedToUserId: undefined,
  });
}
