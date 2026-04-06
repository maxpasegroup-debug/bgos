-- AlterTable
ALTER TABLE "User" ADD COLUMN "workspaceActivatedAt" TIMESTAMP(3);

-- Existing rows at deploy time skip onboarding; rows created later default to NULL until activation.
UPDATE "User" SET "workspaceActivatedAt" = NOW() WHERE "workspaceActivatedAt" IS NULL;
