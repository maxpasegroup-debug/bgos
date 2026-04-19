-- Migration: 20260619140000_internal_withdrawal
-- Adds safe withdrawal system with BDE-agreement gate (bgos_payout_withdrawal_v1).

-- Add agreementAcceptedAt to InternalWallet (nullable — existing wallets have no agreement yet)
ALTER TABLE "internal_wallet"
    ADD COLUMN IF NOT EXISTS "agreementAcceptedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "InternalWithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateTable: withdrawal requests
CREATE TABLE "internal_withdrawal" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "amount"        DOUBLE PRECISION NOT NULL,
    "status"        "InternalWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "note"          TEXT,
    "processedById" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"   TIMESTAMP(3),

    CONSTRAINT "internal_withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_withdrawal_userId_createdAt_idx"
    ON "internal_withdrawal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "internal_withdrawal_status_createdAt_idx"
    ON "internal_withdrawal"("status", "createdAt");

-- AddForeignKey: withdrawal → requesting user
ALTER TABLE "internal_withdrawal"
    ADD CONSTRAINT "internal_withdrawal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: withdrawal → processing boss
ALTER TABLE "internal_withdrawal"
    ADD CONSTRAINT "internal_withdrawal_processedById_fkey"
    FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
