import { DealStatus, PaymentStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { buildBgosDashboardSnapshot } from "@/lib/bgos-dashboard-data";
import { getFinancialOverview } from "@/lib/financial-metrics";
import { getPipelineStages } from "@/lib/dashboard-pipeline";
import { generateInsights } from "@/lib/nexa-insights";
import { prisma } from "@/lib/prisma";
import { buildSalesBoosterPayload } from "@/lib/sales-booster";
import { ensurePendingTasksForOpenLeads } from "@/lib/task-engine";

export async function GET(request: NextRequest) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  const companyId = user.companyId;

  let leads: number;
  let revenue: { _sum: { value: number | null } };
  let installations: number;
  let pendingPayments: number;
  let snapshot: Awaited<ReturnType<typeof buildBgosDashboardSnapshot>>;
  let insights: Awaited<ReturnType<typeof generateInsights>>;
  let pipeline: Awaited<ReturnType<typeof getPipelineStages>>;
  let salesBooster: Awaited<ReturnType<typeof buildSalesBoosterPayload>>;
  let financial: Awaited<ReturnType<typeof getFinancialOverview>>;

  try {
    await ensurePendingTasksForOpenLeads(companyId, user.sub);
    snapshot = await buildBgosDashboardSnapshot(companyId);
    [leads, revenue, installations, pendingPayments, insights, pipeline, salesBooster, financial] =
      await Promise.all([
        prisma.lead.count({ where: { companyId } }),
        prisma.deal.aggregate({
          _sum: { value: true },
          where: {
            status: DealStatus.WON,
            lead: { companyId },
          },
        }),
        prisma.installation.count({
          where: { companyId, status: "Completed" },
        }),
        prisma.payment.count({
          where: { companyId, status: PaymentStatus.PENDING },
        }),
        generateInsights(companyId, snapshot.nexa),
        getPipelineStages(companyId),
        buildSalesBoosterPayload(companyId),
        getFinancialOverview(companyId),
      ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/dashboard", e);
  }

  return NextResponse.json({
    leads,
    revenue: revenue._sum.value ?? 0,
    installations,
    pendingPayments,
    pipeline,
    insights,
    salesBooster,
    nexa: snapshot.nexa,
    operations: snapshot.operations,
    revenueBreakdown: snapshot.revenue,
    risks: snapshot.risks,
    health: snapshot.health,
    team: snapshot.team,
    financial: {
      totalRevenue: financial.totalRevenue,
      pendingPayments: financial.pendingPayments,
      monthlyRevenue: financial.monthlyRevenue,
      totalExpenses: financial.totalExpenses,
      netProfit: financial.netProfit,
      monthlyRevenueTrend: financial.monthlyRevenueTrend,
      expenseChangePercent: financial.expenseChangePercent,
    },
  });
}
