import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveCampaignLifecycle } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const now = new Date();
    const vm = monthKey(now);

    const [
      activeTargetCampaigns,
      bonusRows,
      megaActive,
      commissionPlansCount,
    ] = await Promise.all([
      prisma.targetCampaign.count({
        where: { startDate: { lte: now }, endDate: { gte: now } },
      }),
      prisma.bonusCampaign.findMany({
        where: { validMonth: vm, lifecycle: IncentiveCampaignLifecycle.ACTIVE },
        select: { poolAmount: true },
      }),
      prisma.megaPrizeCampaign.count({
        where: {
          lifecycle: IncentiveCampaignLifecycle.ACTIVE,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
      prisma.commissionRule.count({ where: { isActive: true } }),
    ]);

    const thisMonthBonusPool = bonusRows.reduce((s, r) => s + (r.poolAmount ?? 0), 0);

    return NextResponse.json({
      ok: true as const,
      overview: {
        activeTargetCampaigns,
        thisMonthBonusPool,
        megaPrizeCampaigns: megaActive,
        commissionPlansCount,
      },
    });
  } catch (e) {
    logCaughtError("GET /api/bgos/control/incentives/overview", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load overview", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
