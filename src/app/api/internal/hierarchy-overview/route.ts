import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesHierarchySubscriptionStatus, SalesNetworkRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

export type HierarchyNode = {
  user_id: string;
  name: string | null;
  email: string;
  role: SalesNetworkRole | null;
  region: string | null;
  total_points: number;
  active_subscriptions_count: number;
  children: HierarchyNode[];
};

function buildTree(
  rows: {
    userId: string;
    parentUserId: string | null;
    salesNetworkRole: SalesNetworkRole | null;
    region: string | null;
    totalPoints: number;
    activeSubscriptionsCount: number;
    user: { name: string | null; email: string };
  }[],
): HierarchyNode[] {
  const map = new Map<string, HierarchyNode>();
  for (const r of rows) {
    map.set(r.userId, {
      user_id: r.userId,
      name: r.user.name,
      email: r.user.email,
      role: r.salesNetworkRole,
      region: r.region,
      total_points: r.totalPoints,
      active_subscriptions_count: r.activeSubscriptionsCount,
      children: [],
    });
  }
  const roots: HierarchyNode[] = [];
  for (const r of rows) {
    const node = map.get(r.userId)!;
    if (r.parentUserId && map.has(r.parentUserId)) {
      map.get(r.parentUserId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Region + hierarchy snapshot for RSM / internal boss dashboards.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const companyId = org.companyId;
    const now = new Date();

    const members = await prisma.userCompany.findMany({
      where: {
        companyId,
        archivedAt: null,
        salesNetworkRole: { in: [SalesNetworkRole.RSM, SalesNetworkRole.BDM, SalesNetworkRole.BDE, SalesNetworkRole.BOSS] },
      },
      select: {
        userId: true,
        parentUserId: true,
        salesNetworkRole: true,
        region: true,
        totalPoints: true,
        activeSubscriptionsCount: true,
        user: { select: { name: true, email: true } },
      },
    });

    const [activeSubs, revenueAgg] = await Promise.all([
      prisma.salesHierarchySubscription
        .count({
          where: {
            companyId,
            status: SalesHierarchySubscriptionStatus.ACTIVE,
            expiresAt: { gte: now },
          },
        })
        .catch(() => 0),
      prisma.salesHierarchyEarning
        .aggregate({
          where: { companyId },
          _sum: { amount: true },
        })
        .catch(() => ({ _sum: { amount: 0 as number | null } })),
    ]);

    const bdeCount = members.filter((m) => m.salesNetworkRole === SalesNetworkRole.BDE).length;
    const bdmCount = members.filter((m) => m.salesNetworkRole === SalesNetworkRole.BDM).length;
    const rsmCount = members.filter((m) => m.salesNetworkRole === SalesNetworkRole.RSM).length;

    const tree = buildTree(members);

    const top = [...members]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 8)
      .map((m) => ({
        user_id: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.salesNetworkRole,
        total_points: m.totalPoints,
      }));

    const weak = [...members]
      .filter((m) => m.salesNetworkRole === SalesNetworkRole.BDE && m.activeSubscriptionsCount < 3)
      .sort((a, b) => a.activeSubscriptionsCount - b.activeSubscriptionsCount)
      .slice(0, 8)
      .map((m) => ({
        user_id: m.userId,
        name: m.user.name,
        email: m.user.email,
        active_subscriptions_count: m.activeSubscriptionsCount,
      }));

    return NextResponse.json({
      ok: true as const,
      totals: {
        revenue_inr: Math.round((revenueAgg._sum.amount ?? 0) * 100) / 100,
        active_subscriptions: activeSubs,
        bde_count: bdeCount,
        bdm_count: bdmCount,
        rsm_count: rsmCount,
        executives: members.length,
      },
      tree,
      top_performers: top,
      weak_performers: weak,
    });
  } catch (e) {
    logCaughtError("GET /api/internal/hierarchy-overview", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load hierarchy", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
