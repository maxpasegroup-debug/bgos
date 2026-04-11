import type { NextRequest } from "next/server";
import { InternalCallStatus, InternalSalesStage, LeadStatus, UserRole } from "@prisma/client";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { assertInternalSalesSession } from "@/lib/internal-sales-org";
import { isIceconnectPrivileged } from "@/lib/iceconnect-scope";
import { runInternalSalesAutomation } from "@/lib/internal-sales-automation";
import { prisma } from "@/lib/prisma";
import { isCompanyBasicTrialExpired, trialExpiredJsonResponse } from "@/lib/trial";

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d = new Date()) {
  const s = startOfUtcDay(d);
  return new Date(s.getTime() + 86400000);
}

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof Response) return session;

  const ctx = await assertInternalSalesSession(session);
  if (ctx instanceof Response) return ctx;

  if (!isIceconnectPrivileged(session.role)) {
    return jsonError(403, "FORBIDDEN", "Manager view only");
  }

  if (await isCompanyBasicTrialExpired(session.companyId)) {
    return trialExpiredJsonResponse();
  }

  const range = request.nextUrl.searchParams.get("range") ?? "today";
  const { companyId } = ctx;
  const dayStart = startOfUtcDay();
  const dayEnd = endOfUtcDay();
  const weekStart = new Date(dayStart.getTime() - 6 * 86400000);
  const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));

  const automation = await runInternalSalesAutomation(companyId);

  const [
    leadsToday,
    callsToday,
    demosScheduled,
    closedWon,
    notContacted,
    stuckFollowUp,
    members,
    leadsForPerf,
    allLeadsForFunnel,
    leadsWeek,
    leadsMonth,
    targetsToday,
  ] = await Promise.all([
    prisma.lead.count({
      where: { companyId, createdAt: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.lead.count({
      where: {
        companyId,
        lastContactedAt: { gte: dayStart, lt: dayEnd },
        internalCallStatus: { not: InternalCallStatus.NOT_CALLED },
      },
    }),
    prisma.lead.count({
      where: { companyId, internalSalesStage: InternalSalesStage.DEMO_SCHEDULED },
    }),
    prisma.lead.count({
      where: { companyId, internalSalesStage: InternalSalesStage.CLOSED_WON },
    }),
    prisma.lead.count({
      where: {
        companyId,
        internalCallStatus: InternalCallStatus.NOT_CALLED,
        internalSalesStage: {
          notIn: [InternalSalesStage.CLOSED_WON, InternalSalesStage.CLOSED_LOST],
        },
      },
    }),
    prisma.lead.count({
      where: {
        companyId,
        internalSalesStage: InternalSalesStage.FOLLOW_UP,
        updatedAt: { lt: new Date(Date.now() - 5 * 86400000) },
      },
    }),
    prisma.userCompany.findMany({
      where: {
        companyId,
        jobRole: {
          in: [
            UserRole.SALES_EXECUTIVE,
            UserRole.TELECALLER,
            UserRole.MANAGER,
            UserRole.ADMIN,
          ],
        },
      },
      include: { user: { select: { id: true, name: true, isActive: true } } },
    }),
    prisma.lead.findMany({
      where: { companyId },
      select: {
        id: true,
        assignedTo: true,
        internalSalesStage: true,
        internalCallStatus: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.lead.findMany({
      where: { companyId },
      select: { internalSalesStage: true },
    }),
    prisma.lead.count({
      where: { companyId, createdAt: { gte: weekStart, lt: dayEnd } },
    }),
    prisma.lead.count({
      where: { companyId, createdAt: { gte: monthStart, lt: dayEnd } },
    }),
    prisma.internalEmployeeDailyTarget.findMany({
      where: { companyId, dayKey: utcDayKey() },
    }),
  ]);

  const perfMap = new Map<
    string,
    { name: string; leads: number; calls: number; won: number }
  >();
  for (const m of members) {
    if (!m.user.isActive) continue;
    perfMap.set(m.user.id, { name: m.user.name, leads: 0, calls: 0, won: 0 });
  }

  for (const l of leadsForPerf) {
    if (!l.assignedTo) continue;
    const row = perfMap.get(l.assignedTo);
    if (!row) continue;
    row.leads += 1;
    if (l.internalCallStatus && l.internalCallStatus !== InternalCallStatus.NOT_CALLED) {
      row.calls += 1;
    }
    if (l.internalSalesStage === InternalSalesStage.CLOSED_WON || l.status === LeadStatus.WON) {
      row.won += 1;
    }
  }

  const targetByUser = new Map(targetsToday.map((t) => [t.userId, t]));

  const employeePerformance = [...perfMap.entries()]
    .map(([userId, r]) => {
      const conv = r.leads > 0 ? Math.round((r.won / r.leads) * 100) : 0;
      const score = Math.min(
        100,
        Math.round(r.calls * 3 + r.leads * 2 + conv * 1.5),
      );
      const t = targetByUser.get(userId);
      return {
        userId,
        name: r.name,
        leadsHandled: r.leads,
        callsMade: r.calls,
        conversions: conv,
        performanceScore: score,
        targetLeadsToday: t?.targetLeads ?? null,
        targetCallsToday: t?.targetCalls ?? null,
      };
    })
    .sort((a, b) => b.performanceScore - a.performanceScore || b.leadsHandled - a.leadsHandled);

  const weakPerformers = employeePerformance.filter(
    (r) => r.leadsHandled >= 2 && r.conversions < 20,
  );

  const topPerformer = employeePerformance[0] ?? null;

  let funnelLeads = 0;
  let funnelDemo = 0;
  let funnelClosed = 0;
  for (const l of allLeadsForFunnel) {
    const s = l.internalSalesStage;
    if (s === InternalSalesStage.CLOSED_LOST) continue;
    funnelLeads += 1;
    if (
      s === InternalSalesStage.DEMO_SCHEDULED ||
      s === InternalSalesStage.DEMO_DONE ||
      s === InternalSalesStage.INTERESTED ||
      s === InternalSalesStage.FOLLOW_UP ||
      s === InternalSalesStage.CLOSED_WON
    ) {
      funnelDemo += 1;
    }
    if (s === InternalSalesStage.CLOSED_WON) funnelClosed += 1;
  }

  const openCount = leadsForPerf.filter(
    (l) =>
      l.internalSalesStage !== InternalSalesStage.CLOSED_WON &&
      l.internalSalesStage !== InternalSalesStage.CLOSED_LOST,
  ).length;
  const conversionOverall =
    openCount + closedWon > 0 ? Math.round((closedWon / (openCount + closedWon)) * 100) : 0;

  const alerts: string[] = [];
  if (notContacted > 0) alerts.push(`${notContacted} leads not contacted yet`);
  if (stuckFollowUp > 0) alerts.push(`${stuckFollowUp} leads stuck in follow-up`);
  if (automation.delayedLeads.length > 0) {
    alerts.push(`${automation.delayedLeads.length} delayed (no call in 2h)`);
  }
  if (automation.stuckFollowUp.length > 0) {
    alerts.push(`${automation.stuckFollowUp.length} follow-ups over 2 days`);
  }
  if (automation.noActivityLeads.length > 0) {
    alerts.push(`${automation.noActivityLeads.length} leads with no recent activity`);
  }
  for (const w of weakPerformers.slice(0, 3)) {
    alerts.push(`Weak performer: ${w.name} (${w.conversions}% wins)`);
  }

  let rangeLeads = leadsToday;
  if (range === "week") rangeLeads = leadsWeek;
  if (range === "month") rangeLeads = leadsMonth;

  return jsonSuccess({
    metrics: {
      leadsToday,
      callsToday,
      demosScheduled,
      closedDeals: closedWon,
      conversionPercent: conversionOverall,
      rangeLeads,
    },
    funnel: {
      leads: funnelLeads,
      demoOrLater: funnelDemo,
      closedWon: funnelClosed,
    },
    employeePerformance,
    topPerformer: topPerformer
      ? { name: topPerformer.name, score: topPerformer.performanceScore }
      : null,
    weakPerformers: weakPerformers.map((w) => ({ name: w.name, conversions: w.conversions })),
    alerts,
    automation: {
      delayedLeads: automation.delayedLeads,
      stuckFollowUp: automation.stuckFollowUp,
      noActivityLeads: automation.noActivityLeads,
      dailySummary: automation.dailySummary,
    },
    trendRange: range,
  });
}
