import type { PrismaClient } from "@prisma/client";
import { SalesHierarchySubscriptionStatus } from "@prisma/client";

/**
 * Active = status ACTIVE and expiresAt >= now (server UTC).
 */
export async function getActiveSubscriptionCount(
  prisma: PrismaClient,
  companyId: string,
  ownerUserId: string,
): Promise<number> {
  const now = new Date();
  return prisma.salesHierarchySubscription.count({
    where: {
      companyId,
      ownerUserId,
      status: SalesHierarchySubscriptionStatus.ACTIVE,
      expiresAt: { gte: now },
    },
  });
}

/**
 * Batch version of getActiveSubscriptionCount.
 *
 * Returns a Map<userId, activeCount> for all requested users in a single
 * GROUP BY query — eliminates the N+1 pattern in the team roster API.
 *
 * Users with zero active subscriptions are included in the map with value 0.
 */
export async function getBatchActiveSubscriptionCounts(
  prisma: PrismaClient,
  companyId: string,
  ownerUserIds: string[],
): Promise<Map<string, number>> {
  if (ownerUserIds.length === 0) return new Map();

  const now = new Date();
  const groups = await prisma.salesHierarchySubscription.groupBy({
    by: ["ownerUserId"],
    where: {
      companyId,
      ownerUserId: { in: ownerUserIds },
      status: SalesHierarchySubscriptionStatus.ACTIVE,
      expiresAt: { gte: now },
    },
    _count: { _all: true },
  });

  const result = new Map<string, number>(ownerUserIds.map((id) => [id, 0]));
  for (const g of groups) {
    result.set(g.ownerUserId, g._count._all);
  }
  return result;
}

/**
 * Batch version for BDM network active subscriptions.
 *
 * Given a list of BDM userIds, returns a Map<bdmUserId, totalNetworkActiveSubs>
 * using exactly 2 queries regardless of how many BDMs there are.
 */
export async function getBatchBdmNetworkActiveSubs(
  prisma: PrismaClient,
  companyId: string,
  bdmUserIds: string[],
): Promise<Map<string, number>> {
  if (bdmUserIds.length === 0) return new Map();

  // 1. Fetch all BDE children of these BDMs in one query
  const { SalesNetworkRole } = await import("@prisma/client");
  const children = await prisma.userCompany.findMany({
    where: {
      companyId,
      parentUserId: { in: bdmUserIds },
      salesNetworkRole: SalesNetworkRole.BDE,
      archivedAt: null,
    },
    select: { userId: true, parentUserId: true },
  });

  // Build bdmId → [bdeIds] map
  const bdmToChildren = new Map<string, string[]>();
  for (const id of bdmUserIds) bdmToChildren.set(id, []);
  for (const c of children) {
    if (c.parentUserId) {
      bdmToChildren.get(c.parentUserId)?.push(c.userId);
    }
  }

  // 2. Batch-count active subs for all BDE children
  const allBdeIds = children.map((c) => c.userId);
  const bdeCounts = await getBatchActiveSubscriptionCounts(prisma, companyId, allBdeIds);

  // 3. Sum per BDM
  const result = new Map<string, number>();
  for (const [bdmId, bdeIds] of bdmToChildren) {
    const total = bdeIds.reduce((sum, id) => sum + (bdeCounts.get(id) ?? 0), 0);
    result.set(bdmId, total);
  }
  return result;
}
