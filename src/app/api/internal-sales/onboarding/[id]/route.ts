import type { NextRequest } from "next/server";
import { OnboardingTaskStatus } from "@prisma/client";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";
import { UserRole } from "@prisma/client";
import { INTERNAL_ACTIVITY, logInternalLeadActivity } from "@/lib/internal-sales-activity";
import { notifySalesOnboardingDelivered } from "@/lib/internal-sales-onboarding";

function canUpdateOnboarding(role: UserRole) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER ||
    role === UserRole.OPERATIONS_HEAD ||
    role === UserRole.SITE_ENGINEER ||
    role === UserRole.PRO ||
    role === UserRole.INSTALLATION_TEAM
  );
}

const patchSchema = z.object({
  status: z.nativeEnum(OnboardingTaskStatus),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const internalCtx = await assertInternalSalesSession(session);
  if (internalCtx instanceof Response) return internalCtx;

  if (!canUpdateOnboarding(session.role)) {
    return jsonError(403, "FORBIDDEN", "Tech or manager access only");
  }

  if (await isCompanyBasicTrialExpired(session.companyId)) {
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

  const prev = task.status;
  const updated = await prisma.onboardingTask.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  await logInternalLeadActivity({
    companyId: internalCtx.companyId,
    leadId: task.leadId,
    userId: session.sub,
    action: INTERNAL_ACTIVITY.ONBOARDING_STATUS,
    detail: `Onboarding: ${parsed.data.status.replace(/_/g, " ").toLowerCase()}`,
    metadata: { onboardingTaskId: id, from: prev, to: parsed.data.status },
  });

  if (parsed.data.status === OnboardingTaskStatus.DELIVERED && prev !== OnboardingTaskStatus.DELIVERED) {
    await notifySalesOnboardingDelivered({
      companyId: internalCtx.companyId,
      lead: task.lead,
      taskId: id,
    });
  }

  return jsonSuccess({ task: { id: updated.id, status: updated.status } });
}
