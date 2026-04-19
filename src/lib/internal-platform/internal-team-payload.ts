import { TaskStatus, SalesNetworkRole, UserRole, type Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { BDE_DEFAULT_MONTHLY_REVENUE_TARGET } from "@/lib/sales-network/defaults";

const SALES_DEPT_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.SALES_EXECUTIVE];
const TECH_DEPT_ROLES: UserRole[] = [UserRole.TECH_HEAD, UserRole.TECH_EXECUTIVE];

export type InternalTeamRow = {
  userId: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  salesNetworkRole: SalesNetworkRole | null;
  parentUserId: string | null;
  region: string | null;
  archivedAt: string | null;
  assignedClients: number;
  pendingTasks: number;
  activeSubscriptionsCount: number;
  totalPoints: number;
  benefitLevel: unknown;
  bdeSlotLimit: number;
};

export type InternalTeamPayload = {
  ok: true;
  internalCompanyId: string;
  bdeMonthlyTargetInr: number;
  departments: {
    sales: InternalTeamRow[];
    tech: InternalTeamRow[];
  };
};

function toRow(
  m: {
    jobRole: UserRole;
    salesNetworkRole: SalesNetworkRole | null;
    parentUserId: string | null;
    region: string | null;
    archivedAt: Date | null;
    activeSubscriptionsCount: number;
    totalPoints: number;
    benefitLevel: unknown;
    bdeSlotLimit: number;
    user: { id: string; name: string | null; email: string; isActive: boolean };
  },
  leadMap: Map<string, number>,
  taskMap: Map<string, number>,
) {
  return {
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
  };
}

/**
 * Paginated internal org roster + aggregates (cache-friendly).
 */
export async function buildInternalTeamPayload(
  prisma: PrismaClient,
  internalCompanyId: string,
  opts?: { limit?: number; offset?: number; networkRole?: SalesNetworkRole | null },
): Promise<InternalTeamPayload> {
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 2000);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const roleFilter = opts?.networkRole ?? undefined;

  const cacheKey = `internal:team:v6:${internalCompanyId}:${limit}:${offset}:${roleFilter ?? "all"}`;
  const cached = getApiCache<InternalTeamPayload>(cacheKey);
  if (cached) return cached;

  const where: Prisma.UserCompanyWhereInput = { companyId: internalCompanyId };
  if (roleFilter) {
    where.salesNetworkRole = roleFilter;
  }

  const memberships = await prisma.userCompany.findMany({
    where,
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
    take: limit,
    skip: offset,
  });

  const ids = memberships.map((m) => m.user.id);
  const [leadCounts, taskCounts] = await Promise.all([
    ids.length
      ? prisma.lead.groupBy({
          by: ["assignedTo"],
          where: { assignedTo: { in: ids } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.task.groupBy({
          by: ["userId"],
          where: { userId: { in: ids }, status: TaskStatus.PENDING },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const leadMap = new Map(leadCounts.map((x) => [x.assignedTo ?? "", x._count._all]));
  const taskMap = new Map(taskCounts.map((x) => [x.userId ?? "", x._count._all]));

  const sales = memberships
    .filter((m) => SALES_DEPT_ROLES.includes(m.jobRole))
    .map((m) => toRow(m, leadMap, taskMap));
  const tech = memberships
    .filter((m) => TECH_DEPT_ROLES.includes(m.jobRole))
    .map((m) => toRow(m, leadMap, taskMap));

  const payload: InternalTeamPayload = {
    ok: true,
    internalCompanyId,
    bdeMonthlyTargetInr: BDE_DEFAULT_MONTHLY_REVENUE_TARGET,
    departments: { sales, tech },
  };
  setApiCache(cacheKey, payload);
  return payload;
}
