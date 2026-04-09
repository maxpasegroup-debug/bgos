-- CreateEnum
CREATE TYPE "CompanySubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "subscriptionStatus" "CompanySubscriptionStatus" NOT NULL DEFAULT 'TRIAL';

-- Backfill from plan + trial end (wall-clock)
UPDATE "Company"
SET "subscriptionStatus" = CASE
  WHEN "plan" != 'BASIC' THEN 'ACTIVE'::"CompanySubscriptionStatus"
  WHEN "trialEndDate" IS NULL THEN 'ACTIVE'::"CompanySubscriptionStatus"
  WHEN "trialEndDate" > NOW() THEN 'TRIAL'::"CompanySubscriptionStatus"
  ELSE 'EXPIRED'::"CompanySubscriptionStatus"
END;
