import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesHierarchySubscriptionStatus, SalesNetworkRole, UserRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { isSuperBossEmail } from "@/lib/super-boss";

/**
 * High-level platform metrics for internal boss / super boss control surface.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;

    const superOk = session.superBoss === true && isSuperBossEmail(session.email);
    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }

    const companyId = org.companyId;
    const now = new Date();

    const membership = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: session.sub, companyId } },
      select: { salesNetworkRole: true },
    });
    const snr = membership?.salesNetworkRole;
    const allowed = superOk || snr === SalesNetworkRole.BOSS;
    if (!allowed) {
      return NextResponse.json(
        { ok: false as const, error: "Forbidden", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const [subsActive, execCount, revenueSum, techCount, rsmSlots] = await Promise.all([
      prisma.salesHierarchySubscription.count({
        where: {
          companyId,
          status: SalesHierarchySubscriptionStatus.ACTIVE,
          expiresAt: { gte: now },
        },
      }).catch(() => 0),
      prisma.userCompany.count({
        where: {
          companyId,
          archivedAt: null,
          salesNetworkRole: { in: [SalesNetworkRole.BDE, SalesNetworkRole.BDM, SalesNetworkRole.RSM] },
        },
      }).catch(() => 0),
      prisma.salesHierarchyEarning
        .aggregate({ where: { companyId }, _sum: { amount: true } })
        .catch(() => ({ _sum: { amount: 0 as number | null } })),
      prisma.userCompany.count({
        where: {
          companyId,
          archivedAt: null,
          OR: [{ salesNetworkRole: SalesNetworkRole.TECH_EXEC }, { jobRole: UserRole.TECH_EXECUTIVE }],
        },
      }).catch(() => 0),
      prisma.userCompany.count({
        where: { companyId, archivedAt: null, salesNetworkRole: SalesNetworkRole.RSM },
      }).catch(() => 0),
    ]);

    return NextResponse.json({
      ok: true as const,
      metrics: {
        total_sales_inr: Math.round((revenueSum._sum.amount ?? 0) * 100) / 100,
        active_subscriptions: subsActive,
        network_executives: execCount,
        tech_exec_count: techCount,
        rsm_count: rsmSlots,
      },
    });
  } catch (e) {
    logCaughtError("GET /api/internal/boss-metrics", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load metrics", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
