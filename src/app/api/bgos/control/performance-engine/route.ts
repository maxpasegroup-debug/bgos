import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";

function nowMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export async function GET(request: NextRequest) {
  const session = requireInternalPlatformApi(request);
  if (session instanceof NextResponse) return session;

  const { year, month } = nowMonth();
  const [growth, users, leads, commissionRules, bonusCampaigns, targets, mfPartners, mfTx] =
    await Promise.all([
      prisma.companyGrowthPlan.findMany({
        where: { company: { internalSalesOrg: false } },
        select: {
          companyId: true,
          targetRevenueOneMonth: true,
          targetLeadsOneMonth: true,
          company: { select: { name: true } },
        },
        take: 200,
      }),
      prisma.userCompany.findMany({
        where: {
          company: { internalSalesOrg: true },
          jobRole: { in: ["SALES_EXECUTIVE", "MANAGER"] as any },
        },
        select: {
          userId: true,
          user: { select: { name: true, email: true } },
        },
        take: 300,
      }),
      prisma.lead.findMany({
        where: { company: { internalSalesOrg: false } },
        select: {
          id: true,
          status: true,
          value: true,
          assignedTo: true,
          companyId: true,
          updatedAt: true,
        },
        take: 4000,
      }),
      prisma.commissionRule.findMany({ where: { isActive: true }, take: 100 }),
      prisma.bonusCampaign.findMany({
        where: { lifecycle: "ACTIVE" },
        take: 100,
      }),
      prisma.targetCampaign.findMany({
        where: { endDate: { gte: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.microFranchisePartner.findMany({
        select: { id: true, name: true, tier: true, user: { select: { name: true } } },
        take: 200,
      }),
      prisma.commissionTransaction.findMany({
        include: { partner: { select: { id: true, name: true } } },
        take: 400,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const salaryRows = await prisma.salesExecutiveMonthlyTarget.findMany({
    where: { periodYear: year, periodMonth: month },
    select: { userId: true, salaryRupees: true, targetCount: true },
    take: 400,
  });
  const salaryByUser = new Map(salaryRows.map((r) => [r.userId, r]));

  const activeCompanyIds = new Set(growth.map((g) => g.companyId));
  const leadsInScope = leads.filter((l) => activeCompanyIds.has(l.companyId));

  const companyAchievedRevenue = new Map<string, number>();
  const companyAchievedLeads = new Map<string, number>();
  for (const l of leadsInScope) {
    companyAchievedLeads.set(l.companyId, (companyAchievedLeads.get(l.companyId) ?? 0) + 1);
    if (l.status === LeadStatus.WON || l.status === LeadStatus.PROPOSAL_WON) {
      companyAchievedRevenue.set(l.companyId, (companyAchievedRevenue.get(l.companyId) ?? 0) + (l.value ?? 0));
    }
  }

  const companyTargets = growth.map((g) => {
    const monthlyTargetRevenue = g.targetRevenueOneMonth ?? 0;
    const weeklyTargetRevenue = monthlyTargetRevenue / 4;
    const dailyTargetRevenue = monthlyTargetRevenue / 30;
    const achievedRevenue = companyAchievedRevenue.get(g.companyId) ?? 0;
    const achievedLeads = companyAchievedLeads.get(g.companyId) ?? 0;
    const gap = Math.max(0, monthlyTargetRevenue - achievedRevenue);
    return {
      companyId: g.companyId,
      companyName: g.company.name,
      monthlyTargetRevenue,
      weeklyTargetRevenue,
      dailyTargetRevenue,
      monthlyTargetLeads: g.targetLeadsOneMonth ?? 0,
      achievedRevenue,
      achievedLeads,
      gapRemaining: gap,
      progressPercent: monthlyTargetRevenue > 0 ? Math.min(100, Math.round((achievedRevenue / monthlyTargetRevenue) * 100)) : 0,
    };
  });

  const baseCommissionPercent = commissionRules.length
    ? Math.max(...commissionRules.map((r) => Number(r.value) || 0))
    : 10;
  const defaultBonusThreshold = 20;
  const defaultBonusAmount = 5000;
  const salesTeam = users.map((u) => {
    const userLeads = leadsInScope.filter((l) => l.assignedTo === u.userId);
    const conversions = userLeads.filter((l) => l.status === LeadStatus.WON).length;
    const revenue = userLeads
      .filter((l) => l.status === LeadStatus.WON || l.status === LeadStatus.PROPOSAL_WON)
      .reduce((s, l) => s + (l.value ?? 0), 0);
    const conf = salaryByUser.get(u.userId);
    const baseSalary = conf?.salaryRupees ?? 0;
    const monthlyTarget = conf?.targetCount ?? 0;
    const commission = Math.round((revenue * baseCommissionPercent) / 100);
    const bonus = conversions >= defaultBonusThreshold ? defaultBonusAmount : 0;
    const payout = baseSalary + commission + bonus;
    return {
      userId: u.userId,
      name: u.user.name,
      email: u.user.email,
      baseSalary,
      monthlyTarget,
      commissionPercent: baseCommissionPercent,
      bonusRule: `Above ${defaultBonusThreshold} sales: +₹${defaultBonusAmount}`,
      leadsHandled: userLeads.length,
      conversions,
      revenueGenerated: revenue,
      targetCompletionPercent:
        monthlyTarget > 0 ? Math.min(100, Math.round((conversions / monthlyTarget) * 100)) : 0,
      expectedPayout: payout,
      activeCampaigns: targets.length,
    };
  });

  const franchiseById = new Map(
    mfPartners.map((p) => [p.id, { id: p.id, name: p.name, ownerName: p.user.name, tier: p.tier }]),
  );
  const tierPct: Record<string, number> = { BRONZE: 20, SILVER: 25, GOLD: 30 };
  const franchiseMap = new Map<
    string,
    {
      id: string;
      name: string;
      ownerName: string;
      tier: string;
      commissionPercent: number;
      totalSales: number;
      revenueGenerated: number;
      commissionEarned: number;
      pendingPayouts: number;
    }
  >();
  for (const tx of mfTx) {
    const p = franchiseById.get(tx.partnerId);
    if (!p) continue;
    const row = franchiseMap.get(tx.partnerId) ?? {
      id: p.id,
      name: p.name,
      ownerName: p.ownerName,
      tier: p.tier,
      commissionPercent: tierPct[p.tier] ?? 20,
      totalSales: 0,
      revenueGenerated: 0,
      commissionEarned: 0,
      pendingPayouts: 0,
    };
    row.totalSales += 1;
    row.commissionEarned += tx.amount;
    row.revenueGenerated += tx.amount / ((row.commissionPercent || 20) / 100);
    if (tx.status === "PENDING" || tx.status === "RELEASED") row.pendingPayouts += tx.amount;
    franchiseMap.set(tx.partnerId, row);
  }
  const microFranchise = [...franchiseMap.values()];

  const totalPayoutsMonthly = salesTeam.reduce((s, x) => s + x.expectedPayout, 0) + microFranchise.reduce((s, x) => s + x.pendingPayouts, 0);
  const totalRevenue = salesTeam.reduce((s, x) => s + x.revenueGenerated, 0);
  const salesVsPayoutRatio = totalPayoutsMonthly > 0 ? Number((totalRevenue / totalPayoutsMonthly).toFixed(2)) : 0;
  const topEarners = [...salesTeam]
    .sort((a, b) => b.expectedPayout - a.expectedPayout)
    .slice(0, 5)
    .map((x) => ({ id: x.userId, name: x.name, payout: x.expectedPayout }));

  const nearingBonus = salesTeam.filter((s) => s.conversions >= defaultBonusThreshold - 3 && s.conversions < defaultBonusThreshold).length;
  const nexa = [
    "Increase target for top performer",
    `${nearingBonus} employees close to bonus`,
    "Run campaign to boost sales",
  ];

  return NextResponse.json({
    ok: true as const,
    tabs: {
      companyTargets,
      salesTeam,
      microFranchise,
      rewardsCampaigns: {
        campaigns: targets.map((t) => ({
          id: t.id,
          name: t.title,
          duration: `${new Date(t.startDate).toLocaleDateString()} - ${new Date(t.endDate).toLocaleDateString()}`,
          condition: `${t.metricType} >= ${t.targetNumber}`,
          progressPercent: 0,
          remainingTarget: t.targetNumber,
          countdownMs: Math.max(0, new Date(t.endDate).getTime() - Date.now()),
        })),
        bonusCampaigns,
      },
      payoutAnalytics: {
        totalPayoutsMonthly,
        salesVsPayoutRatio,
        topEarners,
        commissionBreakdown: {
          salesCommission: salesTeam.reduce((s, x) => s + Math.round((x.revenueGenerated * x.commissionPercent) / 100), 0),
          franchiseCommission: microFranchise.reduce((s, x) => s + x.commissionEarned, 0),
        },
      },
    },
    nexa,
  });
}
