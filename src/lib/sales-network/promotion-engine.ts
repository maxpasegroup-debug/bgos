import type { PrismaClient } from "@prisma/client";
import { SalesNetworkRole, UserRole } from "@prisma/client";
import { DEFAULT_SALES_NETWORK_TARGETS } from "@/lib/sales-network/defaults";

/**
 * BDE → BDM when monthly target met for N consecutive months (Nexa-controlled).
 * Updates {@link PromotionTracker} and optionally promotes membership.
 */
export async function evaluateBdeToBdmPromotion(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
): Promise<{ eligible: boolean; streak: number }> {
  const membership = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { salesNetworkRole: true, jobRole: true },
  });
  if (!membership || membership.salesNetworkRole !== SalesNetworkRole.BDE) {
    return { eligible: false, streak: 0 };
  }

  const required = DEFAULT_SALES_NETWORK_TARGETS[SalesNetworkRole.BDE].consecutiveMonths;
  const revenueTarget = DEFAULT_SALES_NETWORK_TARGETS[SalesNetworkRole.BDE].monthlyRevenue;

  const tracker = await prisma.promotionTracker.upsert({
    where: { companyId_userId: { companyId, userId } },
    create: {
      companyId,
      userId,
      currentStreak: 0,
      targetMet: false,
      eligibleForPromotion: false,
    },
    update: {},
  });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const metric = await prisma.performanceMetric.findFirst({
    where: { companyId, userId, month: monthStart },
  });

  const met = metric ? metric.totalRevenue >= revenueTarget : false;

  let streak = tracker.currentStreak;
  if (met) {
    streak += 1;
  } else {
    streak = 0;
  }

  const eligible = met && streak >= required;

  await prisma.promotionTracker.update({
    where: { companyId_userId: { companyId, userId } },
    data: {
      currentStreak: streak,
      targetMet: met,
      eligibleForPromotion: eligible,
    },
  });

  if (eligible) {
    await prisma.userCompany.update({
      where: { userId_companyId: { userId, companyId } },
      data: {
        salesNetworkRole: SalesNetworkRole.BDM,
        jobRole: UserRole.MANAGER,
      },
    });
    await prisma.promotionTracker.update({
      where: { companyId_userId: { companyId, userId } },
      data: { eligibleForPromotion: false, currentStreak: 0 },
    });
  }

  return { eligible, streak };
}
