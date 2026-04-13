import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import {
  computeCompletionPercent,
  type WorkflowTemplateSections,
} from "@/lib/onboarding-workflow-types";

const patchSchema = z.object({
  data: z.record(z.string(), z.string()).optional(),
});

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token?.trim()) return jsonError(400, "BAD_REQUEST", "Missing token");

  try {
    const sub = await prisma.onboardingSubmission.findUnique({
      where: { clientAccessToken: token.trim() },
      include: { template: true },
    });
    if (!sub) return jsonError(404, "NOT_FOUND", "Invalid or expired link.");

    const sections = sub.template.sections as unknown as WorkflowTemplateSections;
    const data = (sub.data ?? {}) as Record<string, string>;

    return NextResponse.json({
      ok: true as const,
      category: sub.category,
      planTier: sub.planTier,
      status: sub.status,
      completionPercent: sub.completionPercent,
      sections,
      data,
      readOnly: sub.status !== "DRAFT" && sub.status !== "NEEDS_INFO",
      editable: sub.status === "DRAFT" || sub.status === "NEEDS_INFO",
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/onboarding/workflow/public/[token]", e);
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token?.trim()) return jsonError(400, "BAD_REQUEST", "Missing token");

  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const sub = await prisma.onboardingSubmission.findUnique({
      where: { clientAccessToken: token.trim() },
      include: { template: true },
    });
    if (!sub) return jsonError(404, "NOT_FOUND", "Invalid or expired link.");

    if (
      sub.status !== "DRAFT" &&
      sub.status !== "NEEDS_INFO"
    ) {
      return jsonError(403, "LOCKED", "This form can no longer be edited via this link.");
    }

    const sections = sub.template.sections as unknown as WorkflowTemplateSections;
    const prev = (sub.data ?? {}) as Record<string, string>;
    const incoming = parsed.data.data ?? {};
    const next = { ...prev, ...incoming };
    const completionPercent = computeCompletionPercent(sections, next);

    const updated = await prisma.onboardingSubmission.update({
      where: { id: sub.id },
      data: {
        data: next as object,
        completionPercent,
      },
      select: {
        completionPercent: true,
        status: true,
        data: true,
      },
    });

    return NextResponse.json({
      ok: true as const,
      completionPercent: updated.completionPercent,
      status: updated.status,
      data: updated.data,
    });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("PATCH /api/onboarding/workflow/public/[token]", e);
  }
}
