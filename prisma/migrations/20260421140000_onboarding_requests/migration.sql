-- BDE → Sales → Tech → Boss onboarding pipeline

CREATE TYPE "OnboardingRequestDashboardType" AS ENUM ('SOLAR', 'BUILDER', 'ACADEMY', 'CUSTOM');
CREATE TYPE "OnboardingRequestStatus" AS ENUM ('PENDING', 'SALES_REVIEW', 'TECH_QUEUE', 'COMPLETED');

CREATE TABLE "onboarding_requests" (
    "id"                 TEXT                               NOT NULL,
    "createdByUserId"    TEXT                               NOT NULL,
    "companyName"        TEXT                               NOT NULL,
    "bossEmail"          TEXT                               NOT NULL,
    "dashboardType"      "OnboardingRequestDashboardType"   NOT NULL,
    "status"             "OnboardingRequestStatus"          NOT NULL DEFAULT 'PENDING',
    "notes"              TEXT,
    "salesQuestionnaire" JSONB,
    "techTemplate"       TEXT,
    "techNotes"          TEXT,
    "bossUserId"         TEXT,
    "createdAt"          TIMESTAMP(3)                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)                       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_requests_createdByUserId_idx" ON "onboarding_requests"("createdByUserId");
CREATE INDEX "onboarding_requests_status_idx" ON "onboarding_requests"("status");

ALTER TABLE "onboarding_requests"
    ADD CONSTRAINT "onboarding_requests_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "onboarding_requests"
    ADD CONSTRAINT "onboarding_requests_bossUserId_fkey"
    FOREIGN KEY ("bossUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
