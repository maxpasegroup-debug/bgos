import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesHierarchySubscriptionStatus, SalesNetworkRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { BDE_TO_BDM_ACTIVE_SUBS, BDM_TO_RSM_MIN_BDES } from "@/config/sales-hierarchy";
import { getActiveSubscriptionCount } from "@/lib/sales-hierarchy/active-subscriptions";
import { isSuperBossEmail } from "@/lib/super-boss";

/**
 * Role-scoped sales hierarchy insights (Nexa intelligence).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireAuth(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const companyId = org.companyId;
    const userId = session.sub;

    if (isSuperBossEmail(session.email)) {
      const [subs, members] = await Promise.all([
        prisma.salesHierarchySubscription.count({
          where: { companyId, status: SalesHierarchySubscriptionStatus.ACTIVE },
        }),
        prisma.userCompany.count({ where: { companyId, archivedAt: null } }),
      ]);
      return NextResponse.json({
        ok: true as const,
        role: "boss" as const,
        boss: {
          platform_active_subscriptions: subs,
          network_members: members,
        },
      });
    }

    const membership = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: {
        salesNetworkRole: true,
        totalPoints: true,
        activeSubscriptionsCount: true,
        bdeSlotLimit: true,
        benefitLevel: true,
        parentUserId: true,
        region: true,
      },
    });

    if (!membership?.salesNetworkRole) {
      return NextResponse.json(
        { ok: false as const, error: "No sales network role on membership.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const role = membership.salesNetworkRole;
    const active = membership
      ? await getActiveSubscriptionCount(prisma, companyId, userId)
      : 0;

    if (role === SalesNetworkRole.BDE || role === SalesNetworkRole.TECH_EXEC) {
      const points = membership?.totalPoints ?? 0;
      return NextResponse.json({
        ok: true as const,
        role: "bde" as const,
        bde: {
          points_progress: points,
          remaining_to_bdm: Math.max(0, BDE_TO_BDM_ACTIVE_SUBS - active),
          remaining_to_60: Math.max(0, 60 - active),
          at_risk_customers: active < 10 ? ["Grow active subscriptions to unlock BDM path."] : [],
        },
      });
    }

    if (role === SalesNetworkRole.BDM) {
      const team = await prisma.userCompany.findMany({
        where: {
          companyId,
          parentUserId: userId,
          salesNetworkRole: SalesNetworkRole.BDE,
          archivedAt: null,
        },
        select: {
          userId: true,
          user: { select: { name: true } },
          activeSubscriptionsCount: true,
        },
      });
      const weak = team.filter((t) => t.activeSubscriptionsCount < 5).map((t) => t.user.name);
      return NextResponse.json({
        ok: true as const,
        role: "bdm" as const,
        bdm: {
          team_performance: team.length,
          weak_bdes: weak,
          promotion_candidates: team.filter((t) => t.activeSubscriptionsCount >= 40).map((t) => t.user.name),
          slot_usage: { used: team.length, limit: membership?.bdeSlotLimit ?? 0 },
        },
      });
    }

    if (role === SalesNetworkRole.RSM) {
      const bdms = await prisma.userCompany.findMany({
        where: {
          companyId,
          parentUserId: userId,
          salesNetworkRole: SalesNetworkRole.BDM,
          archivedAt: null,
        },
        select: {
          userId: true,
          user: { select: { name: true } },
          region: true,
        },
      });
      return NextResponse.json({
        ok: true as const,
        role: "rsm" as const,
        rsm: {
          region: membership?.region ?? null,
          region_performance: bdms.length,
          top_bdms: bdms.slice(0, 5).map((b) => b.user.name),
          growth_alerts:
            bdms.length < BDM_TO_RSM_MIN_BDES
              ? [`Add ${BDM_TO_RSM_MIN_BDES - bdms.length} more BDMs to strengthen the region.`]
              : [],
        },
      });
    }

    if (role === SalesNetworkRole.BOSS) {
      const [subs, members] = await Promise.all([
        prisma.salesHierarchySubscription.count({
          where: { companyId, status: SalesHierarchySubscriptionStatus.ACTIVE },
        }),
        prisma.userCompany.count({ where: { companyId, archivedAt: null } }),
      ]);
      return NextResponse.json({
        ok: true as const,
        role: "boss" as const,
        boss: {
          platform_active_subscriptions: subs,
          network_members: members,
        },
      });
    }

    return NextResponse.json(
      { ok: false as const, error: "Unsupported role for insights", code: "FORBIDDEN" },
      { status: 403 },
    );
  } catch (e) {
    logCaughtError("GET /api/nexa/sales-insights", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load insights", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
