import { NextResponse } from "next/server";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { computePartnerGrowthMetrics } from "@/lib/micro-franchise-growth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const metrics = await computePartnerGrowthMetrics();
  const partnerIds = metrics.map((m) => m.partnerId);
  const [partners, alerts, applications] = await Promise.all([
    prisma.microFranchisePartner.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, name: true, phone: true, tier: true, performanceScore: true },
    }),
    prisma.microFranchiseAlert.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, partnerId: true, type: true, severity: true, title: true, message: true, createdAt: true },
    }),
    prisma.microFranchiseApplication.findMany({
      where: { assignedToId: { not: null } },
      select: { assignedToId: true, status: true },
    }),
  ]);
  const partnerMap = new Map(partners.map((p) => [p.id, p]));
  const metricMap = new Map(metrics.map((m) => [m.partnerId, m]));

  const topForecasts = metrics
    .slice()
    .sort((a, b) => b.forecastNext30 - a.forecastNext30)
    .slice(0, 8)
    .map((m) => {
      const p = partnerMap.get(m.partnerId);
      return {
        partnerId: m.partnerId,
        name: p?.name ?? "Unknown",
        tier: p?.tier ?? m.tier,
        forecastNext30: m.forecastNext30,
        growth: m.growthPercent,
      };
    });

  const suggestions = metrics
    .map((m) => {
      const p = partnerMap.get(m.partnerId);
      if (!p) return null;
      if (m.growthPercent >= 20 && p.tier !== "PLATINUM") {
        return {
          partnerId: p.id,
          partnerName: p.name,
          rule: "UPGRADE_TIER",
          message: "Sustained growth detected. Consider upgrading tier and applying 5% commission boost.",
        };
      }
      if (m.revenueLast30 <= 0 && m.totalRevenue > 0) {
        return {
          partnerId: p.id,
          partnerName: p.name,
          rule: "RECOVERY_CALL",
          message: "Inactive in last 30 days. Assign executive follow-up and recovery offer.",
        };
      }
      if (m.activeClients >= 8 && m.growthPercent >= 10) {
        return {
          partnerId: p.id,
          partnerName: p.name,
          rule: "BOOST_OFFER",
          message: "High-performing cluster. Launch recurring offer with instant bonus.",
        };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .slice(0, 10);

  const execStatsMap = new Map<string, { assigned: number; live: number }>();
  for (const app of applications) {
    if (!app.assignedToId) continue;
    const curr = execStatsMap.get(app.assignedToId) ?? { assigned: 0, live: 0 };
    curr.assigned += 1;
    if (app.status === "LIVE") curr.live += 1;
    execStatsMap.set(app.assignedToId, curr);
  }
  const execIds = [...execStatsMap.keys()];
  const execUsers = execIds.length
    ? await prisma.user.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true, email: true } })
    : [];
  const executivePerformance = execUsers
    .map((u) => {
      const s = execStatsMap.get(u.id) ?? { assigned: 0, live: 0 };
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        assigned: s.assigned,
        live: s.live,
        conversion: s.assigned > 0 ? Math.round((s.live / s.assigned) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.conversion - a.conversion || b.live - a.live);

  const hydratedAlerts = alerts.map((a) => ({
    ...a,
    partnerName: partnerMap.get(a.partnerId)?.name ?? "Unknown",
    tier: partnerMap.get(a.partnerId)?.tier ?? metricMap.get(a.partnerId)?.tier ?? "BRONZE",
  }));

  return NextResponse.json({
    ok: true,
    forecasts: topForecasts,
    suggestions,
    alerts: hydratedAlerts,
    executivePerformance,
  });
}
