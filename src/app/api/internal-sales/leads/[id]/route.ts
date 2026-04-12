import type { NextRequest } from "next/server";
import {
  InternalCallStatus,
  InternalOnboardingApprovalStatus,
  InternalSalesStage,
  InternalTechStage,
  LeadOnboardingType,
} from "@prisma/client";
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
import { onboardingUiStatus } from "@/lib/internal-sales-onboarding";
import { techMetroLabel } from "@/lib/internal-sales-metro";
import {
  resolveAdvanceSalesStage,
  validateSalesStageChange,
} from "@/lib/internal-sales-stage-mutations";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { findUserInCompany, getUserCompanyMembership } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const patchSchema = z
  .object({
    stage: z.nativeEnum(InternalSalesStage).optional(),
    advanceInternalSalesStage: z.literal(true).optional(),
    callStatus: z.nativeEnum(InternalCallStatus).optional(),
    notes: z.string().trim().max(5000).optional(),
    lastContactedAt: z.string().datetime().optional(),
    nextFollowUpAt: z.union([z.string().datetime(), z.null()]).optional(),
    assignedToUserId: z.union([z.string().cuid(), z.null()]).optional(),
    onboardingType: z.nativeEnum(LeadOnboardingType).nullable().optional(),
  })
  .refine((d) => !(d.stage !== undefined && d.advanceInternalSalesStage === true), {
    message: "Send either stage or advanceInternalSalesStage, not both",
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
    internalTechStage: InternalTechStage | null;
    internalOnboardingApprovalStatus: InternalOnboardingApprovalStatus | null;
    onboardingType: LeadOnboardingType | null;
    internalStageUpdatedAt: Date | null;
    lastContactedAt: Date | null;
    nextFollowUpAt: Date | null;
    assignedTo: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignee: { id: string; name: string; email: string } | null;
  },
) {
  const stage = lead.internalSalesStage ?? InternalSalesStage.LEAD_ADDED;
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
    internalTechStage: lead.internalTechStage,
    internalTechStageLabel: lead.internalTechStage
      ? techMetroLabel(lead.internalTechStage)
      : null,
    internalOnboardingApprovalStatus: lead.internalOnboardingApprovalStatus,
    internalStageUpdatedAt: lead.internalStageUpdatedAt?.toISOString() ?? null,
    pendingBossApproval:
      lead.internalSalesStage === InternalSalesStage.ONBOARDING_FORM_FILLED &&
      lead.internalOnboardingApprovalStatus === InternalOnboardingApprovalStatus.PENDING,
    onboardingType: lead.onboardingType ?? null,
  };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
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

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
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

  const lockedOnboardingTypeStages = new Set<InternalSalesStage>([
    InternalSalesStage.ONBOARDING_FORM_FILLED,
    InternalSalesStage.BOSS_APPROVAL_PENDING,
    InternalSalesStage.SENT_TO_TECH,
    InternalSalesStage.TECH_READY,
    InternalSalesStage.DELIVERED,
    InternalSalesStage.CLIENT_LIVE,
  ]);
  if (
    parsed.data.onboardingType !== undefined &&
    lead.internalSalesStage &&
    lockedOnboardingTypeStages.has(lead.internalSalesStage)
  ) {
    return jsonError(
      400,
      "LOCKED",
      "Cannot change onboarding type after the onboarding form or later milestones",
    );
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
        return jsonError(
          400,
          "INVALID_ASSIGNEE",
          "Lead can only be assigned to internal sales/tech roles",
        );
      }
      nextAssign = u.id;
    }
  }

  let targetStage: InternalSalesStage | undefined = parsed.data.stage;
  if (parsed.data.advanceInternalSalesStage === true) {
    const nextSt = resolveAdvanceSalesStage(lead);
    if (!nextSt) {
      return jsonError(
        400,
        "NO_ADVANCE",
        "Use the onboarding form, boss approval, or tech handover before advancing this stage",
      );
    }
    targetStage = nextSt;
  }

  if (targetStage !== undefined) {
    const v = validateSalesStageChange(session, lead, targetStage);
    if (v) {
      return jsonError(400, v.code, v.message);
    }
  }

  const data: Parameters<typeof prisma.lead.update>[0]["data"] = {
    ...(parsed.data.onboardingType !== undefined
      ? { onboardingType: parsed.data.onboardingType }
      : {}),
    ...(parsed.data.notes !== undefined ? { internalSalesNotes: parsed.data.notes || null } : {}),
    ...(parsed.data.callStatus !== undefined ? { internalCallStatus: parsed.data.callStatus } : {}),
    ...(targetStage !== undefined
      ? {
          internalSalesStage: targetStage,
          status: internalStageToLeadStatus(targetStage),
          internalStageUpdatedAt: new Date(),
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

  if (targetStage !== undefined && targetStage !== lead.internalSalesStage) {
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.STAGE,
      detail: `Pipeline: ${stageLabel(targetStage)}`,
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
  if (
    parsed.data.onboardingType !== undefined &&
    parsed.data.onboardingType !== lead.onboardingType
  ) {
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.STAGE,
      detail: `Onboarding type set: ${parsed.data.onboardingType ?? "cleared"}`,
      metadata: { onboardingType: parsed.data.onboardingType },
    });
  }

  return jsonSuccess({ lead: await serializeLeadFull(leadId, updated) });
}
