-- Migration: 20260619160000_earning_payout_status
-- Adds EarningPayoutStatus enum + payoutStatus lifecycle fields to
-- sales_hierarchy_earnings (bgos_payout_cycle_v1).

-- CreateEnum
CREATE TYPE "EarningPayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

-- Add columns with temporary nullable to handle existing rows
ALTER TABLE "sales_hierarchy_earnings"
    ADD COLUMN IF NOT EXISTS "payoutStatus" "EarningPayoutStatus",
    ADD COLUMN IF NOT EXISTS "approvedAt"   TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "paidAt"       TIMESTAMP(3);

-- Backfill: existing rows are treated as already paid (pre-cycle history)
UPDATE "sales_hierarchy_earnings"
    SET "payoutStatus" = 'PAID',
        "approvedAt"   = "createdAt",
        "paidAt"       = "createdAt"
    WHERE "payoutStatus" IS NULL;

-- Make payoutStatus NOT NULL with default for future rows
ALTER TABLE "sales_hierarchy_earnings"
    ALTER COLUMN "payoutStatus" SET NOT NULL,
    ALTER COLUMN "payoutStatus" SET DEFAULT 'PENDING';

-- Index for cycle queries: fetch all PENDING earnings efficiently
CREATE INDEX IF NOT EXISTS "sales_hierarchy_earnings_payoutStatus_createdAt_idx"
    ON "sales_hierarchy_earnings"("payoutStatus", "createdAt");
