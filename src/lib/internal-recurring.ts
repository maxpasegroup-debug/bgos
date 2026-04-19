/**
 * Internal Recurring Engine  (bgos_recurring_engine_v1)
 *
 * Calculates and credits monthly recurring income for BDE and BDM roles.
 *
 * BDE:
 *   unlock threshold : ≥ ISE_BDE_RECURRING_UNLOCK_SUBS active subscriptions
 *   monthly amount   : ISE_BDE_RECURRING_MONTHLY (fixed INR)
 *
 * BDM:
 *   monthly amount   = sum of per-plan slabs (ISE_BDM_RECURRING_BY_PLAN)
 *   BASIC slab       : evaluated against network's active BASIC subs
 *   PRO slab         : evaluated against network's active PRO/CUSTOM subs
 *
 * Downgrade grace:
 *   If active subs drop below the current slab threshold, the lower amount
 *   does NOT take effect immediately.  graceSinceAt is stamped.  After
 *   ISE_RECURRING_GRACE_DAYS the lower amount becomes effective.
 *
 * Credit cadence:
 *   The daily cron calls runDailyRecurringCron().  Credits are emitted at
 *   most ONCE per calendar month per user (guarded by lastCreditedAt).
 *   Logic is hidden from all UI/API responses.
 */

import "server-only";

import {
  NetworkCommissionType,
  SalesHierarchySubscriptionStatus,
  SalesNetworkRole,
  SalesHierarchyPlan,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { creditWallet, InternalWalletTxType } from "@/lib/internal-wallet";
import {
  ISE_BDE_RECURRING_MONTHLY,
  ISE_BDE_RECURRING_UNLOCK_SUBS,
  ISE_BDM_RECURRING_BY_PLAN,
  ISE_RECURRING_GRACE_DAYS,
  type BdmPlanRecurringSlab,
} from "@/config/internal-sales-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecurringCalculation = {
  userId: string;
  companyId: string;
  role: SalesNetworkRole;
  /** Active subscription breakdown (for BDE: own; for BDM: network). */
  activeSubs: {
    basic: number;
    pro: number;
    total: number;
  };
  /** Raw monthly amount based purely on current active subs. */
  rawMonthlyAmount: number;
};

