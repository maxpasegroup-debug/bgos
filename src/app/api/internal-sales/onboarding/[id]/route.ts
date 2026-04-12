import type { NextRequest } from "next/server";
import {
  InternalSalesStage,
  OnboardingTaskStatus,
  TechPipelineStage,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession, internalStageToLeadStatus } from "@/lib/internal-sales-org";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { notifySalesOnboardingDelivered } from "@/lib/internal-sales-onboarding";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { prisma } from "@/lib/prisma";
import {
  nextPipelineStage,
  pipelineStageLabel,
  pipelineStageToInternalTech,
} from "@/lib/tech-pipeline-sync";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

function canUpdateOnboarding(role: UserRole) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER ||
    role === UserRole.TECH_HEAD ||
    role === UserRole.TECH_EXECUTIVE ||
    role === UserRole.OPERATIONS_HEAD ||
    role === UserRole.SITE_ENGINEER ||
    role === UserRole.PRO ||
    role === UserRole.INSTALLATION_TEAM
  );
}

const patchSchema = z.union([
  z.object({ status: z.nativeEnum(OnboardingTaskStatus) }),
  z.object({ advancePipeline: z.literal(true) }),
]);

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (!canUpdateOnboarding(session.role)) {
    return jsonError(403, "FORBIDDEN", "Tech or manager access only");
  }

  if (await isCompanyBasicTrialExpired(session.companyId, session.email)) {
    return trialExpiredJsonResponse();
  }

  const { id } = await ctx.params;

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  const task = await prisma.onboardingTask.findFirst({
    where: { id, companyId: internalCtx.companyId },
    include: { lead: true },
  });
  if (!task) return jsonError(404, "NOT_FOUND", "Onboarding not found");

  if ("advancePipeline" in parsed.data && parsed.data.advancePipeline) {
    if (task.lead.internalSalesStage !== InternalSalesStage.SENT_TO_TECH) {
      return jsonError(
        400,
        "INVALID_STAGE",
        "Pipeline advances only apply while the lead is Sent to Tech",
      );
    }

    const nxt = nextPipelineStage(task.pipelineStage);
    if (!nxt) {
      return jsonError(400, "PIPELINE_COMPLETE", "Already at Ready — use sales to deliver");
    }

    const techStage = pipelineStageToInternalTech(nxt);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.onboardingTask.update({
        where: { id },
        data: { pipelineStage: nxt },
      });

      if (nxt === TechPipelineStage.READY) {
        await tx.lead.update({
          where: { id: task.leadId },
          data: {
            internalTechStage: techStage,
            internalSalesStage: InternalSalesStage.TECH_READY,
            status: internalStageToLeadStatus(InternalSalesStage.TECH_READY),
            internalStageUpdatedAt: now,
          },
        });
      } else {
        await tx.lead.update({
          where: { id: task.leadId },
          data: {
            internalTechStage: techStage,
            internalStageUpdatedAt: now,
          },
        });
      }

      return row;
    });

    await logInternalLeadActivity({
      companyId: internalCtx.companyId,
      leadId: task.leadId,
      userId: session.sub,
      action: INTERNAL_ACTIVITY.ONBOARDING_STATUS,
      detail: `Tech pipeline: ${pipelineStageLabel(nxt)}`,
      metadata: { onboardingTaskId: id, pipelineStage: nxt },
    });

    if (nxt === TechPipelineStage.READY) {
      const recipients = new Set<string>();
      if (task.lead.assignedTo) recipients.add(task.lead.assignedTo);
      const managers = await prisma.userCompany.findMany({
        where: {
          companyId: internalCtx.companyId,
          jobRole: { in: [UserRole.ADMIN, UserRole.MANAGER] },
        },
        select: { userId: true },
      });
      for (const m of managers) recipients.add(m.userId);
      if (recipients.size > 0) {
        await notifyInternalUsers({
          companyId: internalCtx.companyId,
          userIds: [...recipients],
          type: "TECH_READY",
          title: "Ready for delivery",
          body: `${task.lead.name} — tech pipeline complete. Deliver to client.`,
          dedupeKey: `tech-ready-pipeline:${task.leadId}`,
        });
      }
    }

    return jsonSuccess({
      task: {
        id: updated.id,
        pipelineStage: updated.pipelineStage,
        techQueuePriority: updated.techQueuePriority,
      },
    });
  }

  const statusBody = parsed.data as { status: OnboardingTaskStatus };
  const prev = task.status;
  const updated = await prisma.onboardingTask.update({
    where: { id },
    data: { status: statusBody.status },
  });

  await logInternalLeadActivity({
    companyId: internalCtx.companyId,
    leadId: task.leadId,
    userId: session.sub,
    action: INTERNAL_ACTIVITY.ONBOARDING_STATUS,
    detail: `Onboarding: ${statusBody.status.replace(/_/g, " ").toLowerCase()}`,
    metadata: { onboardingTaskId: id, from: prev, to: statusBody.status },
  });

  if (
    statusBody.status === OnboardingTaskStatus.DELIVERED &&
    prev !== OnboardingTaskStatus.DELIVERED
  ) {
    await notifySalesOnboardingDelivered({
      companyId: internalCtx.companyId,
      lead: task.lead,
      taskId: id,
    });
  }

  return jsonSuccess({ task: { id: updated.id, status: updated.status } });
}
