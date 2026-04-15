CREATE TABLE IF NOT EXISTS "NexaAction" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "companyId" TEXT NOT NULL,
  "actorUserId" TEXT,
  CONSTRAINT "NexaAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NexaAction_companyId_executedAt_idx" ON "NexaAction"("companyId", "executedAt");
CREATE INDEX IF NOT EXISTS "NexaAction_companyId_event_idx" ON "NexaAction"("companyId", "event");
CREATE INDEX IF NOT EXISTS "NexaAction_status_idx" ON "NexaAction"("status");

DO $$ BEGIN
  ALTER TABLE "NexaAction"
  ADD CONSTRAINT "NexaAction_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NexaAction"
  ADD CONSTRAINT "NexaAction_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
