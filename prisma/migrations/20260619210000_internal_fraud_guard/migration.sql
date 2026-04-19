-- bgos_fraud_guard_v1 — Duplicate-contact fraud detection
-- Adds client identifier fields + fraud flag to sales_subscriptions
-- and creates the internal_fraud_log audit table.

-- 1. New columns on sales_subscriptions
ALTER TABLE "sales_subscriptions"
  ADD COLUMN IF NOT EXISTS "clientEmail"   TEXT,
  ADD COLUMN IF NOT EXISTS "clientPhone"   TEXT,
  ADD COLUMN IF NOT EXISTS "fraudFlagged"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "fraudReason"   TEXT;

CREATE INDEX IF NOT EXISTS "sales_subscriptions_clientEmail_idx"
  ON "sales_subscriptions"("clientEmail");

CREATE INDEX IF NOT EXISTS "sales_subscriptions_clientPhone_idx"
  ON "sales_subscriptions"("clientPhone");

-- 2. Fraud audit log table
CREATE TABLE IF NOT EXISTS "internal_fraud_log" (
  "id"                TEXT         NOT NULL,
  "companyId"         TEXT         NOT NULL,
  "triggeredByUserId" TEXT,
  "subscriptionId"    TEXT,
  "reason"            TEXT         NOT NULL,
  "description"       TEXT         NOT NULL,
  "metadata"          JSONB,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "internal_fraud_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "internal_fraud_log_companyId_createdAt_idx"
  ON "internal_fraud_log"("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "internal_fraud_log_triggeredByUserId_idx"
  ON "internal_fraud_log"("triggeredByUserId");

CREATE INDEX IF NOT EXISTS "internal_fraud_log_subscriptionId_idx"
  ON "internal_fraud_log"("subscriptionId");

ALTER TABLE "internal_fraud_log"
  ADD CONSTRAINT "internal_fraud_log_triggeredByUserId_fkey"
    FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "internal_fraud_log"
  ADD CONSTRAINT "internal_fraud_log_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "sales_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
