import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

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
      company: { select: { name: true, internalSalesOrg: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const customerPayments = payments.filter((p) => !p.company.internalSalesOrg);
  const totalRevenueInr = customerPayments.reduce((s, p) => s + (p.currency === "INR" ? p.amount : 0), 0);

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

  return NextResponse.json({
    ok: true as const,
    totalRevenueInr,
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
  });
}
