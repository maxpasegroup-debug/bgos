-- Track how a tenant company was acquired (direct vs sales-led vs franchise).
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "source_type" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "source_id" TEXT;
