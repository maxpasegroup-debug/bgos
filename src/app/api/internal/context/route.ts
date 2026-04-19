import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getInternalMembership } from "@/lib/internal-platform/get-internal-membership";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { isSuperBossEmail } from "@/lib/super-boss";

/**
 * Platform internal org context for the signed-in user (membership + role labels).
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

    const superBoss = session.superBoss === true && isSuperBossEmail(session.email);
    const snr = m.userCompany.salesNetworkRole;
    const displayRole = superBoss
      ? "SUPER_BOSS"
      : snr === null
        ? "MEMBER"
        : String(snr);

    return NextResponse.json({
      ok: true as const,
      company_id: m.companyId,
      sales_network_role: snr,
      display_role: displayRole,
      is_super_boss: superBoss,
      user: {
        id: m.userCompany.user.id,
        name: m.userCompany.user.name,
        email: m.userCompany.user.email,
      },
      parent_user_id: m.userCompany.parentUserId,
      region: m.userCompany.region,
      total_points: m.userCompany.totalPoints,
      active_subscriptions_count: m.userCompany.activeSubscriptionsCount,
      bde_slot_limit: m.userCompany.bdeSlotLimit,
      benefit_level: m.userCompany.benefitLevel,
    });
  } catch (e) {
    logCaughtError("GET /api/internal/context", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load context", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