export type CronRunSummary = {
  processed: number;
  credited: number;
  totalCredited: number;
  skippedGrace: number;
  errors: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the highest applicable slab amount for a given plan count. */
function resolvePlanSlab(slabs: BdmPlanRecurringSlab[], count: number): number {
  let best = 0;
  for (const s of slabs) {
    if (count >= s.minSubs) best = s.monthlyAmount;
  }
  return best;
}

/** Active-subscription where clause (status=ACTIVE AND expiresAt >= now). */
function activeWhere(companyId: string, ownerUserId: string, planType?: SalesHierarchyPlan) {
  const now = new Date();
  return {
    companyId,
    ownerUserId,
    status: SalesHierarchySubscriptionStatus.ACTIVE,
    expiresAt: { gte: now },
    ...(planType ? { planType } : {}),
  };
}

/** Returns the calendar-month string (YYYY-MM) for a date. */
function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

// ---------------------------------------------------------------------------
// calculateRecurring
// ---------------------------------------------------------------------------

/**
 * Computes the raw monthly recurring amount for a user without persisting state.
 * Respects active-subscription definition: status=ACTIVE AND expiresAt >= today.
 */
export async function calculateRecurring(
  userId: string,
  companyId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<RecurringCalculation | null> {
  const mem = await prismaClient.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { salesNetworkRole: true, archivedAt: true },
  });

  if (!mem?.salesNetworkRole || mem.archivedAt) return null;

  const role = mem.salesNetworkRole;

  // ── BDE ──────────────────────────────────────────────────────────────────
  if (role === SalesNetworkRole.BDE) {
    const total = await prismaClient.salesHierarchySubscription.count({
      where: activeWhere(companyId, userId),
    });

    const rawMonthlyAmount =
      total >= ISE_BDE_RECURRING_UNLOCK_SUBS ? ISE_BDE_RECURRING_MONTHLY : 0;

    return {
      userId,
      companyId,
      role,
      activeSubs: { basic: total, pro: 0, total },
      rawMonthlyAmount,
    };
  }

  // ── BDM ──────────────────────────────────────────────────────────────────
  if (role === SalesNetworkRole.BDM) {
    // Collect all direct BDE children
    const bdes = await prismaClient.userCompany.findMany({
      where: {
        companyId,
        parentUserId: userId,
        salesNetworkRole: SalesNetworkRole.BDE,
        archivedAt: null,
      },
      select: { userId: true },
    });

    if (bdes.length === 0) {
      return { userId, companyId, role, activeSubs: { basic: 0, pro: 0, total: 0 }, rawMonthlyAmount: 0 };
    }

    const bdeUserIds = bdes.map((b) => b.userId);
    const now = new Date();

    const [basicCount, proCustomCount] = await Promise.all([
      prismaClient.salesHierarchySubscription.count({
        where: {
          companyId,
          ownerUserId: { in: bdeUserIds },
          planType: SalesHierarchyPlan.BASIC,
          status: SalesHierarchySubscriptionStatus.ACTIVE,
          expiresAt: { gte: now },
        },
      }),
      prismaClient.salesHierarchySubscription.count({
        where: {
          companyId,
          ownerUserId: { in: bdeUserIds },
          planType: { in: [SalesHierarchyPlan.PRO, SalesHierarchyPlan.CUSTOM] },
          status: SalesHierarchySubscriptionStatus.ACTIVE,
          expiresAt: { gte: now },
        },
      }),
    ]);

    const basicSlab = resolvePlanSlab(ISE_BDM_RECURRING_BY_PLAN.BASIC, basicCount);
    const proSlab   = resolvePlanSlab(ISE_BDM_RECURRING_BY_PLAN.PRO,   proCustomCount);

    return {
      userId,
      companyId,
      role,
      activeSubs: { basic: basicCount, pro: proCustomCount, total: basicCount + proCustomCount },
      rawMonthlyAmount: basicSlab + proSlab,
    };
  }

  // Other roles (RSM, BOSS, TECH_EXEC) — no recurring defined in this spec
  return null;
}

// ---------------------------------------------------------------------------
// applyGraceAndUpdate
// ---------------------------------------------------------------------------

/**
 * Reads/writes InternalRecurringState, applies grace-period logic, and
 * returns the effective amount that should be credited this run.
 *
 * Side-effects: upserts InternalRecurringState for the user.
 */
async function applyGraceAndUpdate(
  calc: RecurringCalculation,
  prismaClient: PrismaClient,
): Promise<{ effectiveAmount: number; graceSkipped: boolean }> {
  const now = new Date();

  const existing = await prismaClient.internalRecurringState.findUnique({
    where: { userId: calc.userId },
    select: {
      effectiveAmount: true,
      pendingAmount: true,
      graceSinceAt: true,
    },
  });

  const currentEffective = existing?.effectiveAmount ?? 0;
  const raw = calc.rawMonthlyAmount;
  let newEffective = raw;
  let graceSinceAt: Date | null = existing?.graceSinceAt ?? null;
  let graceSkipped = false;

  if (raw < currentEffective) {
    // Potential downgrade
    if (!graceSinceAt) {
      // Start the grace clock; keep old effective amount for now
      graceSinceAt = now;
      newEffective = currentEffective;
      graceSkipped = true;
    } else {
      const daysSinceGrace = (now.getTime() - graceSinceAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceGrace < ISE_RECURRING_GRACE_DAYS) {
        // Still within grace — hold at old effective
        newEffective = currentEffective;
        graceSkipped = true;
      } else {
        // Grace expired — apply the lower amount
        newEffective = raw;
        graceSinceAt = null;
      }
    }
  } else {
    // Upgrade or same level — apply immediately, clear any grace clock
    graceSinceAt = null;
    newEffective = raw;
  }

  await prismaClient.internalRecurringState.upsert({
    where: { userId: calc.userId },
    create: {
      userId: calc.userId,
      companyId: calc.companyId,
      effectiveAmount: newEffective,
      pendingAmount: raw,
      graceSinceAt,
      lastCalculatedAt: now,
    },
    update: {
      companyId: calc.companyId,
      effectiveAmount: newEffective,
      pendingAmount: raw,
      graceSinceAt,
      lastCalculatedAt: now,
    },
  });

  return { effectiveAmount: newEffective, graceSkipped };
}

