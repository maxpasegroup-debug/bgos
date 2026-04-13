import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CompanyBusinessType, InternalSalesStage } from "@prisma/client";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { canAccessWorkflowSubmission } from "@/lib/onboarding-workflow-access";
import { generateOnboardingDeliveryPdf } from "@/lib/onboarding-workflow-pdf";
import type { WorkflowTemplateSections } from "@/lib/onboarding-workflow-types";
import { notifyInternalUsers } from "@/lib/internal-sales-notifications";
import { listInternalManagerUserIds } from "@/lib/internal-sales-notifications";
import { internalStageToLeadStatus } from "@/lib/internal-sales-org";
import { WORKFLOW_CUSTOM_CATEGORY } from "@/lib/onboarding-workflow-templates";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("need_info"),
    message: z.string().trim().min(1).max(8000),
    fieldKey: z.string().trim().max(200).optional(),
  }),
  z.object({ action: z.literal("mark_ready") }),
]);

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const { id } = await ctx.params;
  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const sub = await prisma.onboardingSubmission.findFirst({
      where: { id },
      include: { template: true, techTask: true },
    });
    if (!sub) return jsonError(404, "NOT_FOUND", "Not found");

    const role = await canAccessWorkflowSubmission(session, sub);
    if (role !== "tech" && role !== "manager") {
      return jsonError(403, "FORBIDDEN", "Tech or manager only");
    }

    if (parsed.data.action === "start") {
      if (sub.status !== "SUBMITTED") {
        return jsonError(400, "INVALID_STATUS", "Can only start from Submitted.");
      }
      await prisma.$transaction([
        prisma.onboardingSubmission.update({
          where: { id: sub.id },
          data: { status: "IN_REVIEW" },
        }),
        prisma.onboardingSubmissionTechTask.updateMany({
          where: { submissionId: sub.id },
          data: { status: "IN_PROGRESS" },
        }),
      ]);
      return NextResponse.json({ ok: true as const, status: "IN_REVIEW" as const });
    }

    if (parsed.data.action === "need_info") {
      await prisma.$transaction([
        prisma.onboardingMessage.create({
          data: {
            submissionId: sub.id,
            senderId: session.sub,
            message: parsed.data.message,
            fieldKey: parsed.data.fieldKey?.trim() || null,
          },
        }),
        prisma.onboardingSubmission.update({
          where: { id: sub.id },
          data: { status: "NEEDS_INFO" },
        }),
        prisma.onboardingSubmissionTechTask.updateMany({
          where: { submissionId: sub.id },
          data: { status: "WAITING_INFO" },
        }),
      ]);

      const notify = new Set<string>();
      if (sub.filledByUserId) notify.add(sub.filledByUserId);
      for (const m of await listInternalManagerUserIds(sub.companyId)) notify.add(m);
      if (sub.leadId) {
        const lead = await prisma.lead.findUnique({
          where: { id: sub.leadId },
          select: { assignedTo: true },
        });
        if (lead?.assignedTo) notify.add(lead.assignedTo);
      }
      await notifyInternalUsers({
        companyId: sub.companyId,
        userIds: [...notify],
        type: "ONBOARDING_WORKFLOW_NEEDS_INFO",
        title: "Tech needs more onboarding info",
        body: parsed.data.message.slice(0, 500),
      });

      return NextResponse.json({ ok: true as const, status: "NEEDS_INFO" as const });
    }

    // mark_ready
    if (sub.status !== "IN_REVIEW" && sub.status !== "SUBMITTED") {
      return jsonError(400, "INVALID_STATUS", "Mark ready from In review or Submitted.");
    }

    if (sub.category === WORKFLOW_CUSTOM_CATEGORY) {
      const gate = await prisma.company.findUnique({
        where: { id: sub.companyId },
        select: { businessType: true, customBuildClientContactAllowed: true },
      });
      if (
        gate?.businessType === CompanyBusinessType.CUSTOM &&
        !gate.customBuildClientContactAllowed
      ) {
        return jsonError(
          403,
          "FINAL_PAYMENT_REQUIRED",
          "Sales must confirm final payment before this custom build can be marked ready for delivery.",
        );
      }
    }

    const company = await prisma.company.findUnique({
      where: { id: sub.companyId },
      select: { id: true, name: true },
    });
    if (!company) return jsonError(500, "SERVER", "Company missing");

    const sections = sub.template.sections as unknown as WorkflowTemplateSections;
    const pdfPath = await generateOnboardingDeliveryPdf({
      submission: sub,
      company,
      sections,
    });

    await prisma.$transaction([
      prisma.onboardingSubmission.update({
        where: { id: sub.id },
        data: { status: "READY", deliveryPdfPath: pdfPath },
      }),
      prisma.onboardingSubmissionTechTask.updateMany({
        where: { submissionId: sub.id },
        data: { status: "READY" },
      }),
    ]);

    const salesNotify = new Set<string>();
    if (sub.filledByUserId) salesNotify.add(sub.filledByUserId);
    for (const m of await listInternalManagerUserIds(sub.companyId)) salesNotify.add(m);
    await notifyInternalUsers({
      companyId: sub.companyId,
      userIds: [...salesNotify],
      type: "ONBOARDING_WORKFLOW_READY",
      title: "Onboarding ready for delivery",
      body: "Delivery document is ready. Share with the client from the manage page.",
      dedupeKey: `workflow-ready-${sub.id}`,
    });

    return NextResponse.json({ ok: true as const, status: "READY" as const, deliveryPdfPath: pdfPath });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH tech", e);
  }
}
