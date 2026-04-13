import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { canAccessWorkflowSubmission } from "@/lib/onboarding-workflow-access";

export async function GET(
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
    if (role === "none") return jsonError(403, "FORBIDDEN", "No access");

    const rows = await prisma.onboardingMessage.findMany({
      where: { submissionId: id },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { name: true, email: true } } },
    });

    return NextResponse.json({
      ok: true as const,
      messages: rows.map((m) => ({
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
    return handleApiError("GET messages", e);
  }
}
