import type { PrismaClient } from "@prisma/client";
import {
  NetworkCommissionType,
  SalesHierarchyPlan,
  SalesHierarchySubscriptionStatus,
  SalesNetworkRole,
} from "@prisma/client";
import {
  BDE_MILESTONE_BONUS_INR,
  BDE_POINTS_MILESTONE_FIRST,
  BDE_RECURRING_CAP_RATIO,
  OVERRIDE_BDM_FROM_BDE,
  OVERRIDE_RSM_FROM_BDM_LAYER,
  PLAN_SALE_VALUE_INR,
  POINTS_BY_PLAN,
  DEFAULT_SUBSCRIPTION_TERM_DAYS,
} from "@/config/sales-hierarchy";
import { refreshBdmBenefitLevel } from "@/lib/sales-hierarchy/benefit-level";
import { getActiveSubscriptionCount } from "@/lib/sales-hierarchy/active-subscriptions";
import { runSalesHierarchyPromotions } from "@/lib/sales-hierarchy/promotion-v1";

export type RecordSaleInput = {
  companyId: string;
  ownerUserId: string;
  planType: SalesHierarchyPlan;
  /** Optional CUSTOM points (3–5). */
  customPoints?: number;
};

/**
 * Creates hierarchy subscription, increments membership points/subs, writes override earnings to upline.
 */
export async function recordHierarchySale(
  prisma: PrismaClient,
  input: RecordSaleInput,
): Promise<{ subscriptionId: string }> {
  const points =
    input.planType === SalesHierarchyPlan.CUSTOM
      ? Math.min(
          5,
          Math.max(3, input.customPoints ?? POINTS_BY_PLAN[SalesHierarchyPlan.CUSTOM]),
        )
      : POINTS_BY_PLAN[input.planType];

  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + DEFAULT_SUBSCRIPTION_TERM_DAYS);

  const saleValue = PLAN_SALE_VALUE_INR[input.planType];

  const ownerMem = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: input.ownerUserId, companyId: input.companyId } },
    select: {
      parentUserId: true,
      salesNetworkRole: true,
      recurringCap: true,
      totalPoints: true,
    },
  });
  if (!ownerMem) {
    throw new Error("OWNER_NOT_IN_COMPANY");
  }

  const subId = await prisma.$transaction(async (tx) => {
    const sub = await tx.salesHierarchySubscription.create({
      data: {
        companyId: input.companyId,
        ownerUserId: input.ownerUserId,
        planType: input.planType,
        points,
        status: SalesHierarchySubscriptionStatus.ACTIVE,
        startedAt,
        expiresAt,
      },
    });

    const prevPoints = ownerMem.totalPoints ?? 0;
    await tx.userCompany.update({
      where: { userId_companyId: { userId: input.ownerUserId, companyId: input.companyId } },
      data: {
        totalPoints: { increment: points },
        activeSubscriptionsCount: { increment: 1 },
      },
    });
    const newPoints = prevPoints + points;

    await tx.salesHierarchyEarning.create({
      data: {
        companyId: input.companyId,
        userId: input.ownerUserId,
        sourceUserId: null,
        subscriptionId: sub.id,
        amount: saleValue,
        type: NetworkCommissionType.DIRECT,
      },
    });

    if (
      ownerMem.salesNetworkRole === SalesNetworkRole.BDE &&
      prevPoints < BDE_POINTS_MILESTONE_FIRST &&
      newPoints >= BDE_POINTS_MILESTONE_FIRST
    ) {
      await tx.salesHierarchyEarning.create({
        data: {
          companyId: input.companyId,
          userId: input.ownerUserId,
          sourceUserId: null,
          subscriptionId: sub.id,
          amount: BDE_MILESTONE_BONUS_INR,
          type: NetworkCommissionType.DIRECT,
        },
      });
    }

    if (ownerMem.salesNetworkRole === SalesNetworkRole.BDE && ownerMem.recurringCap) {
      const recurringAmt = saleValue * 0.1 * BDE_RECURRING_CAP_RATIO;
      await tx.salesHierarchyEarning.create({
        data: {
          companyId: input.companyId,
          userId: input.ownerUserId,
          sourceUserId: null,
          subscriptionId: sub.id,
          amount: recurringAmt,
          type: NetworkCommissionType.RECURRING,
        },
      });
    }

    if (ownerMem.salesNetworkRole === SalesNetworkRole.BDM) {
      const recurringBdm = saleValue * 0.12;
      await tx.salesHierarchyEarning.create({
        data: {
          companyId: input.companyId,
          userId: input.ownerUserId,
          sourceUserId: null,
          subscriptionId: sub.id,
          amount: recurringBdm,
          type: NetworkCommissionType.RECURRING,
        },
      });
    }

    if (ownerMem.salesNetworkRole === SalesNetworkRole.RSM) {
      const regionalPct = saleValue * 0.06;
      await tx.salesHierarchyEarning.create({
        data: {
          companyId: input.companyId,
          userId: input.ownerUserId,
          sourceUserId: null,
          subscriptionId: sub.id,
          amount: regionalPct,
          type: NetworkCommissionType.RECURRING,
        },
      });
    }

    if (ownerMem.salesNetworkRole === SalesNetworkRole.BDE && ownerMem.parentUserId) {
      const parentMem = await tx.userCompany.findUnique({
        where: {
          userId_companyId: { userId: ownerMem.parentUserId, companyId: input.companyId },
        },
        select: { salesNetworkRole: true, parentUserId: true },
      });
      if (parentMem?.salesNetworkRole === SalesNetworkRole.BDM) {
        await tx.salesHierarchyEarning.create({
          data: {
            companyId: input.companyId,
            userId: ownerMem.parentUserId,
            sourceUserId: input.ownerUserId,
            subscriptionId: sub.id,
            amount: saleValue * OVERRIDE_BDM_FROM_BDE,
            type: NetworkCommissionType.OVERRIDE,
          },
        });
        const rsmId = parentMem.parentUserId;
        if (rsmId) {
          const rsmMem = await tx.userCompany.findUnique({
            where: { userId_companyId: { userId: rsmId, companyId: input.companyId } },
            select: { salesNetworkRole: true },
          });
          if (rsmMem?.salesNetworkRole === SalesNetworkRole.RSM) {
            await tx.salesHierarchyEarning.create({
              data: {
                companyId: input.companyId,
                userId: rsmId,
                sourceUserId: input.ownerUserId,
                subscriptionId: sub.id,
                amount: saleValue * OVERRIDE_RSM_FROM_BDM_LAYER,
                type: NetworkCommissionType.OVERRIDE,
              },
            });
          }
        }
      }
    }

    return sub.id;
  });

  const accurate = await getActiveSubscriptionCount(
    prisma,
    input.companyId,
    input.ownerUserId,
  );
  await prisma.userCompany.update({
    where: { userId_companyId: { userId: input.ownerUserId, companyId: input.companyId } },
    data: { activeSubscriptionsCount: accurate },
  });

  if (ownerMem.salesNetworkRole === SalesNetworkRole.BDM) {
    await refreshBdmBenefitLevel(prisma, input.companyId, input.ownerUserId);
  }

  await runSalesHierarchyPromotions(prisma, input.companyId);

  return { subscriptionId: subId };
}
