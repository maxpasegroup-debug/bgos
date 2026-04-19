-- Migration: 20260619150000_internal_recurring_state
-- Adds recurring engine state table for bgos_recurring_engine_v1.

CREATE TABLE "internal_recurring_state" (
    "userId"              TEXT NOT NULL,
    "companyId"           TEXT NOT NULL,
    "effectiveAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "graceSinceAt"        TIMESTAMP(3),
    "lastCalculatedAt"    TIMESTAMP(3),
    "lastCreditedAt"      TIMESTAMP(3),

    CONSTRAINT "internal_recurring_state_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "internal_recurring_state_companyId_idx"
    ON "internal_recurring_state"("companyId");

ALTER TABLE "internal_recurring_state"
    ADD CONSTRAINT "internal_recurring_state_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
