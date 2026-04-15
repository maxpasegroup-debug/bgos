DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingStatus') THEN
    CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "Onboarding" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "companyId" TEXT,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "meta" JSONB,
  CONSTRAINT "Onboarding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Onboarding_leadId_status_idx" ON "Onboarding"("leadId", "status");
CREATE INDEX IF NOT EXISTS "Onboarding_createdBy_createdAt_idx" ON "Onboarding"("createdBy", "createdAt");
CREATE INDEX IF NOT EXISTS "Onboarding_companyId_idx" ON "Onboarding"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Onboarding_leadId_fkey') THEN
    ALTER TABLE "Onboarding"
      ADD CONSTRAINT "Onboarding_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Onboarding_companyId_fkey') THEN
    ALTER TABLE "Onboarding"
      ADD CONSTRAINT "Onboarding_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Onboarding_createdBy_fkey') THEN
    ALTER TABLE "Onboarding"
      ADD CONSTRAINT "Onboarding_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
