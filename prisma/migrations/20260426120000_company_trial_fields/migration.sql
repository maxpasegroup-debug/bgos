-- 15-day BASIC trial metadata. Null dates = legacy companies (no expiry enforcement).

ALTER TABLE "Company" ADD COLUMN "trialStartDate" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "trialEndDate" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "isTrialActive" BOOLEAN NOT NULL DEFAULT true;
