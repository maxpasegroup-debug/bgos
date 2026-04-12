import type { NextRequest } from "next/server";
import { InternalOnboardingApprovalStatus, InternalSalesStage } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
  internalStageToLeadStatus,
} from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { initialTechStage } from "@/lib/internal-sales-metro";
import { listInternalManagerUserIds, listInternalTechUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const bodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (!canManageInternalSalesAssignments(session)) {
    return jsonError(403, "FORBIDDEN", "Only a manager or admin can approve onboarding");
  }

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const { id: leadId } = await ctx.params;
  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: internalCtx.companyId },
    select: {
      id: true,
      name: true,
      assignedTo: true,
      internalSalesStage: true,
      internalOnboardingApprovalStatus: true,
    },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  if (
    lead.internalSalesStage !== InternalSalesStage.ONBOARDING_FORM_FILLED ||
    lead.internalOnboardingApprovalStatus !== InternalOnboardingApprovalStatus.PENDING
  ) {
    return jsonError(400, "NOT_PENDING", "No pending onboarding approval for this lead");
  }

  const now = new Date();

  if (parsed.data.decision === "reject") {
    await prisma.$transaction([
      prisma.onboardingTask.deleteMany({ where: { leadId } }),
      prisma.lead.update({
        where: { id: leadId },
        data: {
          internalSalesStage: InternalSalesStage.INTERESTED,
          internalOnboardingApprovalStatus: InternalOnboardingApprovalStatus.REJECTED,
          status: internalStageToLeadStatus(InternalSalesStage.INTERESTED),
          internalStageUpdatedAt: now,
        },
      }),
    ]);
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.STAGE,
      detail: "Boss rejected onboarding — returned to Interested",
    });
    const recipients = new Set<string>();
    if (lead.assignedTo) recipients.add(lead.assignedTo);
    const mgr = await listInternalManagerUserIds(internalCtx.companyId);
    for (const id of mgr) recipients.add(id);
    if (recipients.size > 0) {
      await notifyInternalUsers({
        companyId: internalCtx.companyId,
        userIds: [...recipients],
        type: "ONBOARDING_REJECTED",
        title: "Onboarding rejected",
        body: `${lead.name} — sent back to sales (review notes).`,
        dedupeKey: `onboarding-reject:${leadId}`,
      });
    }
    return jsonSuccess({ ok: true as const, decision: "reject" as const });
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      internalSalesStage: InternalSalesStage.SENT_TO_TECH,
      internalOnboardingApprovalStatus: InternalOnboardingApprovalStatus.APPROVED,
      internalTechStage: initialTechStage(),
      status: internalStageToLeadStatus(InternalSalesStage.SENT_TO_TECH),
      internalStageUpdatedAt: now,
    },
  });
  await logInternalLeadActivity({
    companyId: internalCtx.companyId,
    leadId,
    userId: session.sub,
    action: INTERNAL_ACTIVITY.STAGE,
    detail: "Boss approved onboarding — sent to tech",
  });

  const techIds = await listInternalTechUserIds(internalCtx.companyId);
  if (techIds.length > 0) {
    await notifyInternalUsers({
      companyId: internalCtx.companyId,
      userIds: techIds,
      type: "SENT_TO_TECH",
      title: "New tech onboarding",
      body: `${lead.name} — start delivery pipeline.`,
      dedupeKey: `sent-tech:${leadId}`,
    });
  }

  if (lead.assignedTo) {
    await notifyInternalUsers({
      companyId: internalCtx.companyId,
      userIds: [lead.assignedTo],
      type: "ONBOARDING_APPROVED",
      title: "Onboarding approved",
      body: `${lead.name} — handed to tech.`,
      dedupeKey: `onboarding-approved:${leadId}`,
    });
  }

  return jsonSuccess({ ok: true as const, decision: "approve" as const });
}
