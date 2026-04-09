import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { computeDashboardAnalytics } from "@/lib/dashboard-analytics";
import { buildBgosDashboardSnapshot } from "@/lib/bgos-dashboard-data";
import { getFinancialOverview } from "@/lib/financial-metrics";
import { getPipelineStages } from "@/lib/dashboard-pipeline";
import {
  dashboardRangePresetSchema,
  dashboardRangeRequiresPro,
  parseDashboardRangeQuery,
  trendWindowForRange,
} from "@/lib/dashboard-range";
import { buildAutomationCenterDashboardSlice, isAutomationCenterEnabled } from "@/lib/automation-center";
import { generateInsights } from "@/lib/nexa-insights";
import { generateNexaInsights, runNexaAutoActions } from "@/lib/nexa-engine";
import { isPro, requireLiveProPlan } from "@/lib/plan-access";
import { isPlanLockedToBasic } from "@/lib/plan-production-lock";
import { prisma } from "@/lib/prisma";
import { buildSalesBoosterPayload } from "@/lib/sales-booster";
import { ensurePendingTasksForOpenLeads } from "@/lib/task-engine";
import { isCompanyBasicTrialExpired } from "@/lib/trial";

export async function GET(request: NextRequest) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  const companyId = user.companyId;

  const rangeRaw = request.nextUrl.searchParams.get("range");
  const parsedPreset = dashboardRangePresetSchema.safeParse(rangeRaw?.trim() || "this_month");
  const presetForGate = parsedPreset.success ? parsedPreset.data : "this_month";
  if (dashboardRangeRequiresPro(presetForGate)) {
    const denied = await requireLiveProPlan(user);
    if (denied) return denied;
  }

  const rangeResolved = parseDashboardRangeQuery(rangeRaw);
  const { trendStart, trendEnd, allTimeChart } = trendWindowForRange(rangeResolved);

  const entitledPro =
    !isPlanLockedToBasic() && isPro(user.companyPlan);

  let leads: number;
  let installations: number;
  let snapshot: Awaited<ReturnType<typeof buildBgosDashboardSnapshot>>;
  let insights: Awaited<ReturnType<typeof generateInsights>>;
  let pipeline: Awaited<ReturnType<typeof getPipelineStages>>;
  let salesBooster: Awaited<ReturnType<typeof buildSalesBoosterPayload>>;
  let financial: Awaited<ReturnType<typeof getFinancialOverview>>;
  let nexaController: Awaited<ReturnType<typeof generateNexaInsights>>;
  let automationCenter: Awaited<ReturnType<typeof buildAutomationCenterDashboardSlice>> | null = null;

  let analytics: Awaited<ReturnType<typeof computeDashboardAnalytics>>;
  try {
    await ensurePendingTasksForOpenLeads(companyId, user.sub);
    if (
      entitledPro &&
      (await isAutomationCenterEnabled(companyId)) &&
      !(await isCompanyBasicTrialExpired(companyId))
    ) {
      await runNexaAutoActions(companyId, user.sub);
    }
    snapshot = await buildBgosDashboardSnapshot(companyId);
    [leads, installations, insights, pipeline, salesBooster, financial, nexaController, analytics] =
      await Promise.all([
        prisma.lead.count({ where: { companyId } }),
        prisma.installation.count({
          where: { companyId, status: "Completed" },
        }),
        entitledPro
          ? generateInsights(companyId, snapshot.nexa)
          : Promise.resolve([]),
        getPipelineStages(companyId),
        buildSalesBoosterPayload(companyId),
        getFinancialOverview(companyId),
        entitledPro ? generateNexaInsights(companyId) : Promise.resolve([]),
        computeDashboardAnalytics(
          companyId,
          rangeResolved.start,
          rangeResolved.end,
          trendStart,
          trendEnd,
          { allTimeChart },
        ),
      ]);
    if (entitledPro) {
      automationCenter = await buildAutomationCenterDashboardSlice(companyId, snapshot.nexa);
    }
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/dashboard", e);
  }

  const analyticsOut = analytics;

  return NextResponse.json({
    leads,
    revenue: financial.totalRevenue,
    installations,
    pendingPayments: financial.unpaidInvoiceCount,
    pipeline,
    insights,
    nexaController,
    salesBooster,
    /** Operational counts from live CRM data — visible on all plans. Pro still gates insights / Nexa UI / automation center. */
    nexa: snapshot.nexa,
    automationCenter,
    operations: snapshot.operations,
    revenueBreakdown: snapshot.revenue,
    risks: snapshot.risks,
    health: snapshot.health,
    hr: snapshot.hr,
    inventory: snapshot.inventory,
    partner: snapshot.partner,
    team: snapshot.team,
    financial: {
      totalRevenue: financial.totalRevenue,
      pendingPayments: financial.pendingPayments,
      unpaidInvoiceCount: financial.unpaidInvoiceCount,
      monthlyRevenue: financial.monthlyRevenue,
      totalExpenses: financial.totalExpenses,
      currentMonthExpenses: financial.currentMonthExpenses,
      netProfit: financial.netProfit,
      monthlyRevenueTrend: financial.monthlyRevenueTrend,
      monthlyExpenseTrend: financial.monthlyExpenseTrend,
      expenseChangePercent: financial.expenseChangePercent,
    },
    analytics: analyticsOut,
    analyticsRange: {
      preset: rangeResolved.preset,
      from: rangeResolved.start.toISOString(),
      to: rangeResolved.end.toISOString(),
      label: rangeResolved.label,
    },
  });
}
