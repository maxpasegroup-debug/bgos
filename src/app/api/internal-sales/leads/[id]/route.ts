import type { NextRequest } from "next/server";
import { InternalCallStatus, InternalSalesStage } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
  INTERNAL_CALL_LABELS,
  internalStageToLeadStatus,
  isInternalSalesAssignableRole,
  leadVisibilityFilter,
  stageLabel,
} from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { ensureOnboardingOnClosedWon, onboardingUiStatus } from "@/lib/internal-sales-onboarding";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, getUserCompanyMembership } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const patchSchema = z.object({
  stage: z.nativeEnum(InternalSalesStage).optional(),
  callStatus: z.nativeEnum(InternalCallStatus).optional(),
  notes: z.string().trim().max(5000).optional(),
  lastContactedAt: z.string().datetime().optional(),
  nextFollowUpAt: z.union([z.string().datetime(), z.null()]).optional(),
  assignedToUserId: z.union([z.string().cuid(), z.null()]).optional(),
});

async function serializeLeadFull(
  leadId: string,
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    leadCompanyName: string | null;
    businessType: string | null;
    internalSalesNotes: string | null;
    internalSalesStage: InternalSalesStage | null;
    internalCallStatus: InternalCallStatus | null;
    lastContactedAt: Date | null;
    nextFollowUpAt: Date | null;
    assignedTo: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignee: { id: string; name: string; email: string } | null;
  },
) {
  const stage = lead.internalSalesStage ?? InternalSalesStage.NEW_LEAD;
  const call = lead.internalCallStatus ?? InternalCallStatus.NOT_CALLED;
  const task = await prisma.onboardingTask.findUnique({
    where: { leadId },
    select: { id: true, status: true },
  });
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    companyName: lead.leadCompanyName,
    businessType: lead.businessType,
    notes: lead.internalSalesNotes,
    stage,
    stageLabel: stageLabel(stage),
    callStatus: call,
    callStatusLabel: INTERNAL_CALL_LABELS[call],
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    assignedTo: lead.assignedTo,
    assignee: lead.assignee,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    onboardingStatus: onboardingUiStatus(task),
    onboardingTaskId: task?.id ?? null,
    onboardingTaskStage: task?.status ?? null,
  };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const { id: leadId } = await ctx.params;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: internalCtx.companyId },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  const vis = leadVisibilityFilter(session);
  if ("assignedTo" in vis && lead.assignedTo !== session.sub) {
    return jsonError(403, "FORBIDDEN", "You can only view your own leads");
  }

  return jsonSuccess({ lead: await serializeLeadFull(leadId, lead) });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const { id: leadId } = await ctx.params;

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: internalCtx.companyId },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  const vis = leadVisibilityFilter(session);
  if ("assignedTo" in vis && lead.assignedTo !== session.sub) {
    return jsonError(403, "FORBIDDEN", "You can only update your own leads");
  }

  if (parsed.data.assignedToUserId !== undefined) {
    if (!canManageInternalSalesAssignments(session)) {
      return jsonError(403, "FORBIDDEN", "Only a manager can reassign");
    }
  }

  let nextAssign = lead.assignedTo;
  if (parsed.data.assignedToUserId !== undefined) {
    if (parsed.data.assignedToUserId === null) {
      nextAssign = null;
    } else {
      const u = await findUserInCompany(parsed.data.assignedToUserId, internalCtx.companyId);
      if (!u) return jsonError(404, "NOT_FOUND", "Team member not found");
      const mem = await getUserCompanyMembership(parsed.data.assignedToUserId, internalCtx.companyId);
      if (!mem || !isInternalSalesAssignableRole(mem.jobRole)) {
        return jsonError(400, "INVALID_ASSIGNEE", "Lead can only be assigned to sales manager, sales executive, or telecaller");
      }
      nextAssign = u.id;
    }
  }

  const data: Parameters<typeof prisma.lead.update>[0]["data"] = {
    ...(parsed.data.notes !== undefined ? { internalSalesNotes: parsed.data.notes || null } : {}),
    ...(parsed.data.callStatus !== undefined ? { internalCallStatus: parsed.data.callStatus } : {}),
    ...(parsed.data.stage !== undefined
      ? {
          internalSalesStage: parsed.data.stage,
          status: internalStageToLeadStatus(parsed.data.stage),
        }
      : {}),
    ...(parsed.data.lastContactedAt !== undefined
      ? { lastContactedAt: new Date(parsed.data.lastContactedAt) }
      : {}),
    ...(parsed.data.nextFollowUpAt !== undefined
      ? {
          nextFollowUpAt:
            parsed.data.nextFollowUpAt === null ? null : new Date(parsed.data.nextFollowUpAt),
        }
      : {}),
    ...(parsed.data.assignedToUserId !== undefined ? { assignedTo: nextAssign } : {}),
  };

  if (
    parsed.data.callStatus !== undefined &&
    parsed.data.callStatus !== InternalCallStatus.NOT_CALLED &&
    parsed.data.lastContactedAt === undefined
  ) {
    data.lastContactedAt = new Date();
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data,
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });

  if (parsed.data.stage !== undefined && parsed.data.stage !== lead.internalSalesStage) {
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.STAGE,
      detail: `Pipeline: ${stageLabel(parsed.data.stage)}`,
    });
  }
  if (parsed.data.callStatus !== undefined && parsed.data.callStatus !== lead.internalCallStatus) {
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.CALL,
      detail: `Call: ${INTERNAL_CALL_LABELS[parsed.data.callStatus]}`,
    });
  }
  if (parsed.data.notes !== undefined && (parsed.data.notes || "") !== (lead.internalSalesNotes ?? "")) {
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.NOTE,
      detail: "Notes updated",
    });
  }
  if (
    parsed.data.assignedToUserId !== undefined &&
    nextAssign !== lead.assignedTo
  ) {
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.ASSIGNED,
      detail: nextAssign ? `Assigned to team member` : "Unassigned",
      metadata: { assignedTo: nextAssign },
    });
    if (nextAssign) {
      await notifyInternalUsers({
        companyId: internalCtx.companyId,
        userIds: [nextAssign],
        type: "LEAD_ASSIGNED",
        title: "New lead assigned",
        body: `${updated.name} — check My Leads.`,
        dedupeKey: `assign:${leadId}:${nextAssign}`,
      });
    }
  }
  if (parsed.data.nextFollowUpAt !== undefined) {
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.FOLLOW_UP,
      detail:
        parsed.data.nextFollowUpAt === null
          ? "Follow-up date cleared"
          : `Next follow-up: ${parsed.data.nextFollowUpAt}`,
    });
  }

  if (parsed.data.stage === InternalSalesStage.CLOSED_WON) {
    await ensureOnboardingOnClosedWon({
      companyId: internalCtx.companyId,
      lead: updated,
      actorUserId: session.sub,
    });
  }

  return jsonSuccess({ lead: await serializeLeadFull(leadId, updated) });
}
