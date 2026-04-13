import { CompanyBusinessType } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { canAccessWorkflowSubmission } from "@/lib/onboarding-workflow-access";
import type { WorkflowTemplateSections } from "@/lib/onboarding-workflow-types";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAuthWithCompany(_request);
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  if (!id) return jsonError(400, "BAD_REQUEST", "Missing id");

  try {
    const sub = await prisma.onboardingSubmission.findFirst({
      where: { id },
      include: {
        template: true,
        techTask: true,
        company: {
          select: { businessType: true, customBuildClientContactAllowed: true },
        },
        messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true, email: true } } } },
        lead: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!sub) return jsonError(404, "NOT_FOUND", "Not found");

    const role = await canAccessWorkflowSubmission(session, sub);
    if (role === "none") return jsonError(403, "FORBIDDEN", "No access");

    const sections = sub.template.sections as unknown as WorkflowTemplateSections;

    return NextResponse.json({
      ok: true as const,
      role,
      submission: {
        id: sub.id,
        status: sub.status,
        category: sub.category,
        planTier: sub.planTier,
        completionPercent: sub.completionPercent,
        data: sub.data,
        deliveryPdfPath: sub.deliveryPdfPath,
        salesDeliveredAt: sub.salesDeliveredAt?.toISOString() ?? null,
        clientAccessToken: sub.clientAccessToken,
        assignedTechUserId: sub.assignedTechUserId,
        filledByUserId: sub.filledByUserId,
        lead: sub.lead,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
        customBuild:
          sub.company.businessType === CompanyBusinessType.CUSTOM
            ? {
                clientContactUnlocked: sub.company.customBuildClientContactAllowed,
              }
            : null,
      },
      sections,
      techTask: sub.techTask,
      messages: sub.messages.map((m) => ({
        id: m.id,
        message: m.message,
        fieldKey: m.fieldKey,
        createdAt: m.createdAt.toISOString(),
        sender: m.sender ? { name: m.sender.name, email: m.sender.email } : null,
      })),
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/onboarding/workflow/submissions/[id]", e);
  }
}
