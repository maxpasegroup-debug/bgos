import { NextResponse } from "next/server";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { computePartnerGrowthMetrics } from "@/lib/micro-franchise-growth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const metrics = await computePartnerGrowthMetrics();
  const partners = (await prisma.microFranchisePartner.findMany({
    select: { id: true, name: true, phone: true, tier: true, performanceScore: true } as any,
  })) as any[];
  const byId = new Map(partners.map((p) => [p.id, p]));

  const leaderboard = metrics
    .map((m) => {
      const p = byId.get(m.partnerId);
      return {
        id: m.partnerId,
        name: p?.name ?? "Unknown",
        phone: p?.phone ?? "",
        tier: p?.tier ?? m.tier,
        score: p?.performanceScore ?? m.score,
        revenue: Math.round(m.totalRevenue * 100) / 100,
        activeClients: m.activeClients,
        growth: m.growthPercent,
      };
    })
    .sort((a, b) => b.score - a.score || b.revenue - a.revenue || b.activeClients - a.activeClients);

  return NextResponse.json({ ok: true, items: leaderboard });
}
