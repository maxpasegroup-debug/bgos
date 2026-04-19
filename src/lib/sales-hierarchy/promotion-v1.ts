import type { PrismaClient } from "@prisma/client";
import { SalesBenefitLevel, SalesNetworkRole, UserRole } from "@prisma/client";
import {
  BDE_TO_BDM_ACTIVE_SUBS,
  BDM_INITIAL_BDE_SLOTS,
  BDM_TO_RSM_MIN_BDES,
  BDM_TO_RSM_MIN_NETWORK_POINTS,
} from "@/config/sales-hierarchy";
import { getActiveSubscriptionCount } from "@/lib/sales-hierarchy/active-subscriptions";
/**
 * Daily / post-sale: evaluate BDE→BDM (60 active subs) and BDM→RSM (network size + points).
 */
export async function runSalesHierarchyPromotions(
  prisma: PrismaClient,
  companyId: string,
): Promise<{ bdePromoted: number; bdmPromoted: number }> {
  const now = new Date();
  let bdePromoted = 0;
  let bdmPromoted = 0;

  const bdeRows = await prisma.userCompany.findMany({
    where: { companyId, salesNetworkRole: SalesNetworkRole.BDE, archivedAt: null },
    select: { userId: true },
  });

  for (const row of bdeRows) {
    const count = await getActiveSubscriptionCount(prisma, companyId, row.userId);
    await prisma.userCompany.update({
      where: { userId_companyId: { userId: row.userId, companyId } },
      data: { activeSubscriptionsCount: count },
    });

    if (count < BDE_TO_BDM_ACTIVE_SUBS) continue;

    await prisma.userCompany.update({
      where: { userId_companyId: { userId: row.userId, companyId } },
      data: {
        salesNetworkRole: SalesNetworkRole.BDM,
        jobRole: UserRole.MANAGER,
        recurringCap: false,
        bdeSlotLimit: BDM_INITIAL_BDE_SLOTS,
        benefitLevel: SalesBenefitLevel.FULL,
      },
    });
    await prisma.promotionTracker.upsert({
      where: { companyId_userId: { companyId, userId: row.userId } },
      create: {
        companyId,
        userId: row.userId,
        currentStreak: 0,
        targetMet: true,
        eligibleForPromotion: true,
        roleTarget: SalesNetworkRole.BDM,
        activeCountSnapshot: count,
        lastPromotionCheckAt: now,
      },
      update: {
        targetMet: true,
        eligibleForPromotion: true,
        roleTarget: SalesNetworkRole.BDM,
        activeCountSnapshot: count,
        lastPromotionCheckAt: now,
      },
    });
    bdePromoted += 1;
  }

  const bdmRows = await prisma.userCompany.findMany({
    where: { companyId, salesNetworkRole: SalesNetworkRole.BDM, archivedAt: null },
    select: { userId: true },
  });

  for (const bdm of bdmRows) {
    const bdeChildren = await prisma.userCompany.findMany({
      where: {
        companyId,
        parentUserId: bdm.userId,
        salesNetworkRole: SalesNetworkRole.BDE,
        archivedAt: null,
      },
      select: { userId: true },
    });
    if (bdeChildren.length < BDM_TO_RSM_MIN_BDES) continue;

    let networkPoints = 0;
    for (const c of bdeChildren) {
      networkPoints += await getActiveSubscriptionCount(prisma, companyId, c.userId);
    }
    if (networkPoints < BDM_TO_RSM_MIN_NETWORK_POINTS) continue;

    await prisma.userCompany.update({
      where: { userId_companyId: { userId: bdm.userId, companyId } },
      data: {
        salesNetworkRole: SalesNetworkRole.RSM,
        jobRole: UserRole.MANAGER,
      },
    });
    await prisma.promotionTracker.upsert({
      where: { companyId_userId: { companyId, userId: bdm.userId } },
      create: {
        companyId,
        userId: bdm.userId,
        currentStreak: 0,
        targetMet: true,
        eligibleForPromotion: true,
        roleTarget: SalesNetworkRole.RSM,
        activeCountSnapshot: networkPoints,
        lastPromotionCheckAt: now,
      },
      update: {
        targetMet: true,
        eligibleForPromotion: true,
        roleTarget: SalesNetworkRole.RSM,
        activeCountSnapshot: networkPoints,
        lastPromotionCheckAt: now,
      },
    });
    bdmPromoted += 1;
  }

  return { bdePromoted, bdmPromoted };
}
