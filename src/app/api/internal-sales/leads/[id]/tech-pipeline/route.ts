import type { NextRequest } from "next/server";
import { InternalSalesStage, InternalTechStage, TechPipelineStage, UserRole } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany, type AuthUserWithCompany } from "@/lib/auth";
import {
  assertInternalSalesSession,
  canManageInternalSalesAssignments,
  internalStageToLeadStatus,
} from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import {
  canJumpTechStage,
  initialTechStage,
  nextTechStage,
  techMetroLabel,
} from "@/lib/internal-sales-metro";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import { internalTechToPipelineStage } from "@/lib/tech-pipeline-sync";
import { getUserCompanyMembership } from "@/lib/user-company";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

const bodySchema = z.object({
  /** Advance one tech step, or hand over to sales when at final tech stage. */
  action: z.enum(["advance", "handover_to_sales"]),
});

const TECH_ROLES: UserRole[] = [UserRole.TECH_HEAD, UserRole.TECH_EXECUTIVE];

function canUseTechPipeline(session: AuthUserWithCompany) {
  if (canManageInternalSalesAssignments(session)) return true;
  return TECH_ROLES.includes(session.role);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (!canUseTechPipeline(session)) {
    return jsonError(403, "FORBIDDEN", "Tech or manager only");
  }

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const mem = await getUserCompanyMembership(session.sub, internalCtx.companyId);
  if (!mem && !canManageInternalSalesAssignments(session)) {
    return jsonError(403, "FORBIDDEN", "Not a member of this company");
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
      internalTechStage: true,
    },
  });
  if (!lead) return jsonError(404, "NOT_FOUND", "Lead not found");

  if (lead.internalSalesStage !== InternalSalesStage.SENT_TO_TECH) {
    return jsonError(400, "INVALID_STAGE", "Lead is not in tech delivery phase");
  }

  const tech = lead.internalTechStage ?? initialTechStage();
  const now = new Date();

  if (parsed.data.action === "handover_to_sales") {
    if (tech !== InternalTechStage.READY_FOR_DELIVERY) {
      return jsonError(400, "TECH_NOT_READY", "Complete all tech stages first");
    }
    const obTask = await prisma.onboardingTask.findUnique({ where: { leadId } });
    if (obTask) {
      await prisma.onboardingTask.update({
        where: { id: obTask.id },
        data: { pipelineStage: TechPipelineStage.READY },
      });
    }
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        internalSalesStage: InternalSalesStage.TECH_READY,
        status: internalStageToLeadStatus(InternalSalesStage.TECH_READY),
        internalStageUpdatedAt: now,
      },
    });
    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.STAGE,
      detail: "Tech ready for delivery — handed to sales",
    });
    const recipients = new Set<string>();
    if (lead.assignedTo) recipients.add(lead.assignedTo);
    if (recipients.size > 0) {
      await notifyInternalUsers({
        companyId: internalCtx.companyId,
        userIds: [...recipients],
        type: "TECH_READY",
        title: "Ready for delivery",
        body: `${lead.name} — tech finished setup. Deliver to client.`,
        dedupeKey: `tech-ready:${leadId}`,
      });
    }
    return jsonSuccess({ ok: true as const, internalSalesStage: InternalSalesStage.TECH_READY });
  }

  const nxt = nextTechStage(tech);
  if (!nxt) {
    return jsonError(400, "TECH_COMPLETE", "Use handover to sales when at Ready for Delivery");
  }
  if (!canJumpTechStage(tech, nxt)) {
    return jsonError(400, "INVALID_TECH_STEP", "Invalid tech transition");
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      internalTechStage: nxt,
      internalStageUpdatedAt: now,
    },
  });
  const obTask = await prisma.onboardingTask.findUnique({ where: { leadId } });
  if (obTask) {
    await prisma.onboardingTask.update({
      where: { id: obTask.id },
      data: { pipelineStage: internalTechToPipelineStage(nxt) },
    });
  }
  await logInternalLeadActivity({
    companyId: internalCtx.companyId,
    leadId,
    userId: session.sub,
    action: INTERNAL_ACTIVITY.STAGE,
    detail: `Tech pipeline: ${techMetroLabel(nxt)}`,
  });

  return jsonSuccess({ ok: true as const, internalTechStage: nxt });
}
