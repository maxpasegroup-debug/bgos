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
import { createOnboardingTaskForLead } from "@/lib/internal-sales-onboarding";
import { listInternalManagerUserIds, notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { getBgosBossEmail } from "@/lib/super-boss";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const bodySchema = z.object({
  companyName: z.string().trim().min(1).max(300),
  ownerName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(32),
  email: z.string().trim().email().max(320),
  businessType: z.string().trim().min(1).max(200),
  teamSize: z.string().trim().min(1).max(100),
  leadSources: z.string().trim().min(1).max(2000),
  problems: z.string().trim().min(1).max(5000),
  requirements: z.string().trim().min(1).max(5000),
  plan: z.string().trim().min(1).max(200),
  whatsApp: z.string().trim().min(1).max(32),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    select: { id: true, name: true, assignedTo: true, internalSalesStage: true },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  if (lead.internalSalesStage !== InternalSalesStage.INTERESTED) {
    return jsonError(400, "INVALID_STAGE", "Onboarding form is only available when the lead is Interested");
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

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const now = new Date();

  const task = await createOnboardingTaskForLead({
    companyId: internalCtx.companyId,
    leadId,
    createdByUserId: session.sub,
    snapshot: {
      companyName: parsed.data.companyName,
      ownerName: parsed.data.ownerName,
      phone: parsed.data.phone,
      email: parsed.data.email.trim(),
      businessType: parsed.data.businessType,
      teamSize: parsed.data.teamSize,
      leadSources: parsed.data.leadSources,
      problems: parsed.data.problems,
      requirements: parsed.data.requirements,
      plan: parsed.data.plan,
      whatsApp: parsed.data.whatsApp,
    },
    closeWon: false,
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      internalSalesStage: InternalSalesStage.ONBOARDING_FORM_FILLED,
      internalOnboardingApprovalStatus: InternalOnboardingApprovalStatus.PENDING,
      status: internalStageToLeadStatus(InternalSalesStage.ONBOARDING_FORM_FILLED),
      internalStageUpdatedAt: now,
      leadCompanyName: parsed.data.companyName.trim(),
      email: parsed.data.email.trim(),
    },
  });

  await logInternalLeadActivity({
    companyId: internalCtx.companyId,
    leadId,
    userId: session.sub,
    action: INTERNAL_ACTIVITY.STAGE,
    detail: "Onboarding form submitted — awaiting boss approval",
    metadata: { onboardingTaskId: task.id },
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
      body: `${parsed.data.companyName} — review and approve.`,
      dedupeKey: `onboarding-pending:${leadId}`,
    });
  }

  return jsonSuccess({ onboardingTaskId: task.id }, 201);
}
