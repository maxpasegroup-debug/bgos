-- ICECONNECT executive metro pipeline, customer plan, monthly targets + salary.

CREATE TYPE "IceconnectMetroStage" AS ENUM (
  'LEAD_CREATED',
  'INTRO_CALL',
  'DEMO_DONE',
  'FOLLOW_UP',
  'ONBOARDING',
  'SUBSCRIPTION'
);

CREATE TYPE "IceconnectCustomerPlan" AS ENUM (
  'FREE',
  'BASIC',
  'PRO',
  'ENTERPRISE'
);

ALTER TABLE "Lead"
  ADD COLUMN "iceconnectLocation" TEXT,
  ADD COLUMN "iceconnectMetroStage" "IceconnectMetroStage",
  ADD COLUMN "iceconnectCustomerPlan" "IceconnectCustomerPlan",
  ADD COLUMN "iceconnectSubscribedAt" TIMESTAMP(3);

CREATE TABLE "SalesExecutiveMonthlyTarget" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "targetPlan" "IceconnectCustomerPlan" NOT NULL,
  "salaryRupees" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesExecutiveMonthlyTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesExecutiveMonthlyTarget_companyId_userId_periodYear_periodMonth_key"
  ON "SalesExecutiveMonthlyTarget" ("companyId", "userId", "periodYear", "periodMonth");

CREATE INDEX "SalesExecutiveMonthlyTarget_companyId_idx" ON "SalesExecutiveMonthlyTarget" ("companyId");
CREATE INDEX "SalesExecutiveMonthlyTarget_userId_idx" ON "SalesExecutiveMonthlyTarget" ("userId");

CREATE INDEX "Lead_companyId_assignedTo_iceconnectMetroStage_idx"
  ON "Lead" ("companyId", "assignedTo", "iceconnectMetroStage");

ALTER TABLE "SalesExecutiveMonthlyTarget"
  ADD CONSTRAINT "SalesExecutiveMonthlyTarget_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesExecutiveMonthlyTarget"
  ADD CONSTRAINT "SalesExecutiveMonthlyTarget_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
