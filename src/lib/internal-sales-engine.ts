/**
 * Internal Sales Engine — handleSale() and supporting helpers.
 *
 * Uses the commission values defined in src/config/internal-sales-engine.ts.
 * Writes to the SAME Prisma models as the existing sales-hierarchy lib
 * (SalesHierarchySubscription, SalesHierarchyEarning, UserCompany, PromotionTracker)
 * so dashboards built on those models work without modification.
 */

import "server-only";

import { NetworkCommissionType, SalesHierarchySubscriptionStatus, SalesNetworkRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  ISE_BDE_RECURRING_UNLOCK_SUBS,
  ISE_BDM_RECURRING_TIERS,
  ISE_BDM_TO_RSM_MIN_BDES,
  ISE_BDM_TO_RSM_MIN_NETWORK_POINTS,
  ISE_BDE_TO_BDM_ACTIVE_SUBS,
  ISE_DIRECT_COMMISSION,
  ISE_MILESTONE_BONUS_AMOUNT,
  ISE_MILESTONE_POINTS_THRESHOLD,
  ISE_OVERRIDE_BDM,
  ISE_OVERRIDE_RSM,
  ISE_POINTS_BY_PLAN,
  ISE_SUBSCRIPTION_TERM_DAYS,
  type BdmRecurringTier,
} from "@/config/internal-sales-engine";
import { getActiveSubscriptionCount } from "@/lib/sales-hierarchy/active-subscriptions";
import { refreshBdmBenefitLevel } from "@/lib/sales-hierarchy/benefit-level";
import { runSalesHierarchyPromotions } from "@/lib/sales-hierarchy/promotion-v1";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { creditWallet, InternalWalletTxType } from "@/lib/internal-wallet";
import { unlockRewardForTrigger, InternalRewardTriggerType } from "@/lib/internal-rewards";
import { distributeOverrideEarnings } from "@/lib/internal-hierarchy-earnings";
import {
  checkDuplicateSale,
  logFraudEvent,
} from "@/lib/internal-fraud-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IseInternalPlan = "BASIC" | "PRO" | "ENTERPRISE";

export type HandleSaleInput = {
  /** The BGOS internal sales org companyId. */
  companyId: string;
  /** userId of the BDE who made the sale. */
  soldByUserId: string;
  /** Subscription plan sold to the client company. */
  planType: IseInternalPlan;
  /** Dynamic points override for ENTERPRISE (range 3–5, i.e. 30–50 scaled). */
  enterprisePointsOverride?: number;
  /**
   * Optional client identifiers — used by the fraud guard to detect
   * duplicate contact/email across different BDEs.
   */
  clientEmail?: string | null;
  clientPhone?: string | null;
};

export type HandleSaleResult = {
  subscriptionId: string;
  points: number;
  directAmount: number;
  milestoneBonus: boolean;
  recurringUnlocked: boolean;
  promoted: boolean;
  /** True when the fraud guard flagged this sale as a duplicate. Wallet credits are withheld. */
  fraudFlagged: boolean;
  fraudReason?: string;
};

// ---------------------------------------------------------------------------
// Internal plan → SalesHierarchyPlan adapter
// The existing schema uses BASIC/PRO/CUSTOM; ENTERPRISE maps to CUSTOM here.
// ---------------------------------------------------------------------------

function toSchemaHierarchyPlan(plan: IseInternalPlan) {
  // We use the raw string so we don't import SalesHierarchyPlan (avoids drift)
  if (plan === "ENTERPRISE") return "CUSTOM" as const;
  return plan as "BASIC" | "PRO";
}

// ---------------------------------------------------------------------------
// handleSale
// ---------------------------------------------------------------------------

/**
 * Records a BDE sale in the internal sales engine:
 *
 * 1. Creates SalesHierarchySubscription
 * 2. Updates UserCompany.totalPoints + activeSubscriptionsCount
 * 3. Writes DIRECT earning to the seller
 * 4. Walks up hierarchy → writes OVERRIDE earnings to BDM and RSM
 * 5. Checks 20-display-point milestone → writes BONUS earning if newly crossed
 * 6. Checks BDE recurring unlock (≥20 active subs, hidden)
 * 7. Refreshes BDM benefit level if caller is BDM
 * 8. Runs promotion evaluation (BDE→BDM, BDM→RSM)
 */
