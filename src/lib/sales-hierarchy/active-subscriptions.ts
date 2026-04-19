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
