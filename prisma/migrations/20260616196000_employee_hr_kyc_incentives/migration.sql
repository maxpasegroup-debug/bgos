-- HR: KYC + incentives + promotion configuration stored on company membership.
-- We intentionally add these columns without relying on Prisma client regeneration
-- (some environments may have locks). Code should use raw SQL for these fields.

ALTER TABLE "UserCompany"
ADD COLUMN "department" TEXT;

ALTER TABLE "UserCompany"
ADD COLUMN "kycStatus" TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE "UserCompany"
ADD COLUMN "kycBankDetails" TEXT;

ALTER TABLE "UserCompany"
ADD COLUMN "kycPan" TEXT;

ALTER TABLE "UserCompany"
ADD COLUMN "kycPanDocumentId" TEXT;

ALTER TABLE "UserCompany"
ADD COLUMN "kycIdDocumentId" TEXT;

ALTER TABLE "UserCompany"
ADD COLUMN "kycUpdatedAt" TIMESTAMP;

-- Incentives
ALTER TABLE "UserCompany"
ADD COLUMN "incentivesEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "UserCompany"
ADD COLUMN "bonusDealsThreshold" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "UserCompany"
ADD COLUMN "bonusDealsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "UserCompany"
ADD COLUMN "incentivesValidUntil" TIMESTAMP;

-- Promotion
ALTER TABLE "UserCompany"
ADD COLUMN "promotionEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "UserCompany"
ADD COLUMN "promotionValidUntil" TIMESTAMP;

ALTER TABLE "UserCompany"
ADD COLUMN "promotionPerformanceThreshold" INTEGER NOT NULL DEFAULT 80;

