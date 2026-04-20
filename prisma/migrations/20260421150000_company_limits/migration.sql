-- Plan caps: users, leads, projects per company

CREATE TABLE "company_limits" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "maxUsers"    INTEGER NOT NULL DEFAULT 25,
    "maxLeads"    INTEGER NOT NULL DEFAULT 500,
    "maxProjects" INTEGER NOT NULL DEFAULT 100,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_limits_companyId_key" ON "company_limits"("companyId");

ALTER TABLE "company_limits"
    ADD CONSTRAINT "company_limits_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
