-- Offers & Incentives (platform control — super boss)

CREATE TYPE "IncentiveAudience" AS ENUM ('SALES', 'FRANCHISE', 'BOTH', 'NICEJOBS');
CREATE TYPE "TargetRoleCategory" AS ENUM ('SALES_EXECUTIVE', 'SALES_MANAGER', 'MICRO_FRANCHISE');
CREATE TYPE "TargetDurationPreset" AS ENUM ('MONTHLY', 'WEEKLY', 'CUSTOM');
CREATE TYPE "TargetMetricType" AS ENUM ('LEADS', 'ONBOARDINGS', 'SUBSCRIPTIONS', 'REVENUE');
CREATE TYPE "TargetAssignScope" AS ENUM ('INDIVIDUAL', 'DEPARTMENT', 'ALL_FRANCHISE_USERS', 'ALL_SALES_USERS');
CREATE TYPE "BonusConditionType" AS ENUM ('TARGET_ACHIEVED', 'TOP_PERFORMER', 'ONBOARDING_COUNT', 'REVENUE');
CREATE TYPE "BonusValueType" AS ENUM ('FIXED', 'PERCENTAGE', 'GIFT');
CREATE TYPE "IncentiveCommissionPlanTier" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE', 'SPECIAL');
CREATE TYPE "IncentiveCampaignLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'UPCOMING', 'COMPLETED');

CREATE TABLE "TargetCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roleCategory" "TargetRoleCategory" NOT NULL,
    "durationPreset" "TargetDurationPreset" NOT NULL,
    "metricType" "TargetMetricType" NOT NULL,
    "targetNumber" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "assignScope" "TargetAssignScope" NOT NULL,
    "assigneeUserId" TEXT,
    "departmentLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TargetCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TargetCampaign_startDate_endDate_idx" ON "TargetCampaign"("startDate", "endDate");
CREATE INDEX "TargetCampaign_roleCategory_idx" ON "TargetCampaign"("roleCategory");

CREATE TABLE "BonusCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eligibleAudience" "IncentiveAudience" NOT NULL,
    "conditionType" "BonusConditionType" NOT NULL,
    "bonusType" "BonusValueType" NOT NULL,
    "bonusValue" DOUBLE PRECISION,
    "notes" TEXT,
    "validMonth" TEXT NOT NULL,
    "poolAmount" DOUBLE PRECISION,
    "lifecycle" "IncentiveCampaignLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BonusCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BonusCampaign_validMonth_idx" ON "BonusCampaign"("validMonth");
CREATE INDEX "BonusCampaign_eligibleAudience_idx" ON "BonusCampaign"("eligibleAudience");

CREATE TABLE "MegaPrizeCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" "IncentiveAudience" NOT NULL,
    "eligibilityRules" TEXT NOT NULL,
    "prizeDescription" TEXT NOT NULL,
    "winnerRule" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "lifecycle" "IncentiveCampaignLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MegaPrizeCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MegaPrizeCampaign_startDate_endDate_idx" ON "MegaPrizeCampaign"("startDate", "endDate");

CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "planTier" "IncentiveCommissionPlanTier" NOT NULL,
    "commissionType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "instantSaleBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionRule_planTier_isActive_idx" ON "CommissionRule"("planTier", "isActive");

CREATE TABLE "OfferAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "IncentiveAudience" NOT NULL DEFAULT 'BOTH',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfferAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfferAnnouncement_audience_isActive_idx" ON "OfferAnnouncement"("audience", "isActive");
