-- Solar industry pack: company workspace JSON, automations, CRM extensions

ALTER TABLE "Company" ADD COLUMN "businessTemplate" TEXT;
ALTER TABLE "Company" ADD COLUMN "dashboardConfig" JSONB;

ALTER TABLE "Lead" ADD COLUMN "email" TEXT;
ALTER TABLE "Lead" ADD COLUMN "source" TEXT;

CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Automation_companyId_idx" ON "Automation"("companyId");
CREATE INDEX "Automation_companyId_trigger_idx" ON "Automation"("companyId", "trigger");

ALTER TABLE "Automation" ADD CONSTRAINT "Automation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Deal" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Deal" ADD COLUMN "stage" TEXT;

UPDATE "Deal" d
SET "companyId" = l."companyId"
FROM "Lead" l
WHERE d."leadId" = l."id";

ALTER TABLE "Deal" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Deal_companyId_idx" ON "Deal"("companyId");

ALTER TABLE "Task" ADD COLUMN "description" TEXT;
ALTER TABLE "Task" ADD COLUMN "companyId" TEXT;

UPDATE "Task" t
SET "companyId" = l."companyId"
FROM "Lead" l
WHERE t."leadId" = l."id";

ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Task_companyId_idx" ON "Task"("companyId");
