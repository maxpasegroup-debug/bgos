-- BGOS Internal: metro sales pipeline, tech stages, roles TECH_HEAD/TECH_EXECUTIVE, Nexa support.

ALTER TYPE "UserRole" ADD VALUE 'TECH_HEAD';
ALTER TYPE "UserRole" ADD VALUE 'TECH_EXECUTIVE';

CREATE TYPE "InternalSalesStage_new" AS ENUM (
  'LEAD_ADDED',
  'INTRO_CALL',
  'DEMO_ORIENTATION',
  'FOLLOW_UP',
  'INTERESTED',
  'ONBOARDING_FORM_FILLED',
  'BOSS_APPROVAL_PENDING',
  'SENT_TO_TECH',
  'TECH_READY',
  'DELIVERED',
  'CLIENT_LIVE',
  'CLOSED_LOST'
);

ALTER TABLE "Lead" ADD COLUMN "internalSalesStage_new" "InternalSalesStage_new";

UPDATE "Lead" SET "internalSalesStage_new" = CASE
  WHEN "internalSalesStage" IS NULL THEN NULL
  WHEN "internalSalesStage"::text = 'NEW_LEAD' THEN 'LEAD_ADDED'::"InternalSalesStage_new"
  WHEN "internalSalesStage"::text = 'CONTACTED' THEN 'INTRO_CALL'::"InternalSalesStage_new"
  WHEN "internalSalesStage"::text = 'DEMO_SCHEDULED' THEN 'DEMO_ORIENTATION'::"InternalSalesStage_new"
  WHEN "internalSalesStage"::text = 'DEMO_DONE' THEN 'DEMO_ORIENTATION'::"InternalSalesStage_new"
  WHEN "internalSalesStage"::text = 'INTERESTED' THEN 'INTERESTED'::"InternalSalesStage_new"
  WHEN "internalSalesStage"::text = 'FOLLOW_UP' THEN 'FOLLOW_UP'::"InternalSalesStage_new"
  WHEN "internalSalesStage"::text = 'CLOSED_WON' THEN 'CLIENT_LIVE'::"InternalSalesStage_new"
  WHEN "internalSalesStage"::text = 'CLOSED_LOST' THEN 'CLOSED_LOST'::"InternalSalesStage_new"
  ELSE 'LEAD_ADDED'::"InternalSalesStage_new"
END;

ALTER TABLE "Lead" DROP COLUMN "internalSalesStage";
DROP TYPE "InternalSalesStage";
ALTER TYPE "InternalSalesStage_new" RENAME TO "InternalSalesStage";
ALTER TABLE "Lead" RENAME COLUMN "internalSalesStage_new" TO "internalSalesStage";

CREATE TYPE "InternalTechStage" AS ENUM (
  'ONBOARDING_RECEIVED',
  'DATA_VERIFIED',
  'DASHBOARD_SETUP',
  'EMPLOYEE_SETUP',
  'SYSTEM_TESTING',
  'READY_FOR_DELIVERY'
);

CREATE TYPE "InternalOnboardingApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "Lead" ADD COLUMN "internalTechStage" "InternalTechStage";
ALTER TABLE "Lead" ADD COLUMN "internalOnboardingApprovalStatus" "InternalOnboardingApprovalStatus";
ALTER TABLE "Lead" ADD COLUMN "internalStageUpdatedAt" TIMESTAMP(3);

UPDATE "Lead" SET "internalStageUpdatedAt" = "updatedAt" WHERE "internalSalesStage" IS NOT NULL;

CREATE TABLE "InternalNexaSupportTicket" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNexaSupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternalNexaSupportTicket_companyId_idx" ON "InternalNexaSupportTicket"("companyId");
CREATE INDEX "InternalNexaSupportTicket_leadId_idx" ON "InternalNexaSupportTicket"("leadId");
CREATE INDEX "InternalNexaSupportTicket_companyId_status_idx" ON "InternalNexaSupportTicket"("companyId", "status");

ALTER TABLE "InternalNexaSupportTicket" ADD CONSTRAINT "InternalNexaSupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalNexaSupportTicket" ADD CONSTRAINT "InternalNexaSupportTicket_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternalNexaSupportTicket" ADD CONSTRAINT "InternalNexaSupportTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
