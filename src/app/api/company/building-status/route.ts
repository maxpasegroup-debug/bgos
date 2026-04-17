import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;

  try {
    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { dashboardConfig: true },
    });
    const dc = company?.dashboardConfig;
    const rec = dc && typeof dc === "object" && !Array.isArray(dc) ? (dc as Record<string, unknown>) : {};
    const onboardingStatus = typeof rec.onboardingStatus === "string" ? rec.onboardingStatus : "";
    const building = onboardingStatus === "under_review";

    return NextResponse.json({
      ok: true as const,
      success: true as const,
      building,
    });
  } catch (error) {
    console.error("GET /api/company/building-status", error);
    return NextResponse.json(
      { ok: false as const, success: false as const, building: false },
      { status: 500 },
    );
  }
}
