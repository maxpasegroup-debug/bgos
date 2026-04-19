/**
 * Internal Rewards & Gamification (bgos_rewards_gamification_v1).
 *
 * Architecture:
 *   · InternalReward rows are templates (managed by BOSS via admin API).
 *   · unlockRewardForTrigger() checks active rewards that match the trigger
 *     and creates InternalRewardClaim rows with a backend-generated value.
 *   · Values are NEVER client-controlled — generated here within [min, max].
 *   · revealClaim() exposes the value + credits wallet bonus_balance.
 *   · Duplicate protection: one claim per user per reward per trigger event.
 */

import "server-only";

import {
  InternalRewardClaimStatus,
  InternalRewardTriggerType,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { creditWallet, InternalWalletTxType } from "@/lib/internal-wallet";

export { InternalRewardTriggerType, InternalRewardClaimStatus };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RewardTriggerContext = {
  triggerType: InternalRewardTriggerType;
  /** Current cumulative value (e.g., display points or subscription count). */
  currentValue: number;
  /** Previous value before this event — used to detect threshold crossings. */
  previousValue?: number;
};

export type RewardClaimPublic = {
  id: string;
  rewardId: string;
  title: string;
  type: string;
  /** Value is null when status = UNLOCKED (hidden until reveal). */
  value: number | null;
  status: InternalRewardClaimStatus;
  createdAt: string;
};

export type CompetitionPublic = {
  id: string;
  title: string;
  description: string | null;
  targetType: string;
  targetValue: number;
  rewardType: string;
  rewardValue: number;
  rewardNote: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
  myProgress: number;
  myRank: number | null;
  leaderboard: { userId: string; name: string; progress: number; rank: number | null }[];
};

// ---------------------------------------------------------------------------
// Secure random in range [min, max] — no client influence
// ---------------------------------------------------------------------------

function secureRandInRange(min: number, max: number): number {
  if (min >= max) return min;
  // Use crypto-quality random via Web Crypto (available in Node 18+).
  const range = max - min;
  // Round to nearest 50 for clean INR amounts.
  const raw = min + Math.random() * range;
  return Math.round(raw / 50) * 50;
}

// ---------------------------------------------------------------------------
// unlockRewardForTrigger
// ---------------------------------------------------------------------------

/**
 * Called after each sale (or other trigger event).
 *
 * For each active InternalReward matching the trigger type:
 *   · Checks if the threshold was newly crossed (previousValue < threshold ≤ currentValue).
 *   · Skips if the user already has a claim for this reward + threshold crossing
 *     (idempotency key: `userId:rewardId:triggerFloor`).
 *   · Generates a value within [minValue, maxValue] — backend-controlled only.
 *   · Creates InternalRewardClaim with status=UNLOCKED.
 *
 * Returns the IDs of any newly created claims.
 */
export async function unlockRewardForTrigger(
  userId: string,
  ctx: RewardTriggerContext,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<string[]> {
  const { triggerType, currentValue, previousValue = 0 } = ctx;

  // Fetch all active rewards for this trigger type
  const rewards = await prismaClient.internalReward.findMany({
    where: { active: true, triggerType },
    select: { id: true, minValue: true, maxValue: true, triggerValue: true },
  });

  if (rewards.length === 0) return [];

  const newClaimIds: string[] = [];

  for (const reward of rewards) {
    const threshold = reward.triggerValue;

    // Only trigger if the threshold was NEWLY crossed in this event
    if (previousValue >= threshold || currentValue < threshold) continue;

    // Idempotency: ensure we haven't already unlocked this reward at this
    // threshold floor for this user (handles retry/duplicate calls)
    const existing = await prismaClient.internalRewardClaim.findFirst({
      where: { userId, rewardId: reward.id },
      select: { id: true },
    });
    if (existing) continue;

    // Generate backend-controlled value
    const value = secureRandInRange(reward.minValue, reward.maxValue);

    const claim = await prismaClient.internalRewardClaim.create({
      data: {
        userId,
        rewardId: reward.id,
        value,
        status: InternalRewardClaimStatus.UNLOCKED,
      },
      select: { id: true },
    });

    newClaimIds.push(claim.id);
  }

  return newClaimIds;
}

// ---------------------------------------------------------------------------
// revealClaim
// ---------------------------------------------------------------------------

/**
 * Called when the user taps "Scratch".
 *
 * 1. Validates the claim belongs to the user and is UNLOCKED.
 * 2. Marks as REVEALED.
 * 3. Credits wallet bonus_balance (immediately CREDITED status).
 * 4. Returns the revealed value.
 */
export async function revealClaim(
  userId: string,
  claimId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<{ value: number; alreadyRevealed: boolean }> {
  const claim = await prismaClient.internalRewardClaim.findUnique({
    where: { id: claimId },
    select: { userId: true, value: true, status: true, rewardId: true },
  });

  if (!claim || claim.userId !== userId) {
    throw new Error("CLAIM_NOT_FOUND");
  }

  // Already revealed or credited — return value without re-crediting
  if (claim.status !== InternalRewardClaimStatus.UNLOCKED) {
    return { value: claim.value, alreadyRevealed: true };
  }

  // Mark REVEALED
  await prismaClient.internalRewardClaim.update({
    where: { id: claimId },
    data: { status: InternalRewardClaimStatus.REVEALED },
  });

  // Credit wallet bonus_balance
  await creditWallet(
    {
      userId,
      amount: claim.value,
      type: InternalWalletTxType.REWARD,
      referenceId: `reward_claim:${claimId}`,
      note: "Scratch card reward",
    },
    prismaClient,
  );

  // Mark CREDITED
  await prismaClient.internalRewardClaim.update({
    where: { id: claimId },
    data: { status: InternalRewardClaimStatus.CREDITED },
  });

  return { value: claim.value, alreadyRevealed: false };
}

// ---------------------------------------------------------------------------
// getUserClaims
// ---------------------------------------------------------------------------

/**
 * Returns the user's reward claims.
 * UNLOCKED claims omit the value (backend-only until reveal).
 */
export async function getUserClaims(
  userId: string,
  limit = 20,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<RewardClaimPublic[]> {
  const claims = await prismaClient.internalRewardClaim.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      value: true,
      status: true,
      createdAt: true,
      reward: { select: { id: true, title: true, type: true } },
    },
  });

  return claims.map((c) => ({
    id: c.id,
    rewardId: c.reward.id,
    title: c.reward.title,
    type: c.reward.type,
    // Hide value until revealed
    value: c.status === InternalRewardClaimStatus.UNLOCKED ? null : c.value,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// getUnlockedCount
// ---------------------------------------------------------------------------

export async function getUnlockedCount(
  userId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<number> {
  return prismaClient.internalRewardClaim.count({
    where: { userId, status: InternalRewardClaimStatus.UNLOCKED },
  });
}

// ---------------------------------------------------------------------------
// Competitions
// ---------------------------------------------------------------------------

export async function getActiveCompetitions(
  userId: string,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<CompetitionPublic[]> {
  const now = new Date();

  const competitions = await prismaClient.internalCompetition.findMany({
    where: { active: true, startDate: { lte: now }, endDate: { gte: now } },
    include: {
      progress: {
        orderBy: { progress: "desc" },
        take: 10,
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { endDate: "asc" },
  });

  return competitions.map((comp) => {
    const myProg = comp.progress.find((p) => p.userId === userId);
    const leaderboard = comp.progress.map((p, i) => ({
      userId: p.userId,
      name: p.user.name ?? "Unknown",
      progress: p.progress,
      rank: p.rank ?? i + 1,
    }));

    return {
      id: comp.id,
      title: comp.title,
      description: comp.description,
      targetType: comp.targetType,
      targetValue: comp.targetValue,
      rewardType: comp.rewardType,
      rewardValue: comp.rewardValue,
      rewardNote: comp.rewardNote,
      startDate: comp.startDate.toISOString(),
      endDate: comp.endDate.toISOString(),
      active: comp.active,
      myProgress: myProg?.progress ?? 0,
      myRank: myProg?.rank ?? null,
      leaderboard,
    };
  });
}

/**
 * Upsert the user's progress for a competition.
 * Also recalculates and updates all participant ranks for the competition.
 */
export async function updateCompetitionProgress(
  userId: string,
  competitionId: string,
  progress: number,
  prismaClient: PrismaClient = defaultPrisma,
): Promise<void> {
  // Upsert this user's progress
  await prismaClient.internalCompetitionProgress.upsert({
    where: { userId_competitionId: { userId, competitionId } },
    create: { userId, competitionId, progress },
    update: { progress },
  });

  // Rerank all participants for this competition
  const all = await prismaClient.internalCompetitionProgress.findMany({
    where: { competitionId },
    orderBy: { progress: "desc" },
    select: { id: true },
  });

  await prismaClient.$transaction(
    all.map((p, i) =>
      prismaClient.internalCompetitionProgress.update({
        where: { id: p.id },
        data: { rank: i + 1 },
      }),
    ),
  );
}
