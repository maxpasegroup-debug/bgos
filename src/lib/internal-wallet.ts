/**
 * Internal Wallet — BGOS staff earnings ledger (bgos_wallet_core_v1).
 *
 * Architecture:
 *   · Every earning event → InternalWalletTransaction (status=PENDING) +
 *     pendingBalance incremented on InternalWallet.
 *   · Approval job  → PENDING → CREDITED; moves amount from pendingBalance
 *     to withdrawableBalance (regular) or bonusBalance (BONUS/REWARD).
 *   · Commission breakdowns are NEVER stored here; the caller decides the
 *     `type` label (DIRECT, RECURRING, BONUS, REWARD, ADJUSTMENT).
 *   · totalBalance = withdrawableBalance + bonusBalance + pendingBalance
 *     (recomputed on each approve pass to stay consistent).
 */

import "server-only";

import {
  InternalWalletTxStatus,
  InternalWalletTxType,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Re-export enums so callers don't import from @prisma/client directly
// ---------------------------------------------------------------------------
export { InternalWalletTxType, InternalWalletTxStatus };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletCreditInput = {
  userId: string;
  amount: number;
  type: InternalWalletTxType;
  /** Links to SalesHierarchyEarning.id or other source record. */
  referenceId?: string;
  note?: string;
};

export type WalletBalance = {
  totalBalance: number;
  withdrawableBalance: number;
  bonusBalance: number;
  pendingBalance: number;
  updatedAt: Date;
};

export type WalletTxRow = {
  id: string;
  type: InternalWalletTxType;
  amount: number;
  status: InternalWalletTxStatus;
  referenceId: string | null;
  note: string | null;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// getOrCreateWallet
// ---------------------------------------------------------------------------

/**
 * Fetches the InternalWallet for `userId`, creating one atomically if missing.
 * Safe to call concurrently — uses upsert.
 */
export async function getOrCreateWallet(
  userId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<WalletBalance> {
  const wallet = await prismaClient.internalWallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: {
      totalBalance: true,
      withdrawableBalance: true,
      bonusBalance: true,
      pendingBalance: true,
      updatedAt: true,
    },
  });
  return wallet;
}

// ---------------------------------------------------------------------------
// creditWallet
// ---------------------------------------------------------------------------

/**
 * Records an earning event:
 *   1. Creates an InternalWalletTransaction with status=PENDING.
 *   2. Increments InternalWallet.pendingBalance by `amount`.
 *   3. Increments totalBalance by `amount`.
 *
 * Must be called AFTER the SalesHierarchyEarning row is committed so
 * `referenceId` can reference the earning's id.
 *
 * Idempotency: if `referenceId` is provided and a transaction with that
 * referenceId already exists, the credit is skipped and the existing
 * transaction is returned.
 */
export async function creditWallet(
  input: WalletCreditInput,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{ txId: string; skipped: boolean }> {
  const { userId, amount, type, referenceId, note } = input;

  // Idempotency check
  if (referenceId) {
    const existing = await prismaClient.internalWalletTransaction.findFirst({
      where: { userId, referenceId },
      select: { id: true },
    });
    if (existing) return { txId: existing.id, skipped: true };
  }

  // Ensure wallet exists
  await getOrCreateWallet(userId, prismaClient);

  const tx = await prismaClient.internalWalletTransaction.create({
    data: { userId, type, amount, status: InternalWalletTxStatus.PENDING, referenceId, note },
    select: { id: true },
  });

  // Atomically bump pending + total balances
  await prismaClient.internalWallet.update({
    where: { userId },
    data: {
      pendingBalance: { increment: amount },
      totalBalance: { increment: amount },
    },
  });

  return { txId: tx.id, skipped: false };
}

// ---------------------------------------------------------------------------
// approveTransactions
// ---------------------------------------------------------------------------

/**
 * Approval pass — moves eligible PENDING transactions to CREDITED.
 *
 * Rules:
 *   · BONUS / REWARD transactions  → credited to bonusBalance
 *   · All other types              → credited to withdrawableBalance
 *   · pendingBalance is decremented by the approved amount
 *
 * Optionally scoped to a set of userIds; if omitted, runs across all users.
 *
 * Returns a summary of how many transactions were approved and the total INR.
 */
export async function approveTransactions(
  userIds?: string[],
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{ count: number; totalAmount: number }> {
  const whereBase = {
    status: InternalWalletTxStatus.PENDING,
    ...(userIds?.length ? { userId: { in: userIds } } : {}),
  };

  // Fetch all pending transactions grouped by user
  const pending = await prismaClient.internalWalletTransaction.findMany({
    where: whereBase,
    select: { id: true, userId: true, amount: true, type: true },
  });

  if (pending.length === 0) return { count: 0, totalAmount: 0 };

  // Compute per-user deltas
  type UserDelta = { withdrawable: number; bonus: number; pending: number };
  const deltas = new Map<string, UserDelta>();

  for (const t of pending) {
    const d = deltas.get(t.userId) ?? { withdrawable: 0, bonus: 0, pending: 0 };
    const isBonus =
      t.type === InternalWalletTxType.BONUS || t.type === InternalWalletTxType.REWARD;
    if (isBonus) d.bonus += t.amount;
    else d.withdrawable += t.amount;
    d.pending += t.amount;
    deltas.set(t.userId, d);
  }

  // Apply in a transaction
  await prismaClient.$transaction([
    // Mark all pending → CREDITED
    prismaClient.internalWalletTransaction.updateMany({
      where: { id: { in: pending.map((t) => t.id) } },
      data: { status: InternalWalletTxStatus.CREDITED },
    }),
    // Update wallet balances per user
    ...Array.from(deltas.entries()).flatMap(([userId, d]) => [
      prismaClient.internalWallet.update({
        where: { userId },
        data: {
          pendingBalance: { decrement: d.pending },
          withdrawableBalance: { increment: d.withdrawable },
          bonusBalance: { increment: d.bonus },
        },
      }),
    ]),
  ]);

  const totalAmount = pending.reduce((s, t) => s + t.amount, 0);
  return { count: pending.length, totalAmount };
}

// ---------------------------------------------------------------------------
// getWalletWithTransactions
// ---------------------------------------------------------------------------

/**
 * Returns the wallet balance + recent transactions for a user.
 * Never exposes raw commission breakdown — just `type` labels.
 */
export async function getWalletWithTransactions(
  userId: string,
  limit = 20,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{
  wallet: WalletBalance;
  recentTransactions: WalletTxRow[];
}> {
  const wallet = await getOrCreateWallet(userId, prismaClient);

  const recentTransactions = await prismaClient.internalWalletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      status: true,
      referenceId: true,
      note: true,
      createdAt: true,
    },
  });

  return { wallet, recentTransactions };
}

// ---------------------------------------------------------------------------
// recordWithdrawal
// @deprecated — use requestWithdrawal from @/lib/internal-withdrawals instead
// ---------------------------------------------------------------------------

export async function recordWithdrawal(
  userId: string,
  amount: number,
  note?: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{ txId: string }> {
  const wallet = await getOrCreateWallet(userId, prismaClient);
  if (wallet.withdrawableBalance < amount) {
    throw new Error("INSUFFICIENT_WITHDRAWABLE_BALANCE");
  }

  const tx = await prismaClient.internalWalletTransaction.create({
    data: {
      userId,
      type: InternalWalletTxType.WITHDRAWAL,
      amount: -amount,
      status: InternalWalletTxStatus.APPROVED,
      note,
    },
    select: { id: true },
  });

  await prismaClient.internalWallet.update({
    where: { userId },
    data: {
      withdrawableBalance: { decrement: amount },
      totalBalance: { decrement: amount },
    },
  });

  return { txId: tx.id };
}
