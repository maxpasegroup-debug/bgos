import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const user_exists = true;
    const membership = auth.companyId
      ? await prisma.userCompany.findUnique({
          where: { userId_companyId: { userId: auth.sub, companyId: auth.companyId } },
          select: { companyId: true, jobRole: true },
        })
      : null;
    const company_exists = Boolean(auth.companyId && membership?.companyId);
    const role_assigned = Boolean(membership?.jobRole || auth.role);
    const session = await prisma.onboardingSession.findFirst({
      where: {
        createdByUserId: auth.sub,
        status: { in: ["draft", "in_progress", "ready", "launched"] },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    const session_ready = Boolean(session?.id);

    return NextResponse.json({
      ok: true as const,
      success: true as const,
      data: {
        user_exists,
        company_exists,
        role_assigned,
        session_ready,
        user_id: auth.sub,
        email: auth.email,
        session_id: session?.id ?? null,
      },
    });
  } catch (error) {
    console.error("GET /api/onboarding/state", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        message: "Could not check onboarding state",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
