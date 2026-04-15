ALTER TABLE "MicroFranchisePartner"
ADD COLUMN IF NOT EXISTS "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'BRONZE',
ADD COLUMN IF NOT EXISTS "lastScoredAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "MicroFranchiseAlert" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MicroFranchiseAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MicroFranchiseAlert_partnerId_createdAt_idx" ON "MicroFranchiseAlert"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "MicroFranchiseAlert_status_createdAt_idx" ON "MicroFranchiseAlert"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MicroFranchiseAlert_partnerId_fkey'
  ) THEN
    ALTER TABLE "MicroFranchiseAlert"
    ADD CONSTRAINT "MicroFranchiseAlert_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "MicroFranchisePartner"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
