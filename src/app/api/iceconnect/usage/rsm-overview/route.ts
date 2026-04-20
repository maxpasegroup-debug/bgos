import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IceconnectEmployeeRole, UsageFlagStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireIceconnectWorkforce } from "@/lib/onboarding-request-guards";
import { getBdeIdsUnderRsm, getCompanyIdsForRsm } from "@/lib/sales-hierarchy";
import { prisma } from "@/lib/prisma";

/**
 * RSM: flagged companies in territory + simple conversion stats.
 */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  const w = requireIceconnectWorkforce(session);
  if (w instanceof NextResponse) return w;
  if (session.iceconnectEmployeeRole !== IceconnectEmployeeRole.RSM) {
    return NextResponse.json({ ok: false as const, error: "RSM only" }, { status: 403 });
  }

  try {
    const scope = await getCompanyIdsForRsm(session.sub);
    const bdeIds = await getBdeIdsUnderRsm(session.sub);

    if (scope.length === 0) {
      return NextResponse.json({
        ok: true as const,
        team: { bde_count: bdeIds.length, flagged_companies: 0 },
        performance: { conversion_rate: 0, converted_flags: 0, total_flags: 0 },
        recent_flags: [] as const,
      });
    }

    const [flagged, converted, totalHistorical] = await Promise.all([
      prisma.usageFlag.count({
        where: {
          companyId: { in: scope },
          status: { in: [UsageFlagStatus.ACTIVE, UsageFlagStatus.IN_PROGRESS] },
        },
      }),
      prisma.usageFlag.count({
        where: {
          companyId: { in: scope },
          status: UsageFlagStatus.CONVERTED,
        },
      }),
      prisma.usageFlag.count({
        where: { companyId: { in: scope } },
      }),
    ]);

    const conversion_rate =
      totalHistorical === 0 ? 0 : Math.round((converted / totalHistorical) * 1000) / 10;

    const recent = await prisma.usageFlag.findMany({
      where: {
        companyId: { in: scope },
        status: { in: [UsageFlagStatus.ACTIVE, UsageFlagStatus.IN_PROGRESS] },
      },
      include: { company: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

    return NextResponse.json({
      ok: true as const,
      team: {
        bde_count: bdeIds.length,
        flagged_companies: flagged,
      },
      performance: {
        conversion_rate,
        converted_flags: converted,
        total_flags: totalHistorical,
      },
      recent_flags: recent.map((f) => ({
        id: f.id,
        company_id: f.companyId,
        company_name: f.company.name,
        kind: f.kind.toLowerCase(),
        status: f.status.toLowerCase(),
      })),
    });
  } catch (e) {
    return handleApiError("GET /api/iceconnect/usage/rsm-overview", e);
  }
}
