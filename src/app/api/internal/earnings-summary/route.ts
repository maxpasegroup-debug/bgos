import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NetworkCommissionType } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { getInternalMembership } from "@/lib/internal-platform/get-internal-membership";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * INR totals from sales hierarchy earnings + network commissions for the internal org member.
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

    const companyId = m.companyId;
    const userId = session.sub;
    const now = new Date();
    const sod = startOfDay(now);
    const som = startOfMonth(now);

    const [hierarchyToday, hierarchyMonth, hierarchyTotal, netToday, netMonth, netTotal, overrideTotal, recurringTotal] =
      await Promise.all([
        prisma.salesHierarchyEarning
          .aggregate({
            where: { companyId, userId, createdAt: { gte: sod } },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
        prisma.salesHierarchyEarning
          .aggregate({
            where: { companyId, userId, createdAt: { gte: som } },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
        prisma.salesHierarchyEarning
          .aggregate({
            where: { companyId, userId },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
        prisma.networkCommission
          .aggregate({
            where: { companyId, userId, createdAt: { gte: sod } },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
        prisma.networkCommission
          .aggregate({
            where: { companyId, userId, createdAt: { gte: som } },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
        prisma.networkCommission
          .aggregate({
            where: { companyId, userId },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
        prisma.networkCommission
          .aggregate({
            where: { companyId, userId, type: NetworkCommissionType.OVERRIDE },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
        prisma.networkCommission
          .aggregate({
            where: { companyId, userId, type: NetworkCommissionType.RECURRING },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null as number | null } })),
      ]);

    const today =
      (hierarchyToday._sum.amount ?? 0) + (netToday._sum.amount ?? 0);
    const month =
      (hierarchyMonth._sum.amount ?? 0) + (netMonth._sum.amount ?? 0);
    const total =
      (hierarchyTotal._sum.amount ?? 0) + (netTotal._sum.amount ?? 0);

    return NextResponse.json({
      ok: true as const,
      currency: "INR" as const,
      today_inr: Math.round(today * 100) / 100,
      month_inr: Math.round(month * 100) / 100,
      total_inr: Math.round(total * 100) / 100,
      override_inr: Math.round((overrideTotal._sum.amount ?? 0) * 100) / 100,
      recurring_inr: Math.round((recurringTotal._sum.amount ?? 0) * 100) / 100,
    });
  } catch (e) {
    logCaughtError("GET /api/internal/earnings-summary", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not load earnings", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
