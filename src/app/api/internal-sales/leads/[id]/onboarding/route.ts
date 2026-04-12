import type { NextRequest } from "next/server";
import { InternalOnboardingApprovalStatus, InternalSalesStage } from "@prisma/client";
import { jsonError, jsonSuccess, parseJsonBody } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
  internalStageToLeadStatus,
} from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { createOnboardingTaskForLead } from "@/lib/internal-sales-onboarding";
import {
  formPayloadFromSubmit,
  internalOnboardingSubmitSchema,
  leadTypeMatchesTier,
  prismaOnboardingTypeFromTier,
  snapshotFromSubmit,
} from "@/lib/internal-onboarding-form";
import { listInternalManagerUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { getBgosBossEmail } from "@/lib/super-boss";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    select: {
      id: true,
      name: true,
      assignedTo: true,
      internalSalesStage: true,
      onboardingType: true,
    },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  if (lead.internalSalesStage !== InternalSalesStage.INTERESTED) {
    return jsonError(400, "INVALID_STAGE", "Onboarding form is only available when the lead is Interested");
  }

  if (!lead.onboardingType) {
    return jsonError(
      400,
      "ONBOARDING_TYPE_REQUIRED",
      "Sales must select Basic / Pro / Enterprise before opening the onboarding form",
    );
  }

  const isManager = canManageInternalSalesAssignments(session);
  if (!isManager && lead.assignedTo !== session.sub) {
    return jsonError(403, "FORBIDDEN", "Only your leads or a manager can submit onboarding");
  }
  if (!isManager && lead.assignedTo === null) {
    return jsonError(403, "FORBIDDEN", "Assign this lead first or ask a manager");
  }

  const existing = await prisma.onboardingTask.findUnique({ where: { leadId } });
  if (existing) return jsonError(409, "DUPLICATE", "Onboarding already started for this lead");

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = internalOnboardingSubmitSchema.safeParse(raw.data);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION", "All fields are required", { issues: parsed.error.flatten() });
  }

  const body = parsed.data;
  if (!leadTypeMatchesTier(lead.onboardingType, body.tier)) {
    return jsonError(400, "TIER_MISMATCH", "Submitted form does not match the onboarding type set on this lead");
  }

  let requirements = body.requirements;
  if (body.tier === "pro") {
    requirements = `${requirements}\n\n[Sales Booster / Pro: WhatsApp, social channels, automation needs captured.]`;
  }

  const snap = snapshotFromSubmit(body);
  snap.requirements = requirements;
  const formPayload = formPayloadFromSubmit(body);

  const now = new Date();

  const task = await createOnboardingTaskForLead({
    companyId: internalCtx.companyId,
    leadId,
    createdByUserId: session.sub,
    snapshot: snap,
    closeWon: false,
    leadOnboardingType: prismaOnboardingTypeFromTier(body.tier),
    formPayload,
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      internalSalesStage: InternalSalesStage.ONBOARDING_FORM_FILLED,
      internalOnboardingApprovalStatus: InternalOnboardingApprovalStatus.PENDING,
      status: internalStageToLeadStatus(InternalSalesStage.ONBOARDING_FORM_FILLED),
      internalStageUpdatedAt: now,
      leadCompanyName: body.companyName.trim(),
      email: body.email.trim(),
    },
  });

  await logInternalLeadActivity({
    companyId: internalCtx.companyId,
    leadId,
    userId: session.sub,
    action: INTERNAL_ACTIVITY.STAGE,
    detail: "Onboarding form submitted — awaiting boss approval",
    metadata: { onboardingTaskId: task.id, onboardingType: lead.onboardingType },
  });

  const recipients = new Set<string>();
  const managers = await listInternalManagerUserIds(internalCtx.companyId);
  for (const id of managers) recipients.add(id);

  const bossEmail = getBgosBossEmail();
  if (bossEmail) {
    const bossUser = await prisma.user.findFirst({
      where: { email: { equals: bossEmail, mode: "insensitive" } },
      select: { id: true },
    });
    if (bossUser) recipients.add(bossUser.id);
  }

  if (recipients.size > 0) {
    await notifyInternalUsers({
      companyId: internalCtx.companyId,
      userIds: [...recipients],
      type: "ONBOARDING_PENDING_APPROVAL",
      title: "Onboarding pending approval",
      body: `${body.companyName} — review and approve.`,
      dedupeKey: `onboarding-pending:${leadId}`,
    });
  }

  return jsonSuccess({ onboardingTaskId: task.id }, 201);
}
