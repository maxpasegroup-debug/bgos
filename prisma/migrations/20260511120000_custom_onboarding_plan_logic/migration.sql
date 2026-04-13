-- Custom vs solar business type, payment-pending state, custom build gates.

CREATE TYPE "CompanyBusinessType" AS ENUM ('SOLAR', 'CUSTOM');

ALTER TABLE "Company" ADD COLUMN "businessType" "CompanyBusinessType" NOT NULL DEFAULT 'SOLAR';

ALTER TYPE "CompanySubscriptionStatus" ADD VALUE 'PAYMENT_PENDING';

ALTER TYPE "CompanyIndustry" ADD VALUE 'CUSTOM';

ALTER TABLE "Company" ADD COLUMN "customOnboardingSubmittedAt" TIMESTAMP(3),
ADD COLUMN "customBuildClientContactAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "customFinalPaymentConfirmedAt" TIMESTAMP(3);
