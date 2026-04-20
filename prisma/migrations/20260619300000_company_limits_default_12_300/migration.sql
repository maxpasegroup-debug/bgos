-- Align default workspace limits with foundation policy.
ALTER TABLE "company_limits" ALTER COLUMN "maxUsers" SET DEFAULT 12;
ALTER TABLE "company_limits" ALTER COLUMN "maxLeads" SET DEFAULT 300;
