import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  const p = (await prisma.microFranchisePartner.findUnique({
    where: { id },
    include: {
      wallet: true,
      commissionPlan: true,
      companies: {
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          createdAt: true,
        },
      },
      commissionTransactions: {
        orderBy: { createdAt: "desc" },
        take: 120,
      },
      application: {
        select: { id: true, name: true, email: true, location: true, status: true, createdAt: true, notes: true },
      },
    } as any,
  })) as any;
  if (!p) {
    return NextResponse.json({ ok: false as const, error: "Partner not found" }, { status: 404 });
  }

  const totalReferrals = p.companies.length;
  const activeCompanies = p.companies.filter(
    (c: any) => c.subscriptionStatus === "ACTIVE" || c.subscriptionStatus === "TRIAL",
  ).length;
  const totalRevenue = p.commissionTransactions.reduce((acc: number, t: any) => acc + t.amount, 0);

  return NextResponse.json({
    ok: true as const,
    partner: {
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      referralId: p.phone,
      tier: p.tier,
      score: p.performanceScore,
      wallet: p.wallet,
      plan: p.commissionPlan,
      application: p.application,
      performance: {
        totalReferrals,
        activeCompanies,
        revenueGenerated: totalRevenue,
      },
      transactions: p.commissionTransactions,
      companies: p.companies,
    },
  });
}
