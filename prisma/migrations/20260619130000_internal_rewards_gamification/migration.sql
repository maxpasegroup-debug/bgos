-- Migration: 20260619130000_internal_rewards_gamification
-- Adds internal rewards, scratch cards, and competitions (bgos_rewards_gamification_v1).

-- CreateEnum
CREATE TYPE "InternalRewardType" AS ENUM ('SCRATCH', 'MILESTONE', 'COMPETITION');

-- CreateEnum
CREATE TYPE "InternalRewardTriggerType" AS ENUM ('POINTS', 'SALES', 'STREAK');

-- CreateEnum
CREATE TYPE "InternalRewardClaimStatus" AS ENUM ('UNLOCKED', 'REVEALED', 'CREDITED');

-- CreateEnum
CREATE TYPE "InternalCompetitionRewardType" AS ENUM ('CASH', 'GIFT', 'POINTS_BONUS');

-- CreateEnum
CREATE TYPE "InternalCompetitionTargetType" AS ENUM ('POINTS', 'SALES', 'REVENUE');

-- CreateTable: reward templates
CREATE TABLE "internal_reward" (
    "id"           TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "type"         "InternalRewardType" NOT NULL,
    "triggerType"  "InternalRewardTriggerType" NOT NULL,
    "triggerValue" DOUBLE PRECISION NOT NULL,
    "minValue"     DOUBLE PRECISION NOT NULL,
    "maxValue"     DOUBLE PRECISION NOT NULL,
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_reward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_reward_active_triggerType_idx"
    ON "internal_reward"("active", "triggerType");

-- CreateTable: per-user claim instances
CREATE TABLE "internal_reward_claim" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "rewardId"  TEXT NOT NULL,
    "value"     DOUBLE PRECISION NOT NULL,
    "status"    "InternalRewardClaimStatus" NOT NULL DEFAULT 'UNLOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_reward_claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_reward_claim_userId_status_idx"
    ON "internal_reward_claim"("userId", "status");

-- CreateIndex
CREATE INDEX "internal_reward_claim_userId_createdAt_idx"
    ON "internal_reward_claim"("userId", "createdAt");

-- CreateTable: internal-staff competitions
CREATE TABLE "internal_competition" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "targetType"  "InternalCompetitionTargetType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "rewardType"  "InternalCompetitionRewardType" NOT NULL,
    "rewardValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewardNote"  TEXT,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3) NOT NULL,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_competition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_competition_active_startDate_endDate_idx"
    ON "internal_competition"("active", "startDate", "endDate");

-- CreateTable: per-user competition progress
CREATE TABLE "internal_competition_progress" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "progress"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank"          INTEGER,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_competition_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique per user+competition)
CREATE UNIQUE INDEX "internal_competition_progress_userId_competitionId_key"
    ON "internal_competition_progress"("userId", "competitionId");

-- CreateIndex
CREATE INDEX "internal_competition_progress_competitionId_progress_idx"
    ON "internal_competition_progress"("competitionId", "progress");

-- AddForeignKey: reward claims → users
ALTER TABLE "internal_reward_claim"
    ADD CONSTRAINT "internal_reward_claim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: reward claims → reward templates
ALTER TABLE "internal_reward_claim"
    ADD CONSTRAINT "internal_reward_claim_rewardId_fkey"
    FOREIGN KEY ("rewardId") REFERENCES "internal_reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: competitions → creator user
ALTER TABLE "internal_competition"
    ADD CONSTRAINT "internal_competition_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: competition progress → user
ALTER TABLE "internal_competition_progress"
    ADD CONSTRAINT "internal_competition_progress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: competition progress → competition
ALTER TABLE "internal_competition_progress"
    ADD CONSTRAINT "internal_competition_progress_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "internal_competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: default reward templates for go-live
INSERT INTO "internal_reward" ("id", "title", "type", "triggerType", "triggerValue", "minValue", "maxValue", "active")
VALUES
  ('rwd_scratch_10pts',  'Scratch Card — 10 pts',    'SCRATCH',   'POINTS', 10,  500,  2000, true),
  ('rwd_scratch_20pts',  'Scratch Card — 20 pts',    'SCRATCH',   'POINTS', 20,  1000, 5000, true),
  ('rwd_scratch_5sales', 'Scratch Card — 5 sales',   'SCRATCH',   'SALES',  5,   500,  1500, true),
  ('rwd_ms_10pts',       'Milestone — 10 pts',       'MILESTONE', 'POINTS', 10,  1000, 1000, true),
  ('rwd_ms_20pts',       'Milestone — 20 pts',       'MILESTONE', 'POINTS', 20,  2000, 2000, true),
  ('rwd_ms_10sales',     'Milestone — 10 sales',     'MILESTONE', 'SALES',  10,  3000, 3000, true)
ON CONFLICT DO NOTHING;
