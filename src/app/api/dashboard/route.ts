import { DealStatus, PaymentStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  internalServerErrorResponse,
  prismaKnownErrorResponse,
} from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { getPipelineStages } from "@/lib/dashboard-pipeline";
import { generateInsights } from "@/lib/nexa-insights";
import { prisma } from "@/lib/prisma";
import { buildSalesBoosterPayload } from "@/lib/sales-booster";

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const companyId = user.companyId;

  let leads: number;
  let revenue: { _sum: { value: number | null } };
  let installations: number;
  let pendingPayments: number;
  let insights: Awaited<ReturnType<typeof generateInsights>>;
  let pipeline: Awaited<ReturnType<typeof getPipelineStages>>;
  let salesBooster: Awaited<ReturnType<typeof buildSalesBoosterPayload>>;

  try {
    [leads, revenue, installations, pendingPayments, insights, pipeline, salesBooster] =
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
        generateInsights(companyId),
        getPipelineStages(companyId),
        buildSalesBoosterPayload(companyId),
      ]);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    console.error("[GET /api/dashboard]", e);
    return internalServerErrorResponse();
  }

  return NextResponse.json({
    leads,
    revenue: revenue._sum.value ?? 0,
    installations,
    pendingPayments,
    pipeline,
    insights,
    salesBooster,
  });
}
