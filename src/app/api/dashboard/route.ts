import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { buildBgosDashboardSnapshot } from "@/lib/bgos-dashboard-data";
import { getFinancialOverview } from "@/lib/financial-metrics";
import { getPipelineStages } from "@/lib/dashboard-pipeline";
import { generateInsights } from "@/lib/nexa-insights";
import { generateNexaInsights, runNexaAutoActions } from "@/lib/nexa-engine";
import { prisma } from "@/lib/prisma";
import { buildSalesBoosterPayload } from "@/lib/sales-booster";
import { ensurePendingTasksForOpenLeads } from "@/lib/task-engine";

export async function GET(request: NextRequest) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  const companyId = user.companyId;

  let leads: number;
  let installations: number;
  let snapshot: Awaited<ReturnType<typeof buildBgosDashboardSnapshot>>;
  let insights: Awaited<ReturnType<typeof generateInsights>>;
  let pipeline: Awaited<ReturnType<typeof getPipelineStages>>;
  let salesBooster: Awaited<ReturnType<typeof buildSalesBoosterPayload>>;
  let financial: Awaited<ReturnType<typeof getFinancialOverview>>;
  let nexaController: Awaited<ReturnType<typeof generateNexaInsights>>;

  try {
    await ensurePendingTasksForOpenLeads(companyId, user.sub);
    await runNexaAutoActions(companyId, user.sub);
    snapshot = await buildBgosDashboardSnapshot(companyId);
    [leads, installations, insights, pipeline, salesBooster, financial, nexaController] =
      await Promise.all([
      prisma.lead.count({ where: { companyId } }),
      prisma.installation.count({
        where: { companyId, status: "Completed" },
      }),
      generateInsights(companyId, snapshot.nexa),
      getPipelineStages(companyId),
      buildSalesBoosterPayload(companyId),
      getFinancialOverview(companyId),
      generateNexaInsights(companyId),
    ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/dashboard", e);
  }

  return NextResponse.json({
    leads,
    revenue: financial.totalRevenue,
    installations,
    pendingPayments: financial.unpaidInvoiceCount,
    pipeline,
    insights,
    nexaController,
    salesBooster,
    nexa: snapshot.nexa,
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
  });
}
