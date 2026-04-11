-- BGOS Internal Sales Engine: pipeline stages, call tracking, company flag.

CREATE TYPE "InternalSalesStage" AS ENUM (
  'NEW_LEAD',
  'CONTACTED',
  'DEMO_SCHEDULED',
  'DEMO_DONE',
  'INTERESTED',
  'FOLLOW_UP',
  'CLOSED_WON',
  'CLOSED_LOST'
);

CREATE TYPE "InternalCallStatus" AS ENUM (
  'NOT_CALLED',
  'CALLED',
  'NO_ANSWER',
  'INTERESTED',
  'NOT_INTERESTED'
);

ALTER TABLE "Company" ADD COLUMN "internalSalesOrg" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "internalSalesDefaultAssigneeId" TEXT;

ALTER TABLE "Lead" ADD COLUMN "leadCompanyName" TEXT;
ALTER TABLE "Lead" ADD COLUMN "businessType" TEXT;
ALTER TABLE "Lead" ADD COLUMN "internalSalesNotes" TEXT;
ALTER TABLE "Lead" ADD COLUMN "internalSalesStage" "InternalSalesStage";
ALTER TABLE "Lead" ADD COLUMN "internalCallStatus" "InternalCallStatus";
ALTER TABLE "Lead" ADD COLUMN "lastContactedAt" TIMESTAMP(3);
