import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SalesHierarchySubscriptionStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { requireInternalSalesSession, scopedSubscriptionsWhere } from "@/lib/internal-sales-access";

/**
 * GET /api/internal/sales/subscriptions
 *
 * Returns subscriptions scoped to the caller's role.
 * Query params:
 *   ?status=active|cancelled  — filter by status (default: all)
 *   ?take=50                  — page size (max 200)
 *   ?skip=0                   — offset
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  try {
    const sp = request.nextUrl.searchParams;
    const statusParam = sp.get("status");
    const take = Math.min(200, Math.max(1, parseInt(sp.get("take") ?? "50", 10) || 50));
    const skip = Math.max(0, parseInt(sp.get("skip") ?? "0", 10) || 0);

    const now = new Date();
    const baseWhere = await scopedSubscriptionsWhere(session);

    let statusFilter: object = {};
    if (statusParam === "active") {
      statusFilter = {
        status: SalesHierarchySubscriptionStatus.ACTIVE,
        expiresAt: { gte: now },
      };
    } else if (statusParam === "cancelled") {
      statusFilter = { status: SalesHierarchySubscriptionStatus.CANCELLED };
    }

    const where = { ...baseWhere, ...statusFilter };

    const [items, total] = await Promise.all([
      prisma.salesHierarchySubscription.findMany({
        where,
        select: {
          id: true,
          ownerUserId: true,
          planType: true,
          points: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          owner: { select: { name: true, email: true } },
        },
        orderBy: { startedAt: "desc" },
        take,
        skip,
      }),
      prisma.salesHierarchySubscription.count({ where }),
    ]);

    // Active = ACTIVE status AND not expired
    const activeCount = await prisma.salesHierarchySubscription.count({
      where: {
        ...baseWhere,
        status: SalesHierarchySubscriptionStatus.ACTIVE,
        expiresAt: { gte: now },
      },
    });

    return NextResponse.json({
      ok: true as const,
      total,
      activeCount,
      take,
      skip,
      items: items.map((s) => ({
        id: s.id,
        ownerUserId: s.ownerUserId,
        ownerName: s.owner.name,
        ownerEmail: s.owner.email,
        planType: s.planType,
        points: s.points,
        status: s.status,
        isActive: s.status === SalesHierarchySubscriptionStatus.ACTIVE && s.expiresAt >= now,
        startedAt: s.startedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError("GET /api/internal/sales/subscriptions", e);
  }
}
