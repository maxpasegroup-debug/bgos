CREATE TYPE "OnboardingTaskStatus" AS ENUM (
  'NEW',
  'DATA_RECEIVED',
  'SETUP_STARTED',
  'SETUP_COMPLETED',
  'DELIVERED'
);

ALTER TABLE "Lead" ADD COLUMN "nextFollowUpAt" TIMESTAMP(3);

CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'NEW',
    "snapshotCompanyName" TEXT NOT NULL,
    "snapshotOwnerName" TEXT NOT NULL,
    "snapshotPhone" TEXT NOT NULL,
    "snapshotEmail" TEXT,
    "snapshotBusinessType" TEXT,
    "snapshotTeamSize" TEXT,
    "snapshotLeadSources" TEXT,
    "snapshotProblems" TEXT,
    "snapshotRequirements" TEXT,
    "snapshotPlan" TEXT,
    "snapshotWhatsApp" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingTask_leadId_key" ON "OnboardingTask"("leadId");
CREATE INDEX "OnboardingTask_companyId_idx" ON "OnboardingTask"("companyId");
CREATE INDEX "OnboardingTask_status_idx" ON "OnboardingTask"("status");

ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InternalLeadActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalLeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternalLeadActivity_companyId_idx" ON "InternalLeadActivity"("companyId");
CREATE INDEX "InternalLeadActivity_leadId_createdAt_idx" ON "InternalLeadActivity"("leadId", "createdAt");

ALTER TABLE "InternalLeadActivity" ADD CONSTRAINT "InternalLeadActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLeadActivity" ADD CONSTRAINT "InternalLeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalLeadActivity" ADD CONSTRAINT "InternalLeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InternalInAppNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalInAppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalInAppNotification_userId_dedupeKey_key" ON "InternalInAppNotification"("userId", "dedupeKey");
CREATE INDEX "InternalInAppNotification_companyId_userId_readAt_idx" ON "InternalInAppNotification"("companyId", "userId", "readAt");

ALTER TABLE "InternalInAppNotification" ADD CONSTRAINT "InternalInAppNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternalInAppNotification" ADD CONSTRAINT "InternalInAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InternalEmployeeDailyTarget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "targetCalls" INTEGER NOT NULL DEFAULT 0,
    "targetLeads" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InternalEmployeeDailyTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalEmployeeDailyTarget_companyId_userId_dayKey_key" ON "InternalEmployeeDailyTarget"("companyId", "userId", "dayKey");
CREATE INDEX "InternalEmployeeDailyTarget_companyId_idx" ON "InternalEmployeeDailyTarget"("companyId");

ALTER TABLE "InternalEmployeeDailyTarget" ADD CONSTRAINT "InternalEmployeeDailyTarget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Lead_companyId_email_idx" ON "Lead"("companyId", "email");
