-- BGOS onboarding workflow: templates, submissions, messages, tech task, round-robin pointer.

CREATE TYPE "OnboardingWorkflowPlanTier" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');
CREATE TYPE "OnboardingSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'READY', 'DELIVERED');
CREATE TYPE "OnboardingTechTaskStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_INFO', 'READY', 'DELIVERED');

ALTER TABLE "Company" ADD COLUMN "internalWorkflowLastTechUserId" TEXT;

CREATE TABLE "OnboardingFormTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "planTier" "OnboardingWorkflowPlanTier" NOT NULL,
  "sections" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OnboardingFormTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingFormTemplate_companyId_category_planTier_key"
  ON "OnboardingFormTemplate" ("companyId", "category", "planTier");
CREATE INDEX "OnboardingFormTemplate_companyId_idx" ON "OnboardingFormTemplate" ("companyId");
CREATE INDEX "OnboardingFormTemplate_category_planTier_idx" ON "OnboardingFormTemplate" ("category", "planTier");

CREATE TABLE "OnboardingSubmission" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "leadId" TEXT,
  "templateId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "planTier" "OnboardingWorkflowPlanTier" NOT NULL,
  "filledByUserId" TEXT,
  "clientAccessToken" TEXT NOT NULL,
  "status" "OnboardingSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "data" JSONB NOT NULL DEFAULT '{}',
  "completionPercent" INTEGER NOT NULL DEFAULT 0,
  "assignedTechUserId" TEXT,
  "deliveryPdfPath" TEXT,
  "salesDeliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OnboardingSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingSubmission_leadId_key" ON "OnboardingSubmission" ("leadId");
CREATE UNIQUE INDEX "OnboardingSubmission_clientAccessToken_key" ON "OnboardingSubmission" ("clientAccessToken");
CREATE INDEX "OnboardingSubmission_companyId_idx" ON "OnboardingSubmission" ("companyId");
CREATE INDEX "OnboardingSubmission_status_idx" ON "OnboardingSubmission" ("status");
CREATE INDEX "OnboardingSubmission_assignedTechUserId_idx" ON "OnboardingSubmission" ("assignedTechUserId");

CREATE TABLE "OnboardingMessage" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "senderId" TEXT,
  "message" TEXT NOT NULL,
  "fieldKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OnboardingMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OnboardingMessage_submissionId_createdAt_idx" ON "OnboardingMessage" ("submissionId", "createdAt");

CREATE TABLE "OnboardingSubmissionTechTask" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "status" "OnboardingTechTaskStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OnboardingSubmissionTechTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingSubmissionTechTask_submissionId_key" ON "OnboardingSubmissionTechTask" ("submissionId");
CREATE INDEX "OnboardingSubmissionTechTask_status_idx" ON "OnboardingSubmissionTechTask" ("status");

ALTER TABLE "OnboardingFormTemplate"
  ADD CONSTRAINT "OnboardingFormTemplate_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnboardingSubmission"
  ADD CONSTRAINT "OnboardingSubmission_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingSubmission"
  ADD CONSTRAINT "OnboardingSubmission_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "OnboardingFormTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingSubmission"
  ADD CONSTRAINT "OnboardingSubmission_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingSubmission"
  ADD CONSTRAINT "OnboardingSubmission_filledByUserId_fkey"
  FOREIGN KEY ("filledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingSubmission"
  ADD CONSTRAINT "OnboardingSubmission_assignedTechUserId_fkey"
  FOREIGN KEY ("assignedTechUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingMessage"
  ADD CONSTRAINT "OnboardingMessage_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "OnboardingSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingMessage"
  ADD CONSTRAINT "OnboardingMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingSubmissionTechTask"
  ADD CONSTRAINT "OnboardingSubmissionTechTask_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "OnboardingSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
