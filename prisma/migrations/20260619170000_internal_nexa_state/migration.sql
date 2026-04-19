-- Migration: 20260619170000_internal_nexa_state
-- Adds InternalNexaState for bgos_nexa_behavior_v2 proactive tracking.

CREATE TABLE "internal_nexa_state" (
    "userId"              TEXT NOT NULL,
    "companyId"           TEXT NOT NULL,
    "lastLoginAt"         TIMESTAMP(3),
    "inactivityDays"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tasksCompletedToday" INTEGER NOT NULL DEFAULT 0,
    "tasksCompletedMonth" INTEGER NOT NULL DEFAULT 0,
    "lastTaskResetDate"   TEXT,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_nexa_state_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "internal_nexa_state_companyId_idx"
    ON "internal_nexa_state"("companyId");

ALTER TABLE "internal_nexa_state"
    ADD CONSTRAINT "internal_nexa_state_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
