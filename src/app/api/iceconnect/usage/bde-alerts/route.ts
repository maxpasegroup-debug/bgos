import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UsageFlagStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireBde } from "@/lib/onboarding-request-guards";
import { getCompanyIdsForBde } from "@/lib/sales-hierarchy";
import { prisma } from "@/lib/prisma";

/**
 * BDE: companies they onboarded that have active capacity pressure.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const gate = requireBde(session);
  if (gate instanceof NextResponse) return gate;

  try {
    const scope = await getCompanyIdsForBde(session.sub);
    if (scope.length === 0) {
      return NextResponse.json({ ok: true as const, alerts: [] as const });
    }

    const flags = await prisma.usageFlag.findMany({
      where: {
        companyId: { in: scope },
        status: { in: [UsageFlagStatus.ACTIVE, UsageFlagStatus.IN_PROGRESS] },
      },
      include: {
        company: {
          select: {
            name: true,
            usageMetric: true,
            companyLimit: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    const alerts = flags.map((f) => {
      const m = f.company.usageMetric;
      const l = f.company.companyLimit;
      const cur =
        f.kind === "USERS"
          ? (m?.currentUsers ?? 0)
          : f.kind === "LEADS"
            ? (m?.currentLeads ?? 0)
            : (m?.currentProjects ?? 0);
      const max =
        f.kind === "USERS"
          ? (l?.maxUsers ?? 1)
          : f.kind === "LEADS"
            ? (l?.maxLeads ?? 1)
            : (l?.maxProjects ?? 1);
      const usage_pct = max <= 0 ? 0 : Math.min(100, Math.round((cur / max) * 1000) / 10);
      return {
        company_id: f.companyId,
        company_name: f.company.name,
        kind: f.kind.toLowerCase(),
        usage_pct,
        message: `${f.company.name} is at ${usage_pct}% of ${f.kind.toLowerCase()} capacity.`,
      };
    });

    return NextResponse.json({ ok: true as const, alerts });
  } catch (e) {
    return handleApiError("GET /api/iceconnect/usage/bde-alerts", e);
  }
}
