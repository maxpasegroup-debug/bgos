-- Micro-franchise module: enum + tables + default commission plan

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MICRO_FRANCHISE';

CREATE TABLE IF NOT EXISTS "CommissionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "instantBonus" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CommissionPlan" ("id", "name", "type", "value", "recurring", "instantBonus", "createdAt")
SELECT 'cmf_default_001', 'Default Micro Franchise', 'PERCENTAGE', 5, true, 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "CommissionPlan" WHERE "id" = 'cmf_default_001');

CREATE TABLE IF NOT EXISTS "MicroFranchiseApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "location" TEXT,
    "experience" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLICATION',
    "referredById" TEXT,
    "assignedToId" TEXT,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MicroFranchiseApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MicroFranchiseApplication_status_createdAt_idx"
  ON "MicroFranchiseApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MicroFranchiseApplication_referredById_idx"
  ON "MicroFranchiseApplication"("referredById");
CREATE INDEX IF NOT EXISTS "MicroFranchiseApplication_phone_idx"
  ON "MicroFranchiseApplication"("phone");

CREATE TABLE IF NOT EXISTS "MicroFranchisePartner" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT NOT NULL,
    "commissionPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MicroFranchisePartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MicroFranchisePartner_phone_key" ON "MicroFranchisePartner"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "MicroFranchisePartner_userId_key" ON "MicroFranchisePartner"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "MicroFranchisePartner_applicationId_key" ON "MicroFranchisePartner"("applicationId");

CREATE INDEX IF NOT EXISTS "MicroFranchisePartner_commissionPlanId_idx" ON "MicroFranchisePartner"("commissionPlanId");

CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_partnerId_key" ON "Wallet"("partnerId");

CREATE TABLE IF NOT EXISTS "CommissionTransaction" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommissionTransaction_paymentRef_key" ON "CommissionTransaction"("paymentRef");
CREATE INDEX IF NOT EXISTS "CommissionTransaction_partnerId_createdAt_idx" ON "CommissionTransaction"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommissionTransaction_companyId_idx" ON "CommissionTransaction"("companyId");
CREATE INDEX IF NOT EXISTS "CommissionTransaction_status_idx" ON "CommissionTransaction"("status");

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "microFranchisePartnerId" TEXT;
CREATE INDEX IF NOT EXISTS "Company_microFranchisePartnerId_idx" ON "Company"("microFranchisePartnerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MicroFranchiseApplication_referredById_fkey'
  ) THEN
    ALTER TABLE "MicroFranchiseApplication"
      ADD CONSTRAINT "MicroFranchiseApplication_referredById_fkey"
      FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MicroFranchiseApplication_assignedToId_fkey'
  ) THEN
    ALTER TABLE "MicroFranchiseApplication"
      ADD CONSTRAINT "MicroFranchiseApplication_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MicroFranchisePartner_applicationId_fkey'
  ) THEN
    ALTER TABLE "MicroFranchisePartner"
      ADD CONSTRAINT "MicroFranchisePartner_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "MicroFranchiseApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MicroFranchisePartner_userId_fkey'
  ) THEN
    ALTER TABLE "MicroFranchisePartner"
      ADD CONSTRAINT "MicroFranchisePartner_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MicroFranchisePartner_commissionPlanId_fkey'
  ) THEN
    ALTER TABLE "MicroFranchisePartner"
      ADD CONSTRAINT "MicroFranchisePartner_commissionPlanId_fkey"
      FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Wallet_partnerId_fkey'
  ) THEN
    ALTER TABLE "Wallet"
      ADD CONSTRAINT "Wallet_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "MicroFranchisePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommissionTransaction_partnerId_fkey'
  ) THEN
    ALTER TABLE "CommissionTransaction"
      ADD CONSTRAINT "CommissionTransaction_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "MicroFranchisePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommissionTransaction_companyId_fkey'
  ) THEN
    ALTER TABLE "CommissionTransaction"
      ADD CONSTRAINT "CommissionTransaction_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Company_microFranchisePartnerId_fkey'
  ) THEN
    ALTER TABLE "Company"
      ADD CONSTRAINT "Company_microFranchisePartnerId_fkey"
      FOREIGN KEY ("microFranchisePartnerId") REFERENCES "MicroFranchisePartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
