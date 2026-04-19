-- Internal vs client separation: platform team users only.
ALTER TABLE "User" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_isInternal_idx" ON "User"("isInternal");

-- Backfill: users tied to the internal sales org company.
UPDATE "User" u
SET "isInternal" = true
WHERE EXISTS (
  SELECT 1
  FROM "UserCompany" uc
  INNER JOIN "Company" c ON c.id = uc."companyId"
  WHERE uc."userId" = u.id
    AND c."internalSalesOrg" = true
);
