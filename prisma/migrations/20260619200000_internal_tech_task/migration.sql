-- Migration: 20260619200000_internal_tech_task
-- Adds InternalTechTask for bgos_tech_system_v2 (priority, SLA, timing).

CREATE TYPE "TechTaskStatus"   AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "TechTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "internal_tech_task" (
    "id"               TEXT                NOT NULL,
    "companyId"        TEXT                NOT NULL,
    "company"          TEXT                NOT NULL,
    "requestType"      TEXT                NOT NULL,
    "description"      TEXT,
    "status"           "TechTaskStatus"    NOT NULL DEFAULT 'NEW',
    "priority"         "TechTaskPriority"  NOT NULL DEFAULT 'MEDIUM',
    "assignedTo"       TEXT,
    "slaDeadlineAt"    TIMESTAMP(3),
    "startedAt"        TIMESTAMP(3),
    "completedAt"      TIMESTAMP(3),
    "responseTimeMs"   INTEGER,
    "completionTimeMs" INTEGER,
    "createdById"      TEXT                NOT NULL,
    "createdAt"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_tech_task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "internal_tech_task_companyId_status_idx"
    ON "internal_tech_task"("companyId", "status");

CREATE INDEX "internal_tech_task_assignedTo_idx"
    ON "internal_tech_task"("assignedTo");

ALTER TABLE "internal_tech_task"
    ADD CONSTRAINT "internal_tech_task_assignedTo_fkey"
    FOREIGN KEY ("assignedTo") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "internal_tech_task"
    ADD CONSTRAINT "internal_tech_task_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
