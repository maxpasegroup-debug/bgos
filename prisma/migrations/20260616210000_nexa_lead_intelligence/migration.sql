CREATE TYPE "LeadResponseStatus" AS ENUM ('RESPONSIVE', 'SILENT', 'COOLING');

ALTER TABLE "Lead"
ADD COLUMN "currentStage" TEXT,
ADD COLUMN "lastActivityAt" TIMESTAMP(3),
ADD COLUMN "nextActionDue" TIMESTAMP(3),
ADD COLUMN "activityCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "responseStatus" "LeadResponseStatus" NOT NULL DEFAULT 'RESPONSIVE',
ADD COLUMN "confidenceScore" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "nexaPriority" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nexaMovedAt" TIMESTAMP(3),
ADD COLUMN "nexaMovedReason" TEXT;

UPDATE "Lead"
SET
  "currentStage" = COALESCE("currentStage", COALESCE(CAST("iceconnectMetroStage" AS TEXT), 'NEW')),
  "lastActivityAt" = COALESCE("lastActivityAt", COALESCE("updatedAt", NOW())),
  "nextActionDue" = COALESCE("nextActionDue", NOW() + INTERVAL '24 hour'),
  "confidenceScore" = GREATEST(0, LEAST(100, COALESCE("confidenceScore", 50)));

CREATE INDEX "Lead_currentStage_idx" ON "Lead"("currentStage");
CREATE INDEX "Lead_nextActionDue_idx" ON "Lead"("nextActionDue");
CREATE INDEX "Lead_responseStatus_idx" ON "Lead"("responseStatus");
CREATE INDEX "Lead_confidenceScore_idx" ON "Lead"("confidenceScore");
