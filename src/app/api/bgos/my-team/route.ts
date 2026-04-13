import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;

  const rows = await prisma.userCompany.findMany({
    where: { companyId: session.companyId },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true, createdAt: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const userIds = rows.map((r) => r.userId);
  const [leadAgg, wonAgg, growth] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { companyId: session.companyId, assignedTo: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: {
        companyId: session.companyId,
        assignedTo: { in: userIds },
        status: LeadStatus.WON,
      },
      _count: { _all: true },
    }),
    prisma.companyGrowthPlan.findUnique({
      where: { companyId: session.companyId },
      select: { targetLeadsOneMonth: true },
    }),
  ]);

  const leadMap = new Map<string, number>();
  const wonMap = new Map<string, number>();
  for (const r of leadAgg) {
    if (r.assignedTo) leadMap.set(r.assignedTo, r._count._all);
  }
  for (const r of wonAgg) {
    if (r.assignedTo) wonMap.set(r.assignedTo, r._count._all);
  }

  const targetLeads = growth?.targetLeadsOneMonth ?? 0;

  const employees = rows.map((m) => {
    const leads = leadMap.get(m.userId) ?? 0;
    const conversions = wonMap.get(m.userId) ?? 0;
    const conversionPercent = leads > 0 ? Math.round((conversions / leads) * 100) : 0;
    const targetPercent =
      targetLeads > 0 ? Math.min(100, Math.round((leads / targetLeads) * 100)) : leads > 0 ? 100 : 0;
    return {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.jobRole,
      isActive: m.user.isActive,
      leads,
      conversions,
      conversionPercent,
      targetPercent,
      createdAt: m.user.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ ok: true as const, employees });
}
