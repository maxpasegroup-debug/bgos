import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const cacheKey = "control:accounts-overview";
    const cached = getApiCache<{
      totalRevenueInr: number;
      mrr: number;
      pendingPayments: number;
      activePlans: { trialCompanies: number; paidCompanies: number };
      renewalsUpcoming30d: number;
      recentPayments: {
        companyId: string;
        companyName: string;
        amount: number;
        currency: string;
        status: string;
        createdAt: string;
      }[];
      companyBilling: { companyId: string; name: string; totalInr: number; payments: number }[];
      planBreakdown: Record<string, number>;
      industryBreakdown: Record<string, number>;
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true as const, ...cached });
    }

    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const payments = await prisma.razorpayPayment.findMany({
      where: {
        status: { in: ["captured", "paid", "completed", "COMPLETED"] },
      },
      select: {
        companyId: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        company: { select: { name: true, internalSalesOrg: true, plan: true, industry: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const customerPayments = payments.filter((p) => !p.company.internalSalesOrg);
    const totalRevenueInr = customerPayments.reduce((s, p) => s + (p.currency === "INR" ? p.amount : 0), 0);
    const now = new Date();
    const mrr = customerPayments
      .filter((p) => p.createdAt.getMonth() === now.getMonth() && p.createdAt.getFullYear() === now.getFullYear())
      .reduce((s, p) => s + (p.currency === "INR" ? p.amount : 0), 0);
    const pendingPayments = payments
      .filter((p) => ["created", "pending", "authorized"].includes(String(p.status).toLowerCase()))
      .reduce((s, p) => s + (p.currency === "INR" ? p.amount : 0), 0);

    const [activeTrials, activePaid, expiringSoon] = await Promise.all([
      prisma.company.count({
        where: { internalSalesOrg: false, subscriptionStatus: "TRIAL" },
      }),
      prisma.company.count({
        where: { internalSalesOrg: false, subscriptionStatus: "ACTIVE" },
      }),
      prisma.company.count({
        where: {
          internalSalesOrg: false,
          subscriptionStatus: "ACTIVE",
          subscriptionPeriodEnd: { lte: thirtyDays, gte: new Date() },
        },
      }),
    ]);

    const byCompanyMap = new Map<
      string,
      { companyId: string; name: string; totalInr: number; payments: number }
    >();
    for (const p of customerPayments) {
      const row = byCompanyMap.get(p.companyId) ?? {
        companyId: p.companyId,
        name: p.company.name,
        totalInr: 0,
        payments: 0,
      };
      if (p.currency === "INR") row.totalInr += p.amount;
      row.payments += 1;
      byCompanyMap.set(p.companyId, row);
    }
    const companyBilling = [...byCompanyMap.values()].sort((a, b) => b.totalInr - a.totalInr);
    const planBreakdown: Record<string, number> = {};
    const industryBreakdown: Record<string, number> = {};
    for (const p of customerPayments) {
      if (p.currency !== "INR") continue;
      const plan = String(p.company.plan ?? "BASIC");
      const ind = String(p.company.industry ?? "CUSTOM");
      planBreakdown[plan] = (planBreakdown[plan] ?? 0) + p.amount;
      industryBreakdown[ind] = (industryBreakdown[ind] ?? 0) + p.amount;
    }

    const payload = {
      ok: true as const,
      totalRevenueInr,
      mrr,
      pendingPayments,
      activePlans: {
        trialCompanies: activeTrials,
        paidCompanies: activePaid,
      },
      renewalsUpcoming30d: expiringSoon,
      recentPayments: customerPayments.slice(0, 40).map((p) => ({
        companyId: p.companyId,
        companyName: p.company.name,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      companyBilling,
      planBreakdown,
      industryBreakdown,
    };
    setApiCache(cacheKey, {
      totalRevenueInr: payload.totalRevenueInr,
      mrr: payload.mrr,
      pendingPayments: payload.pendingPayments,
      activePlans: payload.activePlans,
      renewalsUpcoming30d: payload.renewalsUpcoming30d,
      recentPayments: payload.recentPayments,
      companyBilling: payload.companyBilling,
      planBreakdown: payload.planBreakdown,
      industryBreakdown: payload.industryBreakdown,
    });
    return NextResponse.json(payload);
  } catch (e) {
    logCaughtError("GET /api/bgos/control/accounts-overview", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load accounts overview",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
