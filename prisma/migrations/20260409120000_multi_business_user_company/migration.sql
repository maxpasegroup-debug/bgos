-- Multi-business: Company.owner + industry, UserCompany junction, User without companyId/role

CREATE TYPE "CompanyIndustry" AS ENUM ('SOLAR');

ALTER TABLE "Company" ADD COLUMN "industry" "CompanyIndustry" NOT NULL DEFAULT 'SOLAR';
ALTER TABLE "Company" ADD COLUMN "ownerId" TEXT;

UPDATE "Company" c
SET "ownerId" = sub.uid
FROM (
  SELECT DISTINCT ON (u."companyId") u."companyId" AS cid, u.id AS uid
  FROM "User" u
  WHERE u.role::text IN ('ADMIN', 'MANAGER')
  ORDER BY u."companyId", u."createdAt" ASC
) sub
WHERE c.id = sub.cid;

UPDATE "Company" c
SET "ownerId" = (
  SELECT u.id FROM "User" u WHERE u."companyId" = c.id ORDER BY u."createdAt" ASC LIMIT 1
)
WHERE c."ownerId" IS NULL;

CREATE TABLE "UserCompany" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "jobRole" "UserRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

INSERT INTO "UserCompany" ("id", "userId", "companyId", "role", "jobRole", "createdAt")
SELECT
  substr(md5(random()::text || u.id || clock_timestamp()::text), 1, 25),
  u.id,
  u."companyId",
  CASE WHEN u.role::text IN ('ADMIN', 'MANAGER') THEN 'ADMIN' ELSE 'EMPLOYEE' END,
  u.role,
  u."createdAt"
FROM "User" u;

ALTER TABLE "UserCompany"
  ADD CONSTRAINT "UserCompany_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompany"
  ADD CONSTRAINT "UserCompany_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");
CREATE INDEX "UserCompany_companyId_idx" ON "UserCompany"("companyId");
CREATE INDEX "UserCompany_userId_idx" ON "UserCompany"("userId");

CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");
ALTER TABLE "Company"
  ADD CONSTRAINT "Company_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Company" ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";
DROP INDEX IF EXISTS "User_companyId_idx";
ALTER TABLE "User" DROP COLUMN "companyId";
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" ALTER COLUMN "mobile" DROP NOT NULL;
