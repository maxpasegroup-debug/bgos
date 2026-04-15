ALTER TABLE "UserCompany"
ADD COLUMN IF NOT EXISTS "dashboardAssigned" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'READY';

ALTER TABLE "OnboardingSession"
ADD COLUMN IF NOT EXISTS "leadId" TEXT,
ADD COLUMN IF NOT EXISTS "companyId" TEXT,
ADD COLUMN IF NOT EXISTS "data" JSONB;

ALTER TABLE "OnboardingSession"
ALTER COLUMN "companyName" DROP NOT NULL,
ALTER COLUMN "industry" DROP NOT NULL,
ALTER COLUMN "rawTeamInput" DROP NOT NULL,
ALTER COLUMN "parsedTeam" DROP NOT NULL,
ALTER COLUMN "unknownRoles" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "OnboardingSession_leadId_idx" ON "OnboardingSession"("leadId");
CREATE INDEX IF NOT EXISTS "OnboardingSession_companyId_idx" ON "OnboardingSession"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingSession_leadId_fkey'
  ) THEN
    ALTER TABLE "OnboardingSession"
    ADD CONSTRAINT "OnboardingSession_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingSession_companyId_fkey'
  ) THEN
    ALTER TABLE "OnboardingSession"
    ADD CONSTRAINT "OnboardingSession_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
