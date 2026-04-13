import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  try {
    const co = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: {
        businessType: true,
        subscriptionStatus: true,
        plan: true,
        customOnboardingSubmittedAt: true,
        name: true,
      },
    });
    if (!co) {
      return NextResponse.json({ ok: false as const, error: "Company not found" }, { status: 404 });
    }

    return jsonSuccess({
      businessType: co.businessType,
      subscriptionStatus: co.subscriptionStatus,
      plan: co.plan,
      companyName: co.name,
      customFormComplete: co.customOnboardingSubmittedAt != null,
    });
  } catch (e) {
    return handleApiError("GET /api/onboarding/custom/status", e);
  }
}
