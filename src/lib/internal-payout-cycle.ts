/**
 * Monthly Payout Cycle  (bgos_payout_cycle_v1)
 *
 * The ONLY authorised path from earnings → withdrawable balance.
 * Direct calls to approveTransactions() from outside this module are
 * intentionally not re-exported; all balance promotion flows through here.
 *
 * Lifecycle:
 *   1. runDailyRecurringCron()   — ensure recurring credits are in the system
 *   2. approveEarnings()         — PENDING → APPROVED on SalesHierarchyEarning
 *   3. approveTransactions()     — PENDING → CREDITED on InternalWalletTransaction
 *                                  pendingBalance → withdrawableBalance / bonusBalance
 *   4. markEarningsPaid()        — APPROVED → PAID on SalesHierarchyEarning
 *
 * Steps 2–4 run inside a single logical cycle so the earning record and the
 * wallet transaction always agree.  Steps are idempotent: re-running the cycle
 * in the same month is safe (step 1 guards against double recurring credits;
 * steps 3–4 only touch rows whose status hasn't moved yet).
 *
 * STRICT: no amounts, commission rates, or user breakdowns are returned by the
 * public API surface of this module.
 */

import "server-only";

import { EarningPayoutStatus, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { approveTransactions } from "@/lib/internal-wallet";
import { runDailyRecurringCron } from "@/lib/internal-recurring";

export { EarningPayoutStatus };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayoutCycleSummary = {
  /** How many SalesHierarchyEarning rows moved PENDING → APPROVED. */
  earningsApproved: number;
  /** How many InternalWalletTransaction rows moved PENDING → CREDITED. */
  walletTxCredited: number;
  /** How many SalesHierarchyEarning rows moved APPROVED → PAID. */
  earningsPaid: number;
  /** Recurring summary from the pre-cycle recurring pass. */
  recurring: {
    credited: number;
    skippedGrace: number;
    errors: number;
  };
  errors: string[];
};

// ---------------------------------------------------------------------------
// approveEarnings  (internal — not exported as standalone)
// ---------------------------------------------------------------------------

/**
 * Marks all PENDING SalesHierarchyEarning rows as APPROVED.
 * Optionally scoped to a cutoff date (defaults to now — approve everything up
 * to this instant).
 *
 * Returns the IDs of the newly approved earnings and the userIds involved.
 */
async function approveEarnings(
  cutoffDate: Date,
  prismaClient: PrismaClient,
): Promise<{ approvedIds: string[]; userIds: string[] }> {
  const now = new Date();

  // Fetch all PENDING earnings created on or before the cutoff
  const pending = await prismaClient.salesHierarchyEarning.findMany({
    where: {
      payoutStatus: EarningPayoutStatus.PENDING,
      createdAt: { lte: cutoffDate },
    },
    select: { id: true, userId: true },
  });

  if (pending.length === 0) return { approvedIds: [], userIds: [] };

  const ids = pending.map((e) => e.id);
  const userIds = [...new Set(pending.map((e) => e.userId))];

  await prismaClient.salesHierarchyEarning.updateMany({
    where: { id: { in: ids } },
    data: {
      payoutStatus: EarningPayoutStatus.APPROVED,
      approvedAt: now,
    },
  });

  return { approvedIds: ids, userIds };
}

// ---------------------------------------------------------------------------
// markEarningsPaid  (internal — not exported as standalone)
// ---------------------------------------------------------------------------

async function markEarningsPaid(
  earningIds: string[],
  prismaClient: PrismaClient,
): Promise<void> {
  if (earningIds.length === 0) return;
  const now = new Date();

  await prismaClient.salesHierarchyEarning.updateMany({
    where: {
      id: { in: earningIds },
      payoutStatus: EarningPayoutStatus.APPROVED,
    },
    data: {
      payoutStatus: EarningPayoutStatus.PAID,
      paidAt: now,
    },
  });
}

// ---------------------------------------------------------------------------
// runMonthlyPayoutCycle
// ---------------------------------------------------------------------------

/**
 * Runs the full monthly payout cycle:
 *
 *   1. runDailyRecurringCron()     — finalise recurring income for the month
 *   2. approveEarnings()           — PENDING → APPROVED on all eligible earnings
 *   3. approveTransactions()       — PENDING → CREDITED on wallet txns for
 *                                    involved users; updates wallet balances
 *   4. markEarningsPaid()          — APPROVED → PAID sealing the cycle
 *
 * The `cutoffDate` (default: now) lets callers scope the approval window —
 * e.g. end-of-month boundary to avoid approving earnings that arrived mid-run.
 *
 * Returns an opaque summary suitable for cron logging. No amounts are
 * included in the public return type to prevent commission data leakage.
 */
export async function runMonthlyPayoutCycle(
  cutoffDate: Date = new Date(),
  prismaClient: PrismaClient = defaultPrisma,
): Promise<PayoutCycleSummary> {
  const summary: PayoutCycleSummary = {
    earningsApproved: 0,
    walletTxCredited: 0,
    earningsPaid: 0,
    recurring: { credited: 0, skippedGrace: 0, errors: 0 },
    errors: [],
  };

  // ── Step 1: Finalise recurring income for this month ──────────────────────
  try {
    const recurringSummary = await runDailyRecurringCron(prismaClient);
    summary.recurring = {
      credited: recurringSummary.credited,
      skippedGrace: recurringSummary.skippedGrace,
      errors: recurringSummary.errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`recurring-cron: ${msg}`);
    // Non-fatal — continue with the rest of the cycle
  }

  // ── Step 2: Approve all pending earnings up to cutoff ────────────────────
  let approvedIds: string[] = [];
  let affectedUserIds: string[] = [];

  try {
    const result = await approveEarnings(cutoffDate, prismaClient);
    approvedIds = result.approvedIds;
    affectedUserIds = result.userIds;
    summary.earningsApproved = approvedIds.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`approve-earnings: ${msg}`);
    return summary; // Cannot proceed without approved earnings
  }

  // ── Step 3: Move wallet transactions from pending → credited ─────────────
  // Scoped to users who had earnings approved in step 2, plus any users with
  // un-credited BONUS/REWARD transactions (scratch cards, milestones).
  try {
    const walletResult = await approveTransactions(
      affectedUserIds.length > 0 ? affectedUserIds : undefined,
      prismaClient,
    );
    summary.walletTxCredited = walletResult.count;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`approve-wallet-txns: ${msg}`);
    // Non-fatal — mark earnings paid even if wallet step had issues
  }

  // ── Step 4: Seal the cycle — mark earnings PAID ───────────────────────────
  try {
    await markEarningsPaid(approvedIds, prismaClient);
    summary.earningsPaid = approvedIds.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`mark-paid: ${msg}`);
  }

  return summary;
}

// ---------------------------------------------------------------------------
// getPayoutStats  (read-only — safe for Boss dashboard)
// ---------------------------------------------------------------------------

/**
 * Returns opaque stats about the current payout backlog.
 * Never exposes amounts, commission rates, or user-level breakdowns.
 */
export async function getPayoutStats(
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{
  pendingEarningsCount: number;
  approvedEarningsCount: number;
  pendingWalletTxCount: number;
}> {
  const [pendingEarnings, approvedEarnings, pendingWalletTx] = await Promise.all([
    prismaClient.salesHierarchyEarning.count({
      where: { payoutStatus: EarningPayoutStatus.PENDING },
    }),
    prismaClient.salesHierarchyEarning.count({
      where: { payoutStatus: EarningPayoutStatus.APPROVED },
    }),
    prismaClient.internalWalletTransaction.count({
      where: { status: { in: ["PENDING" as const] } },
    }),
  ]);

  return {
    pendingEarningsCount: pendingEarnings,
    approvedEarningsCount: approvedEarnings,
    pendingWalletTxCount: pendingWalletTx,
  };
}
