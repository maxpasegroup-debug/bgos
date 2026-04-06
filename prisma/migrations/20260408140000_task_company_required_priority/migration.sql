-- Backfill Task.companyId from related Lead
UPDATE "Task" AS t
SET "companyId" = l."companyId"
FROM "Lead" AS l
WHERE t."leadId" = l."id" AND t."companyId" IS NULL;

-- Backfill from assignee User when still missing
UPDATE "Task" AS t
SET "companyId" = u."companyId"
FROM "User" AS u
WHERE t."userId" = u."id" AND t."companyId" IS NULL;

-- Drop tasks that cannot be scoped to a company (orphans)
DELETE FROM "Task" WHERE "companyId" IS NULL;

-- Priority for ordering (higher = more urgent in default list sort)
ALTER TABLE "Task" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

UPDATE "Task"
SET "priority" = CASE
  WHEN "title" LIKE 'Reminder task%' THEN 10
  WHEN "title" LIKE 'Call lead%' THEN 8
  WHEN "title" LIKE 'Follow-up%' OR "title" LIKE 'Follow up%' THEN 6
  WHEN "title" LIKE 'Pipeline:%' THEN 5
  ELSE 5
END;

ALTER TABLE "Task" ALTER COLUMN "companyId" SET NOT NULL;

CREATE INDEX "Task_companyId_status_priority_idx" ON "Task"("companyId", "status", "priority");
