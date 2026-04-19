-- Migration: 20260619120000_internal_wallet
-- Adds InternalWallet and InternalWalletTransaction for BGOS staff earnings ledger.
-- Completely separate from MicroFranchisePartner.Wallet.

-- CreateEnum
CREATE TYPE "InternalWalletTxType" AS ENUM ('DIRECT', 'RECURRING', 'BONUS', 'REWARD', 'ADJUSTMENT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "InternalWalletTxStatus" AS ENUM ('PENDING', 'APPROVED', 'CREDITED', 'REJECTED');

-- CreateTable
CREATE TABLE "internal_wallet" (
    "userId"              TEXT NOT NULL,
    "totalBalance"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusBalance"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "internal_wallet_transaction" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "type"        "InternalWalletTxType" NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "status"      "InternalWalletTxStatus" NOT NULL DEFAULT 'PENDING',
    "referenceId" TEXT,
    "note"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_wallet_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_wallet_transaction_userId_createdAt_idx"
    ON "internal_wallet_transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "internal_wallet_transaction_userId_status_idx"
    ON "internal_wallet_transaction"("userId", "status");

-- AddForeignKey
ALTER TABLE "internal_wallet"
    ADD CONSTRAINT "internal_wallet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_wallet_transaction"
    ADD CONSTRAINT "internal_wallet_transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "internal_wallet"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
