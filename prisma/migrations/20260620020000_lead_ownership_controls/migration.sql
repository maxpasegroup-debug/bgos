-- Ownership controls: lead owner/source + ownership claims

CREATE TYPE "LeadOwnershipRole" AS ENUM ('BDE', 'BDM', 'RSM');
CREATE TYPE "LeadSourceType" AS ENUM ('INBOUND', 'BDE', 'BDM', 'RSM');
CREATE TYPE "OwnershipClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Lead"
  ADD COLUMN "owner_user_id" TEXT,
  ADD COLUMN "owner_role" "LeadOwnershipRole",
  ADD COLUMN "source_type" "LeadSourceType",
  ADD COLUMN "source_user_id" TEXT;

UPDATE "Lead"
SET "owner_user_id" = COALESCE("assignedTo", "createdByUserId")
WHERE "owner_user_id" IS NULL;

CREATE INDEX "Lead_owner_user_id_owner_role_idx" ON "Lead"("owner_user_id", "owner_role");
CREATE INDEX "Lead_companyId_phone_idx" ON "Lead"("companyId", "phone");

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_source_user_id_fkey"
  FOREIGN KEY ("source_user_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ownership_claims" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "lead_id" TEXT,
  "requested_by" TEXT NOT NULL,
  "current_owner_id" TEXT,
  "status" "OwnershipClaimStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ownership_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ownership_claims_company_id_status_created_at_idx" ON "ownership_claims"("company_id", "status", "created_at");
CREATE INDEX "ownership_claims_lead_id_status_idx" ON "ownership_claims"("lead_id", "status");

ALTER TABLE "ownership_claims"
  ADD CONSTRAINT "ownership_claims_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ownership_claims"
  ADD CONSTRAINT "ownership_claims_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ownership_claims"
  ADD CONSTRAINT "ownership_claims_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ownership_claims"
  ADD CONSTRAINT "ownership_claims_current_owner_id_fkey"
  FOREIGN KEY ("current_owner_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