export async function handleSale(
  input: HandleSaleInput,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<HandleSaleResult> {
  const { companyId, soldByUserId, planType, clientEmail, clientPhone } = input;

  // -------------------------------------------------------------------------
  // Fraud guard — duplicate contact/email check BEFORE any DB writes
  // -------------------------------------------------------------------------
  const fraudCheck = await checkDuplicateSale(
    { companyId, soldByUserId, clientEmail, clientPhone },
    prismaClient,
  );

  const basePoints = ISE_POINTS_BY_PLAN[planType];
  const enterpriseOverride = input.enterprisePointsOverride;
  const scaledPoints =
    planType === "ENTERPRISE" && enterpriseOverride != null
      ? Math.min(50, Math.max(30, enterpriseOverride * 10))
      : basePoints;

  const directAmount = ISE_DIRECT_COMMISSION[planType];
  const overrideBdm = ISE_OVERRIDE_BDM[planType];
  const overrideRsm = ISE_OVERRIDE_RSM[planType];

  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + ISE_SUBSCRIPTION_TERM_DAYS);

  // Fetch seller's hierarchy membership
  const sellerMem = await prismaClient.userCompany.findUnique({
    where: { userId_companyId: { userId: soldByUserId, companyId } },
    select: { salesNetworkRole: true, parentUserId: true, totalPoints: true },
  });
  if (!sellerMem) throw new Error("SELLER_NOT_IN_COMPANY");

  // --- Transaction: subscription + points + earnings ---
  const { subscriptionId, milestoneBonus, resolvedBdmId, resolvedRsmId } = await prismaClient.$transaction(async (tx) => {
    // 1. Create subscription (mapped to SalesHierarchyPlan)
    const sub = await tx.salesHierarchySubscription.create({
      data: {
        companyId,
        ownerUserId: soldByUserId,
        planType: toSchemaHierarchyPlan(planType),
        points: scaledPoints,
        status: SalesHierarchySubscriptionStatus.ACTIVE,
        startedAt,
        expiresAt,
        // Client identifiers for future duplicate detection
        clientEmail: clientEmail?.trim().toLowerCase() ?? null,
        clientPhone: clientPhone?.trim() ?? null,
        // Fraud guard: flag immediately if duplicate detected
        fraudFlagged: fraudCheck.flagged,
        fraudReason:  fraudCheck.flagged ? fraudCheck.reason : null,
      },
    });

    // 2. Increment seller's points + subs
    const updated = await tx.userCompany.update({
      where: { userId_companyId: { userId: soldByUserId, companyId } },
      data: {
        totalPoints: { increment: scaledPoints },
        activeSubscriptionsCount: { increment: 1 },
      },
      select: { totalPoints: true },
    });

    // 3. Direct earning to seller
    await tx.salesHierarchyEarning.create({
      data: {
        companyId,
        userId: soldByUserId,
        sourceUserId: null,
        subscriptionId: sub.id,
        amount: directAmount,
        type: NetworkCommissionType.DIRECT,
      },
    });

    // 4. Override earnings — distributed via dedicated function (bgos_hierarchy_earnings_v1)
    //    Handles BDE→BDM→RSM and BDM→RSM chains; idempotent (no duplicate rows).
    const overrideResult = await distributeOverrideEarnings(
      {
        companyId,
        subscriptionId: sub.id,
        soldByUserId,
        sellerRole: sellerMem.salesNetworkRole ?? SalesNetworkRole.BDE,
        sellerParentUserId: sellerMem.parentUserId ?? null,
        planType,
      },
      tx as unknown as Pick<PrismaClient, "salesHierarchyEarning" | "userCompany">,
    );

    const { bdmId, rsmId } = overrideResult;

    // 5. Milestone bonus — check if threshold newly crossed
    const prevPoints = sellerMem.totalPoints ?? 0;
    const newPoints = updated.totalPoints;
    const milestoneBonus =
      prevPoints < ISE_MILESTONE_POINTS_THRESHOLD &&
      newPoints >= ISE_MILESTONE_POINTS_THRESHOLD;

    if (milestoneBonus) {
      await tx.salesHierarchyEarning.create({
        data: {
          companyId,
          userId: soldByUserId,
          sourceUserId: null,
          subscriptionId: sub.id,
          amount: ISE_MILESTONE_BONUS_AMOUNT,
          type: NetworkCommissionType.DIRECT,
        },
      });
    }

    return { subscriptionId: sub.id, milestoneBonus, resolvedBdmId: bdmId, resolvedRsmId: rsmId };
  });

  // -------------------------------------------------------------------------
  // Fraud guard — log the event and BLOCK wallet credits for flagged sales
  // -------------------------------------------------------------------------
  if (fraudCheck.flagged) {
    await logFraudEvent(
      {
        companyId,
        triggeredByUserId: soldByUserId,
        subscriptionId,
        reason:      fraudCheck.reason,
        description: fraudCheck.description,
        metadata:    fraudCheck.meta,
      },
      prismaClient,
    );

    // Skip all wallet credits — return early with fraud flag
    return {
      subscriptionId,
      points:            scaledPoints,
      directAmount:      0,
      milestoneBonus:    false,
      recurringUnlocked: false,
      promoted:          false,
      fraudFlagged:      true,
      fraudReason:       fraudCheck.reason,
    };
  }

  // --- Post-transaction: wallet credits (fire-and-forget per earning) ---
  // We credit the wallet AFTER the main transaction commits so referenceId
  // stability is guaranteed. All amounts are PENDING until the approval job runs.
  // Commission breakdown is NOT exposed — only the type label is stored.
  await Promise.all([
    // Direct earning → seller
    creditWallet({
      userId: soldByUserId,
      amount: directAmount,
      type: InternalWalletTxType.DIRECT,
      referenceId: `sale:${subscriptionId}:direct`,
      note: `${planType} sale`,
    }, prismaClient),

    // Override → BDM
    ...(resolvedBdmId
      ? [creditWallet({
          userId: resolvedBdmId,
          amount: overrideBdm,
          type: InternalWalletTxType.DIRECT,
          referenceId: `sale:${subscriptionId}:override_bdm`,
          note: `Team override (${planType})`,
        }, prismaClient)]
      : []),

    // Override → RSM
    ...(resolvedRsmId
      ? [creditWallet({
          userId: resolvedRsmId,
          amount: overrideRsm,
          type: InternalWalletTxType.DIRECT,
          referenceId: `sale:${subscriptionId}:override_rsm`,
          note: `Region override (${planType})`,
        }, prismaClient)]
      : []),

    // Milestone bonus → seller
    ...(milestoneBonus
      ? [creditWallet({
          userId: soldByUserId,
          amount: ISE_MILESTONE_BONUS_AMOUNT,
          type: InternalWalletTxType.BONUS,
          referenceId: `sale:${subscriptionId}:milestone`,
          note: "Milestone bonus",
        }, prismaClient)]
      : []),
  ]);

  // --- Post-transaction: accurate active count sync ---
  const accurateCount = await getActiveSubscriptionCount(
    prismaClient,
    companyId,
    soldByUserId,
  );
  await prismaClient.userCompany.update({
    where: { userId_companyId: { userId: soldByUserId, companyId } },
    data: { activeSubscriptionsCount: accurateCount },
  });

  // 6. BDE recurring unlock check (hidden — do not surface in public responses)
  const recurringUnlocked =
    sellerMem.salesNetworkRole === SalesNetworkRole.BDE &&
    accurateCount >= ISE_BDE_RECURRING_UNLOCK_SUBS;

  // 7. BDM benefit level refresh
  if (sellerMem.salesNetworkRole === SalesNetworkRole.BDM) {
    await refreshBdmBenefitLevel(prismaClient, companyId, soldByUserId);
  }

  // 8. Promotion evaluation
  const before = await prismaClient.userCompany.findUnique({
    where: { userId_companyId: { userId: soldByUserId, companyId } },
    select: { salesNetworkRole: true },
  });
  await runSalesHierarchyPromotions(prismaClient, companyId);
  const after = await prismaClient.userCompany.findUnique({
    where: { userId_companyId: { userId: soldByUserId, companyId } },
    select: { salesNetworkRole: true },
  });
  const promoted = before?.salesNetworkRole !== after?.salesNetworkRole;

  // 9. Reward trigger checks — fire-and-forget, never blocks the sale result.
  //    Uses display points (÷10 scale) and accurate subscription count.
  const displayPointsAfter = Math.round(
    ((sellerMem.totalPoints ?? 0) + scaledPoints) / 10,
  );
  const displayPointsBefore = Math.round((sellerMem.totalPoints ?? 0) / 10);
  const salesBefore = Math.max(0, accurateCount - 1);

  await Promise.all([
    // POINTS trigger
    unlockRewardForTrigger(
      soldByUserId,
      {
        triggerType: InternalRewardTriggerType.POINTS,
        currentValue: displayPointsAfter,
        previousValue: displayPointsBefore,
      },
      prismaClient,
    ),
    // SALES trigger
    unlockRewardForTrigger(
      soldByUserId,
      {
        triggerType: InternalRewardTriggerType.SALES,
        currentValue: accurateCount,
        previousValue: salesBefore,
      },
      prismaClient,
    ),
  ]);

  return {
    subscriptionId,
    points: scaledPoints,
    directAmount,
    milestoneBonus,
    recurringUnlocked,
    promoted,
    fraudFlagged: false,
  };
}

