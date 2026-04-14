import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

const FUNNEL = {
  leads: [LeadStatus.NEW, LeadStatus.CONTACTED] as LeadStatus[],
  demo: [LeadStatus.SITE_VISIT_SCHEDULED, LeadStatus.SITE_VISIT_COMPLETED] as LeadStatus[],
  onboarding: [
    LeadStatus.QUALIFIED,
    LeadStatus.NEGOTIATION,
    LeadStatus.PROPOSAL_SENT,
    LeadStatus.PROPOSAL_WON,
  ] as LeadStatus[],
  live: [LeadStatus.WON] as LeadStatus[],
};

export async function GET(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;
    const cacheKey = "control:sales-overview";
    const cached = getApiCache<{
      totalLeads: number;
      wonLeads: number;
      conversionRate: number;
      funnel: { leads: number; demo: number; onboarding: number; live: number };
      perEmployee: { userId: string | null; name: string; email: string | null; leadCount: number }[];
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true as const, ...cached });
    }

    const customerWhere = { company: { internalSalesOrg: false } };

    const [totalLeads, won, byAssignee, funnelGroups] = await Promise.all([
      prisma.lead.count({ where: customerWhere }),
      prisma.lead.count({ where: { ...customerWhere, status: { in: [LeadStatus.WON, LeadStatus.PROPOSAL_WON] } } }),
      prisma.lead.groupBy({
        by: ["assignedTo"],
        where: { ...customerWhere, assignedTo: { not: null } },
        _count: { _all: true },
      }),
      Promise.all([
        prisma.lead.count({ where: { ...customerWhere, status: { in: FUNNEL.leads } } }),
        prisma.lead.count({ where: { ...customerWhere, status: { in: FUNNEL.demo } } }),
        prisma.lead.count({ where: { ...customerWhere, status: { in: FUNNEL.onboarding } } }),
        prisma.lead.count({ where: { ...customerWhere, status: { in: FUNNEL.live } } }),
      ]),
    ]);

    const assigneeIds = byAssignee.map((g) => g.assignedTo).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const perEmployee = byAssignee.map((row) => {
      const u = row.assignedTo ? userMap.get(row.assignedTo) : undefined;
      return {
        userId: row.assignedTo,
        name: u?.name ?? "Unassigned pool",
        email: u?.email ?? null,
        leadCount: row._count._all,
      };
    });

    const conversionRate = totalLeads > 0 ? Math.round((won / totalLeads) * 1000) / 10 : 0;

    const payload = {
      ok: true as const,
      totalLeads,
      wonLeads: won,
      conversionRate,
      funnel: {
        leads: funnelGroups[0],
        demo: funnelGroups[1],
        onboarding: funnelGroups[2],
        live: funnelGroups[3],
      },
      perEmployee,
    };
    setApiCache(cacheKey, {
      totalLeads: payload.totalLeads,
      wonLeads: payload.wonLeads,
      conversionRate: payload.conversionRate,
      funnel: payload.funnel,
      perEmployee: payload.perEmployee,
    });
    return NextResponse.json(payload);
  } catch (e) {
    logCaughtError("GET /api/bgos/control/sales-overview", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load sales overview",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
