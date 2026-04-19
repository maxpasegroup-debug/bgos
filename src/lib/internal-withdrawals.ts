/**
 * Internal Withdrawal System (bgos_payout_withdrawal_v1).
 *
 * Flow:
 *   requestWithdrawal  → status=REQUESTED,  withdrawable -= amount (hold)
 *                        audit: WITHDRAWAL tx PENDING
 *   approveWithdrawal  → status=APPROVED,   no balance change
 *                        audit: tx → APPROVED
 *   payWithdrawal      → status=PAID,        no balance change (final)
 *                        audit: tx → CREDITED
 *   rejectWithdrawal   → status=REJECTED,    withdrawable += amount (unhold)
 *                        audit: tx → REJECTED
 *
 * Every balance movement is mirrored in InternalWalletTransaction.
 * BDE-agreement acceptance (wallet.agreementAcceptedAt) is required before
 * the first withdrawal can be requested.
 */

import "server-only";

import {
  InternalWithdrawalStatus,
  InternalWalletTxType,
  InternalWalletTxStatus,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/internal-wallet";

export { InternalWithdrawalStatus };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum withdrawal amount in INR. */
export const MIN_WITHDRAWAL_INR = 500;

/** Maximum single withdrawal in INR (anti-fraud cap). */
export const MAX_WITHDRAWAL_INR = 50_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WithdrawalRow = {
  id: string;
  amount: number;
  status: InternalWithdrawalStatus;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
  processedByName: string | null;
};

// ---------------------------------------------------------------------------
// acceptAgreement
// ---------------------------------------------------------------------------

/**
 * Records BDE-agreement acceptance for the user.
 * Idempotent — re-acceptance is a no-op (timestamp is not overwritten).
 */
export async function acceptAgreement(
  userId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<void> {
  // Ensure wallet row exists before writing agreementAcceptedAt
  await getOrCreateWallet(userId, prismaClient);

  const existing = await prismaClient.internalWallet.findUnique({
    where: { userId },
    select: { agreementAcceptedAt: true },
  });
  if (existing?.agreementAcceptedAt) return; // already accepted — idempotent

  await prismaClient.internalWallet.update({
    where: { userId },
    data: { agreementAcceptedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// getAgreementStatus
// ---------------------------------------------------------------------------

export async function getAgreementStatus(
  userId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{ accepted: boolean; acceptedAt: string | null }> {
  const wallet = await prismaClient.internalWallet.findUnique({
    where: { userId },
    select: { agreementAcceptedAt: true },
  });
  const accepted = !!wallet?.agreementAcceptedAt;
  return {
    accepted,
    acceptedAt: wallet?.agreementAcceptedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// requestWithdrawal
// ---------------------------------------------------------------------------

/**
 * Creates a withdrawal request.
 *
 * Guards:
 *   1. BDE agreement must be accepted.
 *   2. amount >= MIN_WITHDRAWAL_INR
 *   3. amount <= MAX_WITHDRAWAL_INR
 *   4. amount <= withdrawableBalance
 *   5. No other REQUESTED withdrawal already pending for this user.
 */
export async function requestWithdrawal(
  userId: string,
  amount: number,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{ withdrawalId: string; txId: string }> {
  // 1. Agreement check
  const wallet = await prismaClient.internalWallet.findUnique({
    where: { userId },
    select: {
      agreementAcceptedAt: true,
      withdrawableBalance: true,
    },
  });

  if (!wallet?.agreementAcceptedAt) {
    throw new Error("AGREEMENT_NOT_ACCEPTED");
  }

  // 2 & 3. Amount bounds
  if (amount < MIN_WITHDRAWAL_INR) {
    throw new Error(`AMOUNT_TOO_LOW:${MIN_WITHDRAWAL_INR}`);
  }
  if (amount > MAX_WITHDRAWAL_INR) {
    throw new Error(`AMOUNT_TOO_HIGH:${MAX_WITHDRAWAL_INR}`);
  }

  // 4. Balance check
  if ((wallet.withdrawableBalance ?? 0) < amount) {
    throw new Error("INSUFFICIENT_WITHDRAWABLE_BALANCE");
  }

  // 5. No duplicate pending request
  const existing = await prismaClient.internalWithdrawal.findFirst({
    where: { userId, status: InternalWithdrawalStatus.REQUESTED },
    select: { id: true },
  });
  if (existing) {
    throw new Error("WITHDRAWAL_ALREADY_PENDING");
  }

  // Create withdrawal + audit tx atomically
  const [withdrawal, tx] = await prismaClient.$transaction(async (txn) => {
    const w = await txn.internalWithdrawal.create({
      data: { userId, amount, status: InternalWithdrawalStatus.REQUESTED },
      select: { id: true },
    });

    const t = await txn.internalWalletTransaction.create({
      data: {
        userId,
        type: InternalWalletTxType.WITHDRAWAL,
        amount: -amount,
        status: InternalWalletTxStatus.PENDING,
        referenceId: `withdrawal:${w.id}`,
        note: "Withdrawal requested — held pending approval",
      },
      select: { id: true },
    });

    // Hold: deduct from withdrawableBalance immediately
    await txn.internalWallet.update({
      where: { userId },
      data: {
        withdrawableBalance: { decrement: amount },
        totalBalance: { decrement: amount },
      },
    });

    return [w, t] as const;
  });

  return { withdrawalId: withdrawal.id, txId: tx.id };
}

// ---------------------------------------------------------------------------
// approveWithdrawal
// ---------------------------------------------------------------------------

/**
 * BOSS approves a REQUESTED withdrawal — marks APPROVED (payment pending).
 * No balance change; the hold stays until payWithdrawal is called.
 * Audit tx updated to APPROVED.
 */
export async function approveWithdrawal(
  withdrawalId: string,
  processedById: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<void> {
  const w = await prismaClient.internalWithdrawal.findUnique({
    where: { id: withdrawalId },
    select: { status: true, userId: true },
  });

  if (!w) throw new Error("WITHDRAWAL_NOT_FOUND");
  if (w.status !== InternalWithdrawalStatus.REQUESTED) {
    throw new Error(`INVALID_STATUS:${w.status}`);
  }

  await prismaClient.$transaction([
    prismaClient.internalWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: InternalWithdrawalStatus.APPROVED,
        processedById,
        processedAt: new Date(),
      },
    }),
    prismaClient.internalWalletTransaction.updateMany({
      where: {
        userId: w.userId,
        referenceId: `withdrawal:${withdrawalId}`,
        status: InternalWalletTxStatus.PENDING,
      },
      data: { status: InternalWalletTxStatus.APPROVED },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// payWithdrawal
// ---------------------------------------------------------------------------

/**
 * BOSS confirms payment — marks APPROVED → PAID (final state).
 * Audit tx updated to CREDITED.
 */
export async function payWithdrawal(
  withdrawalId: string,
  processedById: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<void> {
  const w = await prismaClient.internalWithdrawal.findUnique({
    where: { id: withdrawalId },
    select: { status: true, userId: true },
  });

  if (!w) throw new Error("WITHDRAWAL_NOT_FOUND");
  if (w.status !== InternalWithdrawalStatus.APPROVED) {
    throw new Error(`INVALID_STATUS:${w.status}`);
  }

  await prismaClient.$transaction([
    prismaClient.internalWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: InternalWithdrawalStatus.PAID,
        processedById,
        processedAt: new Date(),
      },
    }),
    prismaClient.internalWalletTransaction.updateMany({
      where: {
        userId: w.userId,
        referenceId: `withdrawal:${withdrawalId}`,
      },
      data: { status: InternalWalletTxStatus.CREDITED },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// rejectWithdrawal
// ---------------------------------------------------------------------------

/**
 * BOSS rejects a REQUESTED (or APPROVED) withdrawal.
 * Funds are returned to withdrawableBalance.
 * Audit tx updated to REJECTED.
 */
export async function rejectWithdrawal(
  withdrawalId: string,
  processedById: string,
  reason: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<void> {
  const w = await prismaClient.internalWithdrawal.findUnique({
    where: { id: withdrawalId },
    select: { status: true, userId: true, amount: true },
  });

  if (!w) throw new Error("WITHDRAWAL_NOT_FOUND");
  if (
    w.status !== InternalWithdrawalStatus.REQUESTED &&
    w.status !== InternalWithdrawalStatus.APPROVED
  ) {
    throw new Error(`INVALID_STATUS:${w.status}`);
  }

  await prismaClient.$transaction([
    prismaClient.internalWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: InternalWithdrawalStatus.REJECTED,
        note: reason.slice(0, 300),
        processedById,
        processedAt: new Date(),
      },
    }),
    // Return funds
    prismaClient.internalWallet.update({
      where: { userId: w.userId },
      data: {
        withdrawableBalance: { increment: w.amount },
        totalBalance: { increment: w.amount },
      },
    }),
    // Audit: mark tx REJECTED
    prismaClient.internalWalletTransaction.updateMany({
      where: {
        userId: w.userId,
        referenceId: `withdrawal:${withdrawalId}`,
      },
      data: {
        status: InternalWalletTxStatus.REJECTED,
        note: `Rejected: ${reason.slice(0, 200)}`,
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// getUserWithdrawals
// ---------------------------------------------------------------------------

export async function getUserWithdrawals(
  userId: string,
  limit = 20,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<WithdrawalRow[]> {
  const rows = await prismaClient.internalWithdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      status: true,
      note: true,
      createdAt: true,
      processedAt: true,
      processedBy: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    processedAt: r.processedAt?.toISOString() ?? null,
    processedByName: r.processedBy?.name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// getAllWithdrawals (BOSS view)
// ---------------------------------------------------------------------------

export async function getAllWithdrawals(
  statusFilter?: InternalWithdrawalStatus,
  limit = 50,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<(WithdrawalRow & { userId: string; userName: string; userEmail: string })[]> {
  const rows = await prismaClient.internalWithdrawal.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      status: true,
      note: true,
      createdAt: true,
      processedAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
      processedBy: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name ?? "Unknown",
    userEmail: r.user.email,
    amount: r.amount,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    processedAt: r.processedAt?.toISOString() ?? null,
    processedByName: r.processedBy?.name ?? null,
  }));
}
