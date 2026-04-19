import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireInternalPlatformApi } from "@/lib/require-internal-platform";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

export async function GET(request: NextRequest) {
  try {
    const session = requireInternalPlatformApi(request);
    if (session instanceof NextResponse) return session;
    const cacheKey = "control:vision";
    const cached = getApiCache<{
      companyTargets: {
        companyId: string;
        companyName: string;
        targetRevenueOneMonth: number;
        targetLeadsOneMonth: number;
      }[];
      departmentTargetsNote: string;
      employeeTargets: { dayKey: string; targetCalls: number; targetLeads: number }[];
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true as const, ...cached });
    }

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

    const payload = {
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
    };
    setApiCache(cacheKey, {
      companyTargets: payload.companyTargets,
      departmentTargetsNote: payload.departmentTargetsNote,
      employeeTargets: payload.employeeTargets,
    });
    return NextResponse.json(payload);
  } catch (e) {
    logCaughtError("GET /api/bgos/control/vision", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load vision",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
