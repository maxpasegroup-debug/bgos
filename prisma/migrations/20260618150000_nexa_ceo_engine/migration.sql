-- Nexa CEO engine: coaching logs, competitions, welfare, announcements

CREATE TYPE "NexaCoachingActionType" AS ENUM ('CALL', 'FOLLOWUP', 'CLOSE', 'TRAIN');
CREATE TYPE "NexaCoachingPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "NexaCompetitionMetric" AS ENUM ('POINTS', 'REVENUE', 'SUBSCRIPTIONS', 'LEADS');
CREATE TYPE "NexaWelfareType" AS ENUM ('BONUS', 'RECOGNITION', 'SUPPORT');
CREATE TYPE "NexaAnnouncementKind" AS ENUM ('PRODUCT', 'COMPETITION', 'UPDATE', 'GENERAL');
CREATE TYPE "NexaAnnouncementScope" AS ENUM ('ALL', 'ROLES', 'REGIONS');

CREATE TABLE "nexa_coaching_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" VARCHAR(48) NOT NULL,
    "message" TEXT NOT NULL,
    "actionType" "NexaCoachingActionType" NOT NULL,
    "priority" "NexaCoachingPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nexa_coaching_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nexa_competitions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reward" TEXT NOT NULL,
    "targetMetric" "NexaCompetitionMetric" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nexa_competitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nexa_competition_participants" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,

    CONSTRAINT "nexa_competition_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nexa_employee_welfare" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NexaWelfareType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nexa_employee_welfare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nexa_announcements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "kind" "NexaAnnouncementKind" NOT NULL DEFAULT 'GENERAL',
    "scope" "NexaAnnouncementScope" NOT NULL DEFAULT 'ALL',
    "targetRoles" JSONB,
    "targetRegions" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "nexa_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nexa_coaching_logs_companyId_userId_createdAt_idx" ON "nexa_coaching_logs"("companyId", "userId", "createdAt");

CREATE INDEX "nexa_competitions_companyId_startDate_endDate_idx" ON "nexa_competitions"("companyId", "startDate", "endDate");

CREATE UNIQUE INDEX "nexa_competition_participants_competitionId_userId_key" ON "nexa_competition_participants"("competitionId", "userId");

CREATE INDEX "nexa_competition_participants_competitionId_rank_idx" ON "nexa_competition_participants"("competitionId", "rank");

CREATE INDEX "nexa_employee_welfare_companyId_userId_createdAt_idx" ON "nexa_employee_welfare"("companyId", "userId", "createdAt");

CREATE INDEX "nexa_announcements_companyId_createdAt_idx" ON "nexa_announcements"("companyId", "createdAt");

ALTER TABLE "nexa_coaching_logs" ADD CONSTRAINT "nexa_coaching_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nexa_coaching_logs" ADD CONSTRAINT "nexa_coaching_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nexa_competitions" ADD CONSTRAINT "nexa_competitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nexa_competitions" ADD CONSTRAINT "nexa_competitions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nexa_competition_participants" ADD CONSTRAINT "nexa_competition_participants_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "nexa_competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nexa_competition_participants" ADD CONSTRAINT "nexa_competition_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nexa_employee_welfare" ADD CONSTRAINT "nexa_employee_welfare_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nexa_employee_welfare" ADD CONSTRAINT "nexa_employee_welfare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nexa_announcements" ADD CONSTRAINT "nexa_announcements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nexa_announcements" ADD CONSTRAINT "nexa_announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
