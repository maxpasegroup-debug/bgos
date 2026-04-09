import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { requireLiveProPlan } from "@/lib/plan-access";
import { buildSalesBoosterPayload } from "@/lib/sales-booster";
import { handleApiError } from "@/lib/route-error";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export const runtime = "nodejs";

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Sales Booster dashboard: Pro+ live payload + performance snapshot (real CRM data).
 */
export async function GET(request: NextRequest) {
  const user = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (user instanceof NextResponse) return user;
  const pro = await requireLiveProPlan(user);
  if (pro) return pro;

  const companyId = user.companyId;

  try {
    const start = monthStart(new Date());
    const [booster, wonMonth, lostMonth, openLeads, bySource, pipelineSum] = await Promise.all([
      buildSalesBoosterPayload(companyId),
      prisma.lead.count({
        where: {
          companyId,
          status: LeadStatus.WON,
          updatedAt: { gte: start },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          status: LeadStatus.LOST,
          updatedAt: { gte: start },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
        },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { companyId },
        _count: { id: true },
      }),
      prisma.lead.aggregate({
        where: {
          companyId,
          status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
        },
        _sum: { value: true },
      }),
    ]);

    const closed = wonMonth + lostMonth;
    const conversionRate = closed > 0 ? Math.round((wonMonth / closed) * 1000) / 10 : 0;
    const leadsByChannel: Record<string, number> = {};
    for (const row of bySource) {
      const label = row.source?.trim() ? row.source.trim() : "Website & other";
      leadsByChannel[label] = (leadsByChannel[label] ?? 0) + row._count.id;
    }

    return jsonSuccess({
      booster,
      performance: {
        conversionRate,
        leadsOpen: openLeads,
        wonThisMonth: wonMonth,
        lostThisMonth: lostMonth,
        pipelineValue: pipelineSum._sum.value ?? 0,
        leadsByChannel,
      },
    });
  } catch (e) {
    return handleApiError("GET /api/bgos/sales-booster/module-data", e);
  }
}
