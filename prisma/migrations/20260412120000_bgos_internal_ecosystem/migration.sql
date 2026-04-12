-- CreateEnum
CREATE TYPE "UserManualCategory" AS ENUM ('SALES', 'OPERATIONS', 'HR', 'ACCOUNTS', 'SALES_BOOSTER');

-- CreateEnum
CREATE TYPE "LeadOnboardingType" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TechQueuePriority" AS ENUM ('CRITICAL', 'HIGH', 'LOW');

-- CreateEnum
CREATE TYPE "TechPipelineStage" AS ENUM ('RECEIVED', 'SETUP_DASHBOARD', 'ADD_EMPLOYEES', 'CONFIGURE_MODULES', 'TESTING', 'READY');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "onboardingType" "LeadOnboardingType";

-- CreateTable
CREATE TABLE "UserManual" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "UserManualCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserManual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserManual_companyId_category_key" ON "UserManual"("companyId", "category");

-- CreateIndex
CREATE INDEX "UserManual_companyId_idx" ON "UserManual"("companyId");

-- AddForeignKey
ALTER TABLE "UserManual" ADD CONSTRAINT "UserManual_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "OnboardingTask" ADD COLUMN "leadOnboardingType" "LeadOnboardingType",
ADD COLUMN "techQueuePriority" "TechQueuePriority" NOT NULL DEFAULT 'LOW',
ADD COLUMN "pipelineStage" "TechPipelineStage" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN "formPayload" JSONB;

-- CreateIndex
CREATE INDEX "OnboardingTask_companyId_techQueuePriority_idx" ON "OnboardingTask"("companyId", "techQueuePriority");

-- CreateIndex
CREATE INDEX "OnboardingTask_companyId_pipelineStage_idx" ON "OnboardingTask"("companyId", "pipelineStage");
