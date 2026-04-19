import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesNetworkRole } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { requireInternalSalesSession, getScopedTeam } from "@/lib/internal-sales-access";
import { getBdmRecurringTier } from "@/lib/internal-sales-engine";
import {
  getBatchActiveSubscriptionCounts,
  getBatchBdmNetworkActiveSubs,
} from "@/lib/sales-hierarchy/active-subscriptions";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/internal/sales/team
 *
 * Returns a paginated, scoped team roster with per-member performance stats.
 * All subscription counts are fetched in a single batch query — no N+1.
 *
 * Query params:
 *   take   — page size (default 20, max 100)
 *   skip   — offset    (default 0)
 *
 * Visibility:
 *   BDE   → only themselves
 *   BDM   → themselves + direct BDEs
 *   RSM   → themselves + BDMs + their BDEs
 *   BOSS  → full internal org
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  try {
    const sp   = request.nextUrl.searchParams;
    const take = Math.min(100, Math.max(1, parseInt(sp.get("take") ?? "20", 10) || 20));
    const skip = Math.max(0, parseInt(sp.get("skip") ?? "0", 10) || 0);

    // 1. Paginated roster (2 DB calls: findMany + count)
    const { members, total } = await getScopedTeam(session, take, skip);

    if (members.length === 0) {
      return NextResponse.json({
        ok:         true as const,
        callerRole: session.salesNetworkRole,
        total,
        take,
        skip,
        hasMore:    false,
        roleCount:  {},
        members:    [],
      });
    }

    const memberIds = members.map((m) => m.userId);

    // 2. Batch-fetch live active sub counts — 1 GROUP BY query instead of N COUNT queries
    const liveSubCounts = await getBatchActiveSubscriptionCounts(
      prisma,
      session.companyId,
      memberIds,
    );

    // 3. Batch-fetch BDM network subs — 2 queries instead of M×2 queries
    const bdmIds = members
      .filter((m) => m.salesNetworkRole === SalesNetworkRole.BDM)
      .map((m) => m.userId);

    const bdmNetworkSubs = await getBatchBdmNetworkActiveSubs(
      prisma,
      session.companyId,
      bdmIds,
    );

    // 4. Enrich — pure in-memory, no extra DB calls
    const enriched = members.map((m) => {
      const liveActiveSubs = liveSubCounts.get(m.userId) ?? 0;

      let bdmRecurring: { tier: string; monthlyAmount: number } | null = null;
      if (m.salesNetworkRole === SalesNetworkRole.BDM) {
        const networkSubs = bdmNetworkSubs.get(m.userId) ?? 0;
        const tier = getBdmRecurringTier(networkSubs);
        if (tier) bdmRecurring = { tier: tier.label, monthlyAmount: tier.monthlyAmount };
      }

      let promotionProgress: Record<string, unknown> | null = null;
      if (m.salesNetworkRole === SalesNetworkRole.BDE) {
        const needed = Math.max(0, 60 - liveActiveSubs);
        promotionProgress = {
          nextRole:        "BDM",
          subsNeeded:      needed,
          progressPercent: Math.min(100, Math.round((liveActiveSubs / 60) * 100)),
        };
      }

      return {
        userId:           m.userId,
        name:             m.name,
        email:            m.email,
        salesNetworkRole: m.salesNetworkRole,
        roleLabel:        m.salesNetworkRole?.toLowerCase() ?? "none",
        parentUserId:     m.parentUserId,
        region:           m.region,
        totalPoints:      m.totalPoints,
        activeSubscriptions: liveActiveSubs,
        archivedAt:       m.archivedAt,
        bdmRecurring,
        promotionProgress,
      };
    });

    // Summary counts by role (over current page only — full counts via total)
    const roleCount: Record<string, number> = {};
    for (const m of enriched) {
      const key = m.salesNetworkRole ?? "UNKNOWN";
      roleCount[key] = (roleCount[key] ?? 0) + 1;
    }

    return NextResponse.json({
      ok:         true as const,
      callerRole: session.salesNetworkRole,
      total,
      take,
      skip,
      hasMore:    skip + take < total,
      roleCount,
      members:    enriched,
    });
  } catch (e) {
    return handleApiError("GET /api/internal/sales/team", e);
  }
}