// ---------------------------------------------------------------------------
// Recurring income helpers
// ---------------------------------------------------------------------------

/**
 * Returns the applicable BDM recurring tier based on active network subs.
 * Returns null if below the first tier.
 */
export function getBdmRecurringTier(networkActiveSubs: number): BdmRecurringTier | null {
  let best: BdmRecurringTier | null = null;
  for (const tier of ISE_BDM_RECURRING_TIERS) {
    if (networkActiveSubs >= tier.minSubs) {
      best = tier;
    }
  }
  return best;
}

/**
 * Returns whether a BDE has unlocked recurring income (≥20 active subs).
 * Intentionally separate from main response — kept hidden in API outputs.
 */
export async function bdeRecurringUnlocked(
  companyId: string,
  userId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<boolean> {
  const count = await getActiveSubscriptionCount(prismaClient, companyId, userId);
  return count >= ISE_BDE_RECURRING_UNLOCK_SUBS;
}

/**
 * Calculates a BDM's total network active subscriptions (direct BDE children).
 */
export async function getBdmNetworkActiveSubs(
  companyId: string,
  bdmUserId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<number> {
  const children = await prismaClient.userCompany.findMany({
    where: { companyId, parentUserId: bdmUserId, salesNetworkRole: SalesNetworkRole.BDE, archivedAt: null },
    select: { userId: true },
  });
  let total = 0;
  for (const c of children) {
    total += await getActiveSubscriptionCount(prismaClient, companyId, c.userId);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Promotion tracker snapshot
// ---------------------------------------------------------------------------

export type PromotionTrackerSnapshot = {
  userId: string;
  role: SalesNetworkRole | null;
  totalPoints: number;
  activeSubscriptions: number;
  currentLevel: string;
  promotionEligible: boolean;
  eligibleForPromotion: boolean;
  roleTarget: SalesNetworkRole | null;
  activeCountSnapshot: number | null;
  lastPromotionCheckAt: string | null;
};

export async function getPromotionTrackerSnapshot(
  companyId: string,
  userId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<PromotionTrackerSnapshot> {
  const [mem, tracker, activeSubs] = await Promise.all([
    prismaClient.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { salesNetworkRole: true, totalPoints: true, activeSubscriptionsCount: true },
    }),
    prismaClient.promotionTracker.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: {
        eligibleForPromotion: true,
        roleTarget: true,
        activeCountSnapshot: true,
        lastPromotionCheckAt: true,
      },
    }),
    getActiveSubscriptionCount(prismaClient, companyId, userId),
  ]);

  const role = mem?.salesNetworkRole ?? null;
  const totalPoints = mem?.totalPoints ?? 0;

  return {
    userId,
    role,
    totalPoints,
    activeSubscriptions: activeSubs,
    currentLevel: role?.toLowerCase() ?? "none",
    promotionEligible: tracker?.eligibleForPromotion ?? false,
    eligibleForPromotion: tracker?.eligibleForPromotion ?? false,
    roleTarget: tracker?.roleTarget ?? null,
    activeCountSnapshot: tracker?.activeCountSnapshot ?? null,
    lastPromotionCheckAt: tracker?.lastPromotionCheckAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Monthly stats
// ---------------------------------------------------------------------------

export async function getMonthlyStats(
  companyId: string,
  userId: string,
  months: number = 6,
  prismaClient: PrismaClient = defaultPrisma,
) {
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months);

  const earnings = await prismaClient.salesHierarchyEarning.findMany({
    where: { companyId, userId, createdAt: { gte: from } },
    select: { amount: true, type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const subs = await prismaClient.salesHierarchySubscription.findMany({
    where: { companyId, ownerUserId: userId, startedAt: { gte: from } },
    select: { planType: true, points: true, startedAt: true, status: true, expiresAt: true },
    orderBy: { startedAt: "asc" },
  });

  // Group earnings by calendar month
  const byMonth: Record<string, { month: string; direct: number; override: number; recurring: number; total: number }> = {};
  for (const e of earnings) {
    const key = e.createdAt.toISOString().slice(0, 7);
    if (!byMonth[key]) byMonth[key] = { month: key, direct: 0, override: 0, recurring: 0, total: 0 };
    const bucket = byMonth[key]!;
    if (e.type === NetworkCommissionType.DIRECT) bucket.direct += e.amount;
    else if (e.type === NetworkCommissionType.OVERRIDE) bucket.override += e.amount;
    else if (e.type === NetworkCommissionType.RECURRING) bucket.recurring += e.amount;
    bucket.total += e.amount;
  }

  const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
  const activeSubs = subs.filter(
    (s) => s.status === SalesHierarchySubscriptionStatus.ACTIVE && s.expiresAt >= new Date(),
  ).length;

  return {
    totalEarnings,
    activeSubs,
    monthlyBreakdown: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    recentSubscriptions: subs.slice(-10).map((s) => ({
      planType: s.planType,
      points: s.points,
      startedAt: s.startedAt.toISOString(),
      status: s.status,
      expiresAt: s.expiresAt.toISOString(),
    })),
  };
}
