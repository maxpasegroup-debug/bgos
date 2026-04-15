import "server-only";

import { prisma } from "@/lib/prisma";

type GrowthMetrics = {
  partnerId: string;
  totalRevenue: number;
  revenueLast30: number;
  revenuePrev30: number;
  growthPercent: number;
  activeClients: number;
  totalClients: number;
  score: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  forecastNext30: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pickTier(score: number): GrowthMetrics["tier"] {
  if (score >= 80) return "PLATINUM";
  if (score >= 60) return "GOLD";
  if (score >= 35) return "SILVER";
  return "BRONZE";
}

export function scorePartnerFromMetrics(input: {
  totalRevenue: number;
  activeClients: number;
  growthPercent: number;
  txLast60: number;
}): { score: number; tier: GrowthMetrics["tier"] } {
  const revenueScore = clamp((input.totalRevenue / 150_000) * 40, 0, 40);
  const clientsScore = clamp((input.activeClients / 12) * 25, 0, 25);
  const growthScore = clamp(((input.growthPercent + 30) / 90) * 20, 0, 20);
  const consistencyScore = clamp((input.txLast60 / 12) * 15, 0, 15);
  const score = Math.round(clamp(revenueScore + clientsScore + growthScore + consistencyScore, 0, 100));
  return { score, tier: pickTier(score) };
}

export async function computePartnerGrowthMetrics(): Promise<GrowthMetrics[]> {
  const now = Date.now();
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

  const partners = await prisma.microFranchisePartner.findMany({
    include: {
      companies: {
        select: { id: true, subscriptionStatus: true, createdAt: true },
      },
      commissionTransactions: {
        select: { amount: true, createdAt: true },
      },
    },
  });

  return partners.map((p) => {
    const tx = p.commissionTransactions;
    const totalRevenue = tx.reduce((acc, t) => acc + t.amount, 0);
    const revenueLast30 = tx
      .filter((t) => t.createdAt >= d30)
      .reduce((acc, t) => acc + t.amount, 0);
    const revenuePrev30 = tx
      .filter((t) => t.createdAt >= d60 && t.createdAt < d30)
      .reduce((acc, t) => acc + t.amount, 0);
    const txLast60 = tx.filter((t) => t.createdAt >= d60).length;

    const growthPercent =
      revenuePrev30 > 0
        ? Math.round(((revenueLast30 - revenuePrev30) / revenuePrev30) * 1000) / 10
        : revenueLast30 > 0
          ? 100
          : 0;

    const activeClients = p.companies.filter(
      (c) => c.subscriptionStatus === "ACTIVE" || c.subscriptionStatus === "TRIAL",
    ).length;
    const totalClients = p.companies.length;

    const { score, tier } = scorePartnerFromMetrics({
      totalRevenue,
      activeClients,
      growthPercent,
      txLast60,
    });
    const growthFactor = clamp(growthPercent, -35, 60) / 100;
    const forecastNext30 = Math.max(0, Math.round((revenueLast30 * (1 + growthFactor)) * 100) / 100);

    return {
      partnerId: p.id,
      totalRevenue,
      revenueLast30,
      revenuePrev30,
      growthPercent,
      activeClients,
      totalClients,
      score,
      tier,
      forecastNext30,
    };
  });
}

export async function recomputePartnerScoresAndAlerts(): Promise<{
  updatedPartners: number;
  alertsCreated: number;
}> {
  const metrics = await computePartnerGrowthMetrics();
  let alertsCreated = 0;
  await prisma.$transaction(async (tx) => {
    for (const m of metrics) {
      await tx.microFranchisePartner.update({
        where: { id: m.partnerId },
        data: {
          performanceScore: m.score,
          tier: m.tier,
          lastScoredAt: new Date(),
        },
      });

      const open = await tx.microFranchiseAlert.findMany({
        where: { partnerId: m.partnerId, status: "OPEN" },
        select: { id: true, type: true },
      });
      const openTypes = new Set(open.map((a) => a.type));
      const toCreate: Array<{ type: string; severity: string; title: string; message: string }> = [];

      if (m.revenueLast30 <= 0 && m.totalRevenue > 0 && !openTypes.has("INACTIVE")) {
        toCreate.push({
          type: "INACTIVE",
          severity: "HIGH",
          title: "Franchise inactive",
          message: "No commission activity in the last 30 days.",
        });
      }
      if (m.growthPercent <= -20 && !openTypes.has("RISK")) {
        toCreate.push({
          type: "RISK",
          severity: "MEDIUM",
          title: "Revenue drop risk",
          message: `Revenue dropped ${Math.abs(m.growthPercent).toFixed(1)}% versus previous 30 days.`,
        });
      }
      if (m.growthPercent >= 20 && !openTypes.has("GROWTH")) {
        toCreate.push({
          type: "GROWTH",
          severity: "LOW",
          title: "Growth opportunity",
          message: "Strong momentum detected. Consider assigning a higher commission offer.",
        });
      }

      if (toCreate.length) {
        await tx.microFranchiseAlert.createMany({
          data: toCreate.map((a) => ({ partnerId: m.partnerId, ...a })),
        });
        alertsCreated += toCreate.length;
      }
    }
  });

  return { updatedPartners: metrics.length, alertsCreated };
}
