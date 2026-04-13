import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { canAccessWorkflowSubmission } from "@/lib/onboarding-workflow-access";
import {
  computeCompletionPercent,
  type WorkflowTemplateSections,
} from "@/lib/onboarding-workflow-types";

const patchSchema = z.object({
  data: z.record(z.string(), z.string()),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const sub = await prisma.onboardingSubmission.findFirst({
      where: { id },
      include: { template: true },
    });
    if (!sub) return jsonError(404, "NOT_FOUND", "Not found");

    const role = await canAccessWorkflowSubmission(session, sub);
    if (role === "none" || role === "tech") {
      return jsonError(403, "FORBIDDEN", "Sales or manager only");
    }

    if (
      sub.status !== "DRAFT" &&
      sub.status !== "NEEDS_INFO"
    ) {
      return jsonError(400, "LOCKED", "Form is not editable.");
    }

    const sections = sub.template.sections as unknown as WorkflowTemplateSections;
    const prev = (sub.data ?? {}) as Record<string, string>;
    const next = { ...prev, ...parsed.data.data };
    const completionPercent = computeCompletionPercent(sections, next);

    const updated = await prisma.onboardingSubmission.update({
      where: { id: sub.id },
      data: { data: next as object, completionPercent },
      select: { completionPercent: true, data: true, status: true },
    });

    let outStatus = updated.status;
    if (sub.status === "NEEDS_INFO") {
      await prisma.onboardingSubmission.update({
        where: { id: sub.id },
        data: { status: "IN_REVIEW" },
      });
      await prisma.onboardingSubmissionTechTask.updateMany({
        where: { submissionId: sub.id },
        data: { status: "IN_PROGRESS" },
      });
      outStatus = "IN_REVIEW";
    }

    return NextResponse.json({
      ok: true as const,
      completionPercent: updated.completionPercent,
      data: updated.data,
      status: outStatus,
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH .../data", e);
  }
}
