-- ICECONNECT BDE wallet, ledger, withdrawal requests

CREATE TYPE "BdeWalletTransactionType" AS ENUM ('EARNING', 'BONUS', 'REWARD');
CREATE TYPE "BdeWithdrawRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID');

CREATE TABLE "bde_wallets" (
    "id"                 TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "totalEarned"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bde_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bde_wallets_userId_key" ON "bde_wallets"("userId");

ALTER TABLE "bde_wallets"
    ADD CONSTRAINT "bde_wallets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bde_wallet_transactions" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "type"        "BdeWalletTransactionType" NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bde_wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bde_wallet_transactions_userId_createdAt_idx" ON "bde_wallet_transactions"("userId", "createdAt");
CREATE INDEX "bde_wallet_transactions_userId_referenceId_idx" ON "bde_wallet_transactions"("userId", "referenceId");

ALTER TABLE "bde_wallet_transactions"
    ADD CONSTRAINT "bde_wallet_transactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bde_withdraw_requests" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "amount"    DOUBLE PRECISION NOT NULL,
    "status"    "BdeWithdrawRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bde_withdraw_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bde_withdraw_requests_userId_status_idx" ON "bde_withdraw_requests"("userId", "status");

ALTER TABLE "bde_withdraw_requests"
    ADD CONSTRAINT "bde_withdraw_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
