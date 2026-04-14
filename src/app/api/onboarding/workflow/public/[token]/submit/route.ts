import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { finalizeSubmissionToSubmitted } from "@/lib/onboarding-workflow-finalize";

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token?.trim()) return jsonError(400, "BAD_REQUEST", "Missing token");

  try {
    const sub = await prisma.onboardingSubmission.findUnique({
      where: { clientAccessToken: token.trim() },
      select: { id: true, status: true },
    });
    if (!sub) return jsonError(404, "NOT_FOUND", "Invalid link.");

    if (sub.status !== "DRAFT" && sub.status !== "NEEDS_INFO") {
      return jsonError(400, "INVALID_STATUS", "Already submitted.");
    }

    try {
      await finalizeSubmissionToSubmitted(sub.id);
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_STATUS") {
        return jsonError(400, "INVALID_STATUS", "Cannot submit now.");
      }
      if (e instanceof Error && e.message === "NOT_FOUND") {
        return jsonError(404, "NOT_FOUND", "Not found.");
      }
      if (e instanceof Error && e.message === "EMPTY_SUBMISSION") {
        return jsonError(
          400,
          "EMPTY_SUBMISSION",
          "Complete the onboarding form before submitting.",
        );
      }
      throw e;
    }

    return NextResponse.json({ ok: true as const, status: "SUBMITTED" as const });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST /api/onboarding/workflow/public/[token]/submit", e);
  }
}
