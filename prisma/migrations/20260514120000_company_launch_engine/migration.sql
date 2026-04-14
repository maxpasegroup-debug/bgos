-- Company launch engine

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "referralPhone" TEXT,
ADD COLUMN IF NOT EXISTS "launchChannelPartnerId" TEXT;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "firstLogin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "LaunchChannelPartner" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaunchChannelPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LaunchChannelPartner_phone_key" ON "LaunchChannelPartner"("phone");
CREATE INDEX IF NOT EXISTS "Company_launchChannelPartnerId_idx" ON "Company"("launchChannelPartnerId");

CREATE TABLE IF NOT EXISTS "OnboardingSession" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "rawTeamInput" TEXT NOT NULL,
  "parsedTeam" JSONB NOT NULL,
  "unknownRoles" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OnboardingSession_createdByUserId_createdAt_idx" ON "OnboardingSession"("createdByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "OnboardingSession_status_idx" ON "OnboardingSession"("status");

CREATE TABLE IF NOT EXISTS "TechRequest" (
  "id" TEXT NOT NULL,
  "roleName" TEXT NOT NULL,
  "description" TEXT,
  "companyId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TechRequest_status_createdAt_idx" ON "TechRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "TechRequest_companyId_idx" ON "TechRequest"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Company_launchChannelPartnerId_fkey'
  ) THEN
    ALTER TABLE "Company"
    ADD CONSTRAINT "Company_launchChannelPartnerId_fkey"
    FOREIGN KEY ("launchChannelPartnerId")
    REFERENCES "LaunchChannelPartner"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OnboardingSession_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "OnboardingSession"
    ADD CONSTRAINT "OnboardingSession_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TechRequest_companyId_fkey'
  ) THEN
    ALTER TABLE "TechRequest"
    ADD CONSTRAINT "TechRequest_companyId_fkey"
    FOREIGN KEY ("companyId")
    REFERENCES "Company"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
