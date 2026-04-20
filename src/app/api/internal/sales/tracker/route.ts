import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import {
  getPromotionTrackerSnapshot,
  getBdmNetworkActiveSubs,
  getBdmRecurringTier,
} from "@/lib/internal-sales-engine";
import { requireInternalSalesSession, getScopedUserIds } from "@/lib/internal-sales-access";
import { SalesNetworkRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/internal/sales/tracker
 *
 * Returns the promotion tracker + performance snapshot for the caller (or a
 * specific user when ?userId= is provided and the caller has scope).
 *
 * BDM/RSM/BOSS may request data for any visible member via ?userId=...
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  try {
    const sp = request.nextUrl.searchParams;
    const targetUserId = sp.get("userId")?.trim() ?? session.userId;

    // Ensure the caller has scope over the requested user
    if (targetUserId !== session.userId) {
      const scopedIds = await getScopedUserIds(
        session.companyId,
        session.userId,
        session.salesNetworkRole,
      );
      if (!scopedIds.includes(targetUserId)) {
        return NextResponse.json(
          { ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const },
          { status: 403 },
        );
      }
    }

    const snapshot = await getPromotionTrackerSnapshot(
      session.companyId,
      targetUserId,
      prisma,
    );

    // BDM-specific: recurring tier based on network subs
    let bdmRecurring: { tier: string; monthlyAmount: number } | null = null;
    if (snapshot.role === SalesNetworkRole.BDM) {
      const networkSubs = await getBdmNetworkActiveSubs(session.companyId, targetUserId);
      const tier = getBdmRecurringTier(networkSubs);
      if (tier) {
        bdmRecurring = { tier: tier.label, monthlyAmount: tier.monthlyAmount };
      }
    }

    // Build promotion progress hints (safe for UI)
    const progressHints = buildProgressHints(snapshot.role, snapshot.activeSubscriptions);

    return NextResponse.json({
      ok: true as const,
      userId: snapshot.userId,
      role: snapshot.role,
      totalPoints: snapshot.totalPoints,
      activeSubscriptions: snapshot.activeSubscriptions,
      currentLevel: snapshot.currentLevel,
      promotionEligible: snapshot.promotionEligible,
      roleTarget: snapshot.roleTarget,
      lastPromotionCheckAt: snapshot.lastPromotionCheckAt,
      bdmRecurring,
      progressHints,
    });
  } catch (e) {
    return handleApiError("GET /api/internal/sales/tracker", e);
  }
}

function buildProgressHints(
  role: SalesNetworkRole | null,
  activeSubs: number,
): Record<string, unknown> {
  if (role === SalesNetworkRole.BDE) {
    const needed = Math.max(0, 60 - activeSubs);
    return {
      nextRole: "BDM",
      requiredActiveSubs: 60,
      currentActiveSubs: activeSubs,
      subsNeeded: needed,
      progressPercent: Math.min(100, Math.round((activeSubs / 60) * 100)),
    };
  }
  if (role === SalesNetworkRole.BDM) {
    return {
      nextRole: "RSM",
      requirement: "Build a team of ≥5 BDEs with strong network performance",
    };
  }
  return {};
}
