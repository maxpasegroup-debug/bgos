import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const [companyTargets, org, internalTargets] = await Promise.all([
    prisma.companyGrowthPlan.findMany({
      where: { company: { internalSalesOrg: false } },
      select: {
        targetRevenueOneMonth: true,
        targetLeadsOneMonth: true,
        company: { select: { id: true, name: true } },
      },
    }),
    getOrCreateInternalSalesCompanyId(),
    prisma.internalEmployeeDailyTarget.findMany({
      take: 200,
      orderBy: { dayKey: "desc" },
      select: {
        dayKey: true,
        targetCalls: true,
        targetLeads: true,
        companyId: true,
      },
    }),
  ]);

  const internalCompanyId = "companyId" in org ? org.companyId : null;
  const employeeTargets = internalCompanyId
    ? internalTargets.filter((t) => t.companyId === internalCompanyId)
    : internalTargets;

  return NextResponse.json({
    ok: true as const,
    companyTargets: companyTargets.map((c) => ({
      companyId: c.company.id,
      companyName: c.company.name,
      targetRevenueOneMonth: c.targetRevenueOneMonth,
      targetLeadsOneMonth: c.targetLeadsOneMonth,
    })),
    departmentTargetsNote:
      "Use company targets for solar tenants; internal org uses daily employee targets below.",
    employeeTargets: employeeTargets.slice(0, 60).map((t) => ({
      dayKey: t.dayKey,
      targetCalls: t.targetCalls,
      targetLeads: t.targetLeads,
    })),
  });
}
