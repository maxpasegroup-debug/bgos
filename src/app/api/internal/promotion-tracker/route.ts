import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getInternalMembership } from "@/lib/internal-platform/get-internal-membership";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

/**
 * BDM/RSM promotion progress (active subs snapshot + eligibility flags).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const m = await getInternalMembership(prisma, session.sub);
    if (!m.ok) {
      return NextResponse.json(
        { ok: false as const, error: m.error, code: m.code },
        { status: m.code === "INTERNAL_ORG" ? 500 : 403 },
      );
    }

    const row = await prisma.promotionTracker.findUnique({
      where: { companyId_userId: { userId: session.sub, companyId: m.companyId } },
      select: {
        currentStreak: true,
        targetMet: true,
        eligibleForPromotion: true,
        roleTarget: true,
        activeCountSnapshot: true,
        lastPromotionCheckAt: true,
      },
    });

    return NextResponse.json({
      ok: true as const,
      tracker: row
        ? {
            current_streak: row.currentStreak,
            target_met: row.targetMet,
            eligible_for_promotion: row.eligibleForPromotion,
            role_target: row.roleTarget,
            active_count_snapshot: row.activeCountSnapshot,
            last_check_at: row.lastPromotionCheckAt?.toISOString() ?? null,
          }
        : null,
      active_subscriptions_count: m.userCompany.activeSubscriptionsCount,
    });
  } catch (e) {
    logCaughtError("GET /api/internal/promotion-tracker", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load promotion data", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
