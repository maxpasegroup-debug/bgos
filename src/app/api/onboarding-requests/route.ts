import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { OnboardingRequestStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import {
  requireBde,
  requireSalesReviewer,
  requireTechExec,
} from "@/lib/onboarding-request-guards";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  scope: z.enum(["mine", "sales", "tech"]),
});

function serialize(
  r: {
    id: string;
    companyName: string;
    bossEmail: string;
    dashboardType: string;
    template: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    createdBy: { id: string; name: string; email: string };
  },
) {
  return {
    id: r.id,
    company_name: r.companyName,
    boss_email: r.bossEmail,
    dashboard_type: r.dashboardType.toLowerCase(),
    template: r.template.toLowerCase(),
    status: r.status.toLowerCase(),
    notes: r.notes,
    created_by: {
      id: r.createdBy.id,
      name: r.createdBy.name,
      email: r.createdBy.email,
    },
    created_at: r.createdAt.toISOString(),
  };
}

/**
 * List onboarding requests by role: `mine` (BDE), `sales` (RSM/BDM), `tech` (TECH_EXEC).
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const sp = request.nextUrl.searchParams;
  const q = querySchema.safeParse({ scope: sp.get("scope") ?? "mine" });
  if (!q.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid scope", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  try {
    if (q.data.scope === "mine") {
      const g = requireBde(session);
      if (g instanceof NextResponse) return g;
      const rows = await prisma.onboardingRequest.findMany({
        where: { createdByUserId: session.sub },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      });
      return NextResponse.json({
        ok: true as const,
        requests: rows.map((r) => serialize({ ...r, createdBy: r.createdBy })),
      });
    }

    if (q.data.scope === "sales") {
      const g = requireSalesReviewer(session);
      if (g instanceof NextResponse) return g;
      const rows = await prisma.onboardingRequest.findMany({
        where: {
          status: { in: [OnboardingRequestStatus.PENDING, OnboardingRequestStatus.SALES_REVIEW] },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      });
      return NextResponse.json({
        ok: true as const,
        requests: rows.map((r) => serialize({ ...r, createdBy: r.createdBy })),
      });
    }

    const g = requireTechExec(session);
    if (g instanceof NextResponse) return g;
    const rows = await prisma.onboardingRequest.findMany({
      where: { status: OnboardingRequestStatus.TECH_QUEUE },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({
      ok: true as const,
      requests: rows.map((r) => serialize({ ...r, createdBy: r.createdBy })),
    });
  } catch (e) {
    return handleApiError("GET /api/onboarding-requests", e);
  }
}
