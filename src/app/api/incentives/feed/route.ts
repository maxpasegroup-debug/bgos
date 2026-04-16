import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IncentiveCampaignLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthWithCompany } from "@/lib/auth";
import { incentiveAudiencesForRole } from "@/lib/incentives-audience";
import { handleApiError } from "@/lib/route-error";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Public incentives feed for ICECONNECT dashboards (sales + franchise).
 * NICEJOBS audience reserved for future NICEJOBs workspace.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const now = new Date();
    const vm = monthKey(now);
    const audiences = incentiveAudiencesForRole(session.role);

    const [announcements, bonusTeasers, megaTeasers] = await Promise.all([
      prisma.offerAnnouncement.findMany({
        where: {
          isActive: true,
          audience: { in: audiences },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, title: true, body: true, audience: true, createdAt: true },
      }),
      prisma.bonusCampaign.findMany({
        where: {
          lifecycle: IncentiveCampaignLifecycle.ACTIVE,
          eligibleAudience: { in: audiences },
          validMonth: vm,
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, title: true, bonusType: true, poolAmount: true },
      }),
      prisma.megaPrizeCampaign.findMany({
        where: {
          lifecycle: IncentiveCampaignLifecycle.ACTIVE,
          audience: { in: audiences },
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, name: true, prizeDescription: true },
      }),
    ]);

    return NextResponse.json({
      ok: true as const,
      announcements: announcements.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      bonusTeasers,
      megaTeasers,
    });
  } catch (e) {
    return handleApiError("GET /api/incentives/feed", e);
  }
}
