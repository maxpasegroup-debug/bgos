import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalSalesSession, scopedEarningsWhere } from "@/lib/internal-sales-access";
import { getMonthlyStats } from "@/lib/internal-sales-engine";

/**
 * GET /api/internal/sales/earnings
 *
 * Returns earnings visible to the caller's role (BDE=own, BDM=team, RSM=region, BOSS=all).
 * Query params:
 *   ?months=6     — window for monthly stats (default 6)
 *   ?userId=...   — filter to a specific user (BOSS/RSM/BDM only)
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  try {
    const sp = request.nextUrl.searchParams;
    const months = Math.min(24, Math.max(1, parseInt(sp.get("months") ?? "6", 10) || 6));

    const baseWhere = await scopedEarningsWhere(session);

    // Optional per-user drill-down (for BDM/RSM/BOSS)
    const filterUserId = sp.get("userId")?.trim();
    const where = filterUserId
      ? { ...baseWhere, userId: filterUserId }
      : baseWhere;

    const [earnings, totalAgg] = await Promise.all([
      prisma.salesHierarchyEarning.findMany({
        where,
        select: {
          id: true,
          userId: true,
          sourceUserId: true,
          amount: true,
          type: true,
          createdAt: true,
          subscriptionId: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.salesHierarchyEarning.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    // Monthly stats for the caller (always self for monthly breakdown)
    const monthly = await getMonthlyStats(session.companyId, session.userId, months);

    return NextResponse.json({
      ok: true as const,
      totalAmount: totalAgg._sum.amount ?? 0,
      totalCount: totalAgg._count._all,
      earnings: earnings.map((e) => ({
        id: e.id,
        userId: e.userId,
        sourceUserId: e.sourceUserId,
        amount: e.amount,
        type: e.type,
        subscriptionId: e.subscriptionId,
        createdAt: e.createdAt.toISOString(),
      })),
      monthly,
    });
  } catch (e) {
    return handleApiError("GET /api/internal/sales/earnings", e);
  }
}
