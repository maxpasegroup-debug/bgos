-- Usage tracking, capacity flags, ICECONNECT sales notifications

CREATE TYPE "UsageFlagKind" AS ENUM ('USERS', 'LEADS', 'PROJECTS');
CREATE TYPE "UsageFlagStatus" AS ENUM ('ACTIVE', 'IN_PROGRESS', 'CONVERTED', 'CLOSED');
CREATE TYPE "UsageCapacityNotificationStatus" AS ENUM ('UNREAD', 'READ');

CREATE TABLE "usage_metrics" (
    "id"              TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "currentUsers"    INTEGER NOT NULL DEFAULT 0,
    "currentLeads"    INTEGER NOT NULL DEFAULT 0,
    "currentProjects" INTEGER NOT NULL DEFAULT 0,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_metrics_companyId_key" ON "usage_metrics"("companyId");

ALTER TABLE "usage_metrics"
    ADD CONSTRAINT "usage_metrics_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "usage_flags" (
    "id"            TEXT NOT NULL,
    "companyId"     TEXT NOT NULL,
    "kind"          "UsageFlagKind" NOT NULL,
    "status"        "UsageFlagStatus" NOT NULL DEFAULT 'ACTIVE',
    "handledById"   TEXT,
    "actionStatus"  TEXT NOT NULL DEFAULT 'pending',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_flags_companyId_kind_status_idx" ON "usage_flags"("companyId", "kind", "status");
CREATE INDEX "usage_flags_companyId_status_idx" ON "usage_flags"("companyId", "status");

ALTER TABLE "usage_flags"
    ADD CONSTRAINT "usage_flags_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_flags"
    ADD CONSTRAINT "usage_flags_handledById_fkey"
    FOREIGN KEY ("handledById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "usage_capacity_notifications" (
    "id"            TEXT NOT NULL,
    "companyId"     TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "usageFlagId"   TEXT,
    "message"       TEXT NOT NULL,
    "status"        "UsageCapacityNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt"        TIMESTAMP(3),

    CONSTRAINT "usage_capacity_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_capacity_notifications_userId_status_idx" ON "usage_capacity_notifications"("userId", "status");
CREATE INDEX "usage_capacity_notifications_companyId_idx" ON "usage_capacity_notifications"("companyId");

ALTER TABLE "usage_capacity_notifications"
    ADD CONSTRAINT "usage_capacity_notifications_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_capacity_notifications"
    ADD CONSTRAINT "usage_capacity_notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_capacity_notifications"
    ADD CONSTRAINT "usage_capacity_notifications_usageFlagId_fkey"
    FOREIGN KEY ("usageFlagId") REFERENCES "usage_flags"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
