import "server-only";

import type { Prisma } from "@prisma/client";
import {
  BdeWalletTransactionType,
  BdeWithdrawRequestStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** INR — conversion credit per prospect moved to CONVERTED (server-side only). */
export const BDE_CONVERSION_EARNING_INR = 1500;
export const BDE_MILESTONE_5_BONUS_INR = 500;
export const BDE_MILESTONE_20_BONUS_INR = 2000;

export async function getOrCreateBdeWallet(userId: string) {
  return prisma.bdeWallet.upsert({
    where: { userId },
    create: {
      userId,
      totalEarned: 0,
      withdrawableAmount: 0,
      bonusAmount: 0,
    },
    update: {},
  });
}

async function hasTransaction(userId: string, referenceId: string) {
  const x = await prisma.bdeWalletTransaction.findFirst({
    where: { userId, referenceId },
    select: { id: true },
  });
  return Boolean(x);
}

/**
 * Credits BDE when a field prospect is marked CONVERTED. Idempotent per prospect.
 */
export async function creditEarningOnProspectConversion(userId: string, prospectId: string) {
  const ref = `prospect:${prospectId}`;
  if (await hasTransaction(userId, ref)) {
    return { credited: false as const, amount: 0 };
  }

  const amount = BDE_CONVERSION_EARNING_INR;

  await prisma.$transaction(async (tx) => {
    await tx.bdeWalletTransaction.create({
      data: {
        userId,
        type: BdeWalletTransactionType.EARNING,
        amount,
        referenceId: ref,
      },
    });
    await tx.bdeWallet.upsert({
      where: { userId },
      create: {
        userId,
        totalEarned: amount,
        withdrawableAmount: amount,
        bonusAmount: 0,
      },
      update: {
        totalEarned: { increment: amount },
        withdrawableAmount: { increment: amount },
      },
    });
  });

  return { credited: true as const, amount };
}

const MILESTONE_BONUS: Record<string, number> = {
  milestone_5_leads: BDE_MILESTONE_5_BONUS_INR,
  milestone_20_leads: BDE_MILESTONE_20_BONUS_INR,
};

/**
 * Credits bonus when a gamification reward tier unlocks. Idempotent per reward type.
 */
export async function creditBonusOnRewardUnlock(userId: string, rewardType: string) {
  const bonus = MILESTONE_BONUS[rewardType];
  if (bonus == null || bonus <= 0) {
    return { credited: false as const, amount: 0 };
  }

  const ref = `reward:${rewardType}`;
  if (await hasTransaction(userId, ref)) {
    return { credited: false as const, amount: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.bdeWalletTransaction.create({
      data: {
        userId,
        type: BdeWalletTransactionType.BONUS,
        amount: bonus,
        referenceId: ref,
      },
    });
    await tx.bdeWallet.upsert({
      where: { userId },
      create: {
        userId,
        totalEarned: bonus,
        withdrawableAmount: bonus,
        bonusAmount: bonus,
      },
      update: {
        totalEarned: { increment: bonus },
        withdrawableAmount: { increment: bonus },
        bonusAmount: { increment: bonus },
      },
    });
  });

  return { credited: true as const, amount: bonus };
}

const BDE_ONBOARDING_DAY_BONUS_INR: Record<number, number> = {
  1: 100,
  2: 120,
  3: 150,
  4: 100,
  5: 150,
  6: 120,
  7: 300,
};

/**
 * 7-day onboarding day-completion bonus. Idempotent per day (`onboarding_day:N`).
 * Must run inside the same DB transaction as onboarding progression updates.
 */
export async function creditOnboardingDayBonus(
  userId: string,
  day: number,
  tx: Prisma.TransactionClient,
): Promise<{ credited: boolean; amount: number }> {
  const amount = BDE_ONBOARDING_DAY_BONUS_INR[day] ?? 100;
  const ref = `onboarding_day:${day}`;
  const exists = await tx.bdeWalletTransaction.findFirst({
    where: { userId, referenceId: ref },
    select: { id: true },
  });
  if (exists) {
    return { credited: false, amount: 0 };
  }
  await tx.bdeWalletTransaction.create({
    data: {
      userId,
      type: BdeWalletTransactionType.BONUS,
      amount,
      referenceId: ref,
    },
  });
  await tx.bdeWallet.upsert({
    where: { userId },
    create: {
      userId,
      totalEarned: amount,
      withdrawableAmount: amount,
      bonusAmount: amount,
    },
    update: {
      totalEarned: { increment: amount },
      withdrawableAmount: { increment: amount },
      bonusAmount: { increment: amount },
    },
  });
  return { credited: true, amount };
}

export async function requestWithdrawal(userId: string, amountInr: number) {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new Error("Invalid withdrawal amount");
  }

  const wallet = await getOrCreateBdeWallet(userId);
  if (amountInr > wallet.withdrawableAmount + 1e-6) {
    throw new Error("Amount exceeds withdrawable balance");
  }

  return prisma.$transaction(async (tx) => {
    const req = await tx.bdeWithdrawRequest.create({
      data: {
        userId,
        amount: amountInr,
        status: BdeWithdrawRequestStatus.PENDING,
      },
    });
    await tx.bdeWallet.update({
      where: { userId },
      data: { withdrawableAmount: { decrement: amountInr } },
    });
    return req;
  });
}

export function buildMoneyMessage(input: {
  totalEarned: number;
  withdrawable: number;
  todayEarningSum: number;
}): string {
  if (input.todayEarningSum >= 500) {
    return `You earned ₹${Math.round(input.todayEarningSum)} today.`;
  }
  if (input.withdrawable >= 3000 && input.withdrawable < input.totalEarned) {
    return "Close 1 more deal to unlock bigger bonuses.";
  }
  if (input.totalEarned > 0 && input.totalEarned < 5000) {
    return "You're growing fast — keep converting prospects.";
  }
  return "Every conversion adds to your wallet.";
}
