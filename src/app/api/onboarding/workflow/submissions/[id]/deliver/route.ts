import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { canAccessWorkflowSubmission } from "@/lib/onboarding-workflow-access";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { listInternalManagerUserIds } from "@/lib/internal-sales-notifications";
import { IceconnectMetroStage, InternalSalesStage, LeadStatus } from "@prisma/client";

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAuthWithCompany(_request);
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;

  try {
    const sub = await prisma.onboardingSubmission.findFirst({
      where: { id },
    });
    if (!sub) return jsonError(404, "NOT_FOUND", "Not found");

    const role = await canAccessWorkflowSubmission(session, sub);
    if (role === "none" || role === "tech") {
      return jsonError(403, "FORBIDDEN", "Sales or manager only");
    }

    if (sub.status !== "READY") {
      return jsonError(400, "INVALID_STATUS", "Delivery is only available when status is Ready.");
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.onboardingSubmission.update({
        where: { id: sub.id },
        data: {
          status: "DELIVERED",
          salesDeliveredAt: now,
        },
      });
      await tx.onboardingSubmissionTechTask.updateMany({
        where: { submissionId: sub.id },
        data: { status: "DELIVERED" },
      });

      if (sub.leadId) {
        await tx.lead.update({
          where: { id: sub.leadId },
          data: {
            internalSalesStage: InternalSalesStage.CLIENT_LIVE,
            status: LeadStatus.WON,
            iceconnectMetroStage: IceconnectMetroStage.SUBSCRIPTION,
            iceconnectSubscribedAt: now,
            internalStageUpdatedAt: now,
          },
        });
      }
    });

    const bossIds = await listInternalManagerUserIds(sub.companyId);
    await notifyInternalUsers({
      companyId: sub.companyId,
      userIds: bossIds,
      type: "ONBOARDING_WORKFLOW_DELIVERED",
      title: "Onboarding delivered to client",
      body: "Sales marked the onboarding package as delivered.",
      dedupeKey: `workflow-delivered-${sub.id}`,
    });

    return NextResponse.json({ ok: true as const, status: "DELIVERED" as const });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST deliver", e);
  }
}