// ---------------------------------------------------------------------------
// creditMonthlyRecurring
// ---------------------------------------------------------------------------

/**
 * Emits a SalesHierarchyEarning (type=RECURRING) and an InternalWalletTransaction
 * for the user, then stamps lastCreditedAt.
 *
 * Idempotent: the wallet credit carries a deduplicated referenceId.
 */
async function creditMonthlyRecurring(
  userId: string,
  companyId: string,
  amount: number,
  creditMonth: string, // YYYY-MM
  prismaClient: PrismaClient,
): Promise<void> {
  const refId = `recurring:${userId}:${creditMonth}`;

  // Earning record
  await prismaClient.salesHierarchyEarning.create({
    data: {
      companyId,
      userId,
      sourceUserId: null,
      subscriptionId: null,
      amount,
      type: NetworkCommissionType.RECURRING,
    },
  });

  // Wallet credit (PENDING until approval pass)
  await creditWallet(
    {
      userId,
      amount,
      type: InternalWalletTxType.RECURRING,
      referenceId: refId,
      note: `Monthly recurring ${creditMonth}`,
    },
    prismaClient,
  );

  // Update state
  await prismaClient.internalRecurringState.update({
    where: { userId },
    data: { lastCreditedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// runDailyRecurringCron
// ---------------------------------------------------------------------------

/**
 * Daily cron entry point.
 *
 * For each active internal staff member (BDE + BDM):
 *   1. Calculate raw recurring based on live active subs.
 *   2. Apply grace-period logic → derive effective monthly amount.
 *   3. If effective > 0 and user has not been credited this calendar month,
 *      emit SalesHierarchyEarning + InternalWalletTransaction.
 *
 * Commission logic is kept entirely server-side; nothing is returned that
 * would expose slab rates or tier thresholds.
 */
export async function runDailyRecurringCron(
  prismaClient: PrismaClient = defaultPrisma,
): Promise<CronRunSummary> {
  const summary: CronRunSummary = {
    processed: 0,
    credited: 0,
    totalCredited: 0,
    skippedGrace: 0,
    errors: 0,
  };

  const currentMonth = monthKey(new Date());

  // Fetch all active BDE/BDM members across the network
  const members = await prismaClient.userCompany.findMany({
    where: {
      salesNetworkRole: { in: [SalesNetworkRole.BDE, SalesNetworkRole.BDM] },
      archivedAt: null,
    },
    select: { userId: true, companyId: true },
    distinct: ["userId"], // one row per person if multiple companies
  });

  for (const { userId, companyId } of members) {
    summary.processed++;

    try {
      const calc = await calculateRecurring(userId, companyId, prismaClient);
      if (!calc) continue;

      const { effectiveAmount, graceSkipped } = await applyGraceAndUpdate(calc, prismaClient);

      if (graceSkipped) {
        summary.skippedGrace++;
      }

      if (effectiveAmount <= 0) continue;

      // Guard: credit only once per calendar month
      const state = await prismaClient.internalRecurringState.findUnique({
        where: { userId },
        select: { lastCreditedAt: true },
      });
      const alreadyCredited =
        state?.lastCreditedAt && monthKey(state.lastCreditedAt) === currentMonth;
      if (alreadyCredited) continue;

      await creditMonthlyRecurring(userId, companyId, effectiveAmount, currentMonth, prismaClient);

      summary.credited++;
      summary.totalCredited += effectiveAmount;
    } catch (err) {
      summary.errors++;
      console.error(`[recurring-cron] user=${userId}`, err);
    }
  }

  return summary;
}
