import { TaskStatus, SalesNetworkRole, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";
import { BDE_DEFAULT_MONTHLY_REVENUE_TARGET } from "@/lib/sales-network/defaults";

const SALES_DEPT_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.SALES_EXECUTIVE];
const TECH_DEPT_ROLES: UserRole[] = [UserRole.TECH_HEAD, UserRole.TECH_EXECUTIVE];

export async function GET(request: NextRequest) {
  try {
    const session = requireSuperBossApi(request);
    if (session instanceof NextResponse) return session;

    const org = await getOrCreateInternalSalesCompanyId();
    if ("error" in org) {
      return NextResponse.json(
        { ok: false as const, error: org.error, code: "INTERNAL_ORG" as const },
        { status: 500 },
      );
    }
    const cacheKey = `control:team:v4:${org.companyId}`;
    const cached = getApiCache<{
      internalCompanyId: string;
      bdeMonthlyTargetInr: number;
      departments: {
        sales: Array<{
          userId: string;
          name: string;
          email: string;
          role: UserRole;
          salesNetworkRole: SalesNetworkRole | null;
          parentUserId: string | null;
          region: string | null;
          archivedAt: string | null;
        }>;
        tech: Array<{
          userId: string;
          name: string;
          email: string;
          role: UserRole;
          salesNetworkRole: SalesNetworkRole | null;
          parentUserId: string | null;
          region: string | null;
          archivedAt: string | null;
        }>;
      };
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({
        ok: true as const,
        internalCompanyId: cached.internalCompanyId,
        departments: cached.departments,
      });
    }

    const memberships = await prisma.userCompany.findMany({
      where: { companyId: org.companyId },
      select: {
        jobRole: true,
        salesNetworkRole: true,
        parentUserId: true,
        region: true,
        archivedAt: true,
        activeSubscriptionsCount: true,
        totalPoints: true,
        benefitLevel: true,
        bdeSlotLimit: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    });

  const ids = memberships.map((m) => m.user.id);
  const [leadCounts, taskCounts] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { assignedTo: { in: ids } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, status: TaskStatus.PENDING },
      _count: { _all: true },
    }),
  ]);
  const leadMap = new Map(leadCounts.map((x) => [x.assignedTo ?? "", x._count._all]));
  const taskMap = new Map(taskCounts.map((x) => [x.userId ?? "", x._count._all]));

    const mapMember = (m: (typeof memberships)[number]) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.jobRole,
      isActive: m.user.isActive,
      salesNetworkRole: m.salesNetworkRole,
      parentUserId: m.parentUserId,
      region: m.region,
      archivedAt: m.archivedAt?.toISOString() ?? null,
      assignedClients: leadMap.get(m.user.id) ?? 0,
      pendingTasks: taskMap.get(m.user.id) ?? 0,
      activeSubscriptionsCount: m.activeSubscriptionsCount,
      totalPoints: m.totalPoints,
      benefitLevel: m.benefitLevel,
      bdeSlotLimit: m.bdeSlotLimit,
    });

    const sales = memberships.filter((m) => SALES_DEPT_ROLES.includes(m.jobRole)).map(mapMember);

    const tech = memberships.filter((m) => TECH_DEPT_ROLES.includes(m.jobRole)).map(mapMember);

    const payload = {
      ok: true as const,
      internalCompanyId: org.companyId,
      bdeMonthlyTargetInr: BDE_DEFAULT_MONTHLY_REVENUE_TARGET,
      departments: {
        sales,
        tech,
      },
    };
    setApiCache(cacheKey, {
      internalCompanyId: payload.internalCompanyId,
      bdeMonthlyTargetInr: payload.bdeMonthlyTargetInr,
      departments: payload.departments,
    });
    return NextResponse.json(payload);
  } catch (e) {
    logCaughtError("GET /api/bgos/control/team", e);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Could not load team",
        code: "SERVER_ERROR" as const,
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
