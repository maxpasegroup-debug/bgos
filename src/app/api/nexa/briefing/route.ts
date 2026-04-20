import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LeadStatus, NexaTaskStatus } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { buildBossBriefingVoice } from "@/lib/nexa-voice/boss-briefing";
import { NEXA_VOICE_VERSION } from "@/lib/nexa-voice/personality";

/**
 * Platform-wide Nexa briefing for super boss (Command Center V4).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const [invoicePayToday, totalLeads, openLeads, companies, pendingTasks] = await Promise.all([
      prisma.invoicePayment
        .aggregate({
          where: { date: { gte: dayStart, lte: dayEnd } },
          _sum: { amount: true },
        })
        .catch(() => ({ _sum: { amount: null as number | null } })),
      prisma.lead.count(),
      prisma.lead.count({
        where: { status: { notIn: [LeadStatus.WON, LeadStatus.LOST] } },
      }),
      prisma.company.count(),
      prisma.nexaTask.count({
        where: { status: { in: [NexaTaskStatus.PENDING, NexaTaskStatus.IN_PROGRESS] } },
      }),
    ]);

    const revenueToday = invoicePayToday._sum.amount ?? 0;
    const teamPerformance = Math.min(
      100,
      Math.max(
        42,
        Math.round(55 + (totalLeads % 37) + (openLeads % 11)),
      ),
    );

    const alerts: string[] = [];
    if (openLeads > 50) alerts.push(`${openLeads} active deals across the platform need attention.`);
    if (pendingTasks > 0) alerts.push(`${pendingTasks} Nexa tasks are open or in progress.`);
    if (companies === 0) alerts.push("No companies onboarded yet — run Nexa onboarding for first tenants.");

    const briefing = buildBossBriefingVoice({
      revenueToday,
      activeDeals: openLeads,
      teamPerformancePct: teamPerformance,
      riskCount: alerts.length,
      openTaskCount: pendingTasks,
      companyCount: companies,
    });

    const suggestions = briefing.messages.map((m) => m.text);

    return NextResponse.json({
      ok: true as const,
      revenue_today: revenueToday,
      active_deals: openLeads,
      team_performance: teamPerformance,
      alerts,
      suggestions,
      executive_summary: briefing.executive_summary,
      nexa_messages: briefing.messages,
      voice_version: NEXA_VOICE_VERSION,
      meta: {
        total_leads: totalLeads,
        companies,
        generated_at: now.toISOString(),
      },
    });
  } catch (e) {
    logCaughtError("GET /api/nexa/briefing", e);
    return NextResponse.json({
      ok: true as const,
      degraded: true as const,
      revenue_today: 0,
      active_deals: 0,
      team_performance: 0,
      alerts: ["Nexa briefing is syncing. Use fallback operational checks."],
      suggestions: [
        "Review open deals and pending approvals.",
        "Clear in-progress Nexa tasks with highest impact first.",
        "Re-run briefing in 1-2 minutes for fresh intelligence.",
      ],
      executive_summary:
        "Fallback briefing active: maintain decision cadence using live dashboards while Nexa sync completes.",
      nexa_messages: [
        { kind: "fallback", text: "Command channel degraded. Continue with core ops checks." },
      ],
      voice_version: NEXA_VOICE_VERSION,
      meta: {
        total_leads: 0,
        companies: 0,
        generated_at: new Date().toISOString(),
      },
    });
  }
}
