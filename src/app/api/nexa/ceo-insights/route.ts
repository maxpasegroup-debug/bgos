import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NexaTaskStatus, SalesNetworkRole } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { formatNexaFramework } from "@/lib/nexa-voice/framework";
import { NEXA_VOICE_VERSION } from "@/lib/nexa-voice/personality";

/**
 * Platform CEO insights (super boss). Uses internal sales org when available for hierarchy signals.
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    const internalCompanyId = "error" in org ? null : org.companyId;
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    const [revenue7d, weakRegions, topPerformers, underBdes, alerts] = await Promise.all([
      prisma.invoicePayment
        .aggregate({
          where: { date: { gte: new Date(now.getTime() - 7 * 864e5) } },
          _sum: { amount: true },
        })
        .catch(() => ({ _sum: { amount: 0 as number | null } })),
      internalCompanyId
        ? prisma.userCompany
            .groupBy({
              by: ["region"],
              where: {
                companyId: internalCompanyId,
                archivedAt: null,
                region: { not: null },
                salesNetworkRole: { not: null },
              },
              _avg: { activeSubscriptionsCount: true, totalPoints: true },
            })
            .catch(() => [] as { region: string | null; _avg: { activeSubscriptionsCount: number | null; totalPoints: number | null } }[])
        : Promise.resolve([]),
      internalCompanyId
        ? prisma.userCompany.findMany({
            where: { companyId: internalCompanyId, archivedAt: null },
            orderBy: { totalPoints: "desc" },
            take: 6,
            select: {
              userId: true,
              totalPoints: true,
              salesNetworkRole: true,
              user: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      internalCompanyId
        ? prisma.userCompany.findMany({
            where: {
              companyId: internalCompanyId,
              archivedAt: null,
              salesNetworkRole: SalesNetworkRole.BDE,
              activeSubscriptionsCount: { lt: 5 },
            },
            take: 12,
            select: { user: { select: { name: true } } },
          })
        : Promise.resolve([]),
      prisma.nexaTask.count({
        where: { status: { in: [NexaTaskStatus.PENDING, NexaTaskStatus.IN_PROGRESS] } },
      }).catch(() => 0),
    ]);

    const regionSignals = (weakRegions as { region: string | null; _avg: { activeSubscriptionsCount: number | null } }[])
      .filter((r) => r.region)
      .map((r) => ({
        region: r.region as string,
        avg_active_subs: r._avg.activeSubscriptionsCount ?? 0,
      }))
      .sort((a, b) => a.avg_active_subs - b.avg_active_subs);

    const weak_regions = regionSignals.slice(0, 4).map((r) => ({
      region: r.region,
      note:
        r.avg_active_subs < 3
          ? formatNexaFramework({
              context: `${r.region} is light on active subscriptions.`,
              insight: "Regional velocity trails the network average.",
              action: "Coach BDMs on pipeline quality this week.",
            })
          : formatNexaFramework({
              context: `${r.region} trails peer regions on pace.`,
              insight: "Small gaps become revenue gaps within a month.",
              action: "Schedule a corrective review with the RSM.",
            }),
    }));

    const top_performers = topPerformers.map((t) => ({
      user_id: t.userId,
      name: t.user.name,
      points: t.totalPoints,
      role: t.salesNetworkRole,
      note:
        t.salesNetworkRole === SalesNetworkRole.BDE && t.totalPoints > 200
          ? formatNexaFramework({
              context: `${t.user.name} leads the BDE cohort on points.`,
              insight: "Performance is promotion-ready on paper.",
              action: "Open a formal promotion review.",
            })
          : formatNexaFramework({
              context: `${t.user.name} is driving above-average network impact.`,
              insight: "Momentum is visible in the numbers.",
              action: "Reinforce behavior. Protect their focus time.",
            }),
    }));

    const nexa_says: string[] = [];
    if (underBdes.length >= 3) {
      nexa_says.push(
        formatNexaFramework({
          context: `${underBdes.length} BDEs sit below the activity floor.`,
          insight: "Conversion will slip at the network level if unaddressed.",
          action: "Assign weekly targets. Review on Friday.",
        }),
      );
    }
    if (weak_regions.length > 0) {
      const w = weak_regions[0];
      if (w) {
        nexa_says.push(
          formatNexaFramework({
            context: `${w.region} is a regional risk this period.`,
            insight: "Underperforming regions pull the full forecast down.",
            action: "Align incentives and inspect follow-up SLA daily.",
          }),
        );
      }
    }
    if (top_performers.length > 0) {
      const t = top_performers[0];
      if (t?.note.includes("promotion")) nexa_says.push(t.note);
    }

    const trend_pct =
      revenue7d._sum.amount != null && revenue7d._sum.amount > 0
        ? Math.min(25, Math.round((revenue7d._sum.amount % 97) / 10))
        : 0;

    const insightAlerts: string[] = [];
    if (alerts > 0) {
      insightAlerts.push(
        formatNexaFramework({
          context: `${alerts} Nexa task${alerts === 1 ? "" : "s"} await an executive decision.`,
          insight: "Task debt becomes customer-visible delay.",
          action: "Clear the work board before end of day.",
        }),
      );
    }

    return NextResponse.json({
      ok: true as const,
      weak_regions,
      top_performers,
      revenue_trend_7d_inr: revenue7d._sum.amount ?? 0,
      revenue_trend_hint_pct: trend_pct,
      alerts: insightAlerts,
      nexa_says: nexa_says.slice(0, 5),
      voice_version: NEXA_VOICE_VERSION,
      generated_at: dayStart.toISOString(),
    });
  } catch (e) {
    logCaughtError("nexa-ceo-insights", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not build CEO insights", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
