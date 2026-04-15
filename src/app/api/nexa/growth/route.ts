import { IceconnectMetroStage, LeadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { DEFAULT_GROWTH_TARGETS, buildGrowthOutput } from "@/lib/nexa-growth-engine";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/route-error";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  try {
    const now = new Date();
    const dayStart = startOfDay(now);
    const weekStart = new Date(dayStart.getTime() - 6 * 86400000);
    const monthStart = startOfMonth(now);

    const [
      leadsAddedToday,
      leadsConverted,
      onboardingCountWeek,
      onboardingCountMonth,
      revenueThisMonthAgg,
      totalLeads,
      funnelCounts,
      allCreatedLast14Days,
      clientsWithoutSubscription,
      userMetricsRows,
      companyMetricsRows,
      franchiseMetricsRows,
      regionRows,
    ] = await Promise.all([
      prisma.lead.count({ where: { companyId: session.companyId, createdAt: { gte: dayStart } } }),
      prisma.lead.count({ where: { companyId: session.companyId, status: LeadStatus.WON, createdAt: { gte: monthStart } } }),
      prisma.onboarding.count({
        where: { companyId: session.companyId, status: "COMPLETED", createdAt: { gte: weekStart } },
      }),
      prisma.onboarding.count({
        where: { companyId: session.companyId, status: "COMPLETED", createdAt: { gte: monthStart } },
      }),
      prisma.payment.aggregate({
        where: { companyId: session.companyId, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.lead.count({ where: { companyId: session.companyId } }),
      prisma.lead.findMany({
        where: { companyId: session.companyId },
        select: { internalSalesStage: true, iceconnectMetroStage: true },
      }),
      prisma.lead.findMany({
        where: { companyId: session.companyId, createdAt: { gte: new Date(dayStart.getTime() - 13 * 86400000) } },
        select: { createdAt: true },
      }),
      prisma.lead.count({
        where: {
          companyId: session.companyId,
          status: LeadStatus.WON,
          OR: [
            { iceconnectMetroStage: null },
            { iceconnectMetroStage: { not: IceconnectMetroStage.SUBSCRIPTION } },
          ],
        },
      }),
      prisma.lead.groupBy({
        by: ["assignedTo"],
        where: { companyId: session.companyId, assignedTo: { not: null } },
        _count: { id: true },
      }),
      prisma.company.findMany({
        where: { ownerId: session.sub },
        select: { id: true, name: true },
      }),
      prisma.microFranchisePartner.findMany({
        where: { companies: { some: { id: session.companyId } } },
        select: {
          id: true,
          name: true,
          companies: {
            select: {
              leads: { select: { id: true } },
              payments: { where: { createdAt: { gte: monthStart } }, select: { amount: true } },
            },
          },
        },
      }),
      prisma.lead.findMany({
        where: { companyId: session.companyId, iceconnectLocation: { not: null } },
        select: { iceconnectLocation: true, status: true },
      }),
    ]);

    const conversionRate = totalLeads > 0 ? Math.round((leadsConverted / totalLeads) * 1000) / 10 : 0;
    const revenueThisMonth = Number(revenueThisMonthAgg._sum.amount ?? 0);

    let demo = 0;
    let followUp = 0;
    let onboarding = 0;
    let subscription = 0;
    for (const row of funnelCounts) {
      if (row.internalSalesStage === "DEMO_ORIENTATION" || row.iceconnectMetroStage === IceconnectMetroStage.DEMO_DONE) demo += 1;
      if (row.internalSalesStage === "FOLLOW_UP" || row.iceconnectMetroStage === IceconnectMetroStage.FOLLOW_UP) followUp += 1;
      if (row.internalSalesStage === "ONBOARDING_FORM_FILLED" || row.internalSalesStage === "BOSS_APPROVAL_PENDING") onboarding += 1;
      if (row.iceconnectMetroStage === IceconnectMetroStage.SUBSCRIPTION) subscription += 1;
    }

    const daysWithLeads = new Set(allCreatedLast14Days.map((l) => isoDay(l.createdAt)));
    let streakDays = 0;
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(dayStart.getTime() - i * 86400000);
      if (daysWithLeads.has(isoDay(d))) streakDays += 1;
      else break;
    }

    const growth = buildGrowthOutput({
      now,
      metrics: {
        leadsAddedToday,
        leadsConverted,
        onboardingCountWeek,
        onboardingCountMonth,
        revenueThisMonth,
        conversionRate,
      },
      targets: DEFAULT_GROWTH_TARGETS,
      funnel: {
        leads: totalLeads,
        demo,
        followUp,
        onboarding,
        subscription,
      },
      streakDays,
      hasClientsWithoutSubscription: clientsWithoutSubscription > 0,
    });

    const userMetrics = userMetricsRows.map((r) => ({
      userId: r.assignedTo,
      leads: r._count.id,
    }));
    const companyIds = companyMetricsRows.map((c) => c.id);
    const [companyLeadAgg, companyOnboardingAgg, companyRevenueAgg] = await Promise.all([
      prisma.lead.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds } },
        _count: { id: true },
      }),
      prisma.onboarding.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, status: "COMPLETED", createdAt: { gte: monthStart } },
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);
    const leadMap = new Map(companyLeadAgg.map((x) => [x.companyId, x._count.id]));
    const onboardingMap = new Map(companyOnboardingAgg.map((x) => [x.companyId ?? "", x._count.id]));
    const revenueMap = new Map(companyRevenueAgg.map((x) => [x.companyId, Number(x._sum.amount ?? 0)]));
    const companyMetrics = companyMetricsRows.map((c) => ({
      companyId: c.id,
      companyName: c.name,
      leads: leadMap.get(c.id) ?? 0,
      onboardingCount: onboardingMap.get(c.id) ?? 0,
      revenue: revenueMap.get(c.id) ?? 0,
    }));
    const franchiseMetrics = franchiseMetricsRows.map((f) => ({
      franchiseId: f.id,
      franchiseName: f.name,
      leads: f.companies.reduce((acc, c) => acc + c.leads.length, 0),
      revenue: f.companies.reduce((acc, c) => acc + c.payments.reduce((a, p) => a + p.amount, 0), 0),
    }));
    const regionMap = new Map<string, { leads: number; won: number }>();
    for (const r of regionRows) {
      const k = String(r.iceconnectLocation ?? "Unknown");
      const curr = regionMap.get(k) ?? { leads: 0, won: 0 };
      curr.leads += 1;
      if (r.status === LeadStatus.WON) curr.won += 1;
      regionMap.set(k, curr);
    }
    const growthByRegion = [...regionMap.entries()].map(([region, value]) => ({
      region,
      leads: value.leads,
      won: value.won,
    }));

    return jsonSuccess({
      growth,
      perUser: userMetrics,
      perCompany: companyMetrics,
      perFranchise: franchiseMetrics,
      bossView: {
        topPerformers: [...userMetrics].sort((a, b) => b.leads - a.leads).slice(0, 5),
        weakPerformers: [...userMetrics].sort((a, b) => a.leads - b.leads).slice(0, 5),
        growthByRegion,
      },
      leadGenerationSuggestions: ["Phone contacts", "Old clients", "Referrals"],
    });
  } catch (e) {
    return handleApiError("GET /api/nexa/growth", e);
  }
}
