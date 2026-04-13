import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { canAccessWorkflowSubmission } from "@/lib/onboarding-workflow-access";
import { finalizeSubmissionToSubmitted } from "@/lib/onboarding-workflow-finalize";

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

    try {
      await finalizeSubmissionToSubmitted(sub.id);
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_STATUS") {
        return jsonError(400, "INVALID_STATUS", "Cannot submit.");
      }
      throw e;
    }

    return NextResponse.json({ ok: true as const, status: "SUBMITTED" as const });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("POST .../submit", e);
  }
}
