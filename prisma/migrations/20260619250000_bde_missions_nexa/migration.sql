-- ICECONNECT BDE Nexa daily missions, tasks, prospects, streaks, rewards

CREATE TYPE "BdeMissionStatus" AS ENUM ('PENDING', 'COMPLETED');
CREATE TYPE "BdeTaskStatus" AS ENUM ('PENDING', 'DONE');
CREATE TYPE "BdeProspectPipelineStage" AS ENUM ('NEW', 'CONTACTED', 'TRIAL_STARTED', 'CONVERTED');
CREATE TYPE "BdeRewardStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'REVEALED');

CREATE TABLE "bde_missions" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "date"            DATE NOT NULL,
    "targetProspects" INTEGER NOT NULL DEFAULT 5,
    "completedCount"  INTEGER NOT NULL DEFAULT 0,
    "callsLogged"     INTEGER NOT NULL DEFAULT 0,
    "status"          "BdeMissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bde_missions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bde_missions_userId_date_key" ON "bde_missions"("userId", "date");
CREATE INDEX "bde_missions_userId_date_idx" ON "bde_missions"("userId", "date");

ALTER TABLE "bde_missions"
    ADD CONSTRAINT "bde_missions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bde_tasks" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "taskText"  TEXT NOT NULL,
    "status"    "BdeTaskStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bde_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bde_tasks_missionId_status_idx" ON "bde_tasks"("missionId", "status");

ALTER TABLE "bde_tasks"
    ADD CONSTRAINT "bde_tasks_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bde_tasks"
    ADD CONSTRAINT "bde_tasks_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "bde_missions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bde_prospects" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "missionId"     TEXT,
    "companyName"   TEXT NOT NULL,
    "phone"         TEXT NOT NULL,
    "location"      TEXT,
    "pipelineStage" "BdeProspectPipelineStage" NOT NULL DEFAULT 'NEW',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bde_prospects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bde_prospects_userId_createdAt_idx" ON "bde_prospects"("userId", "createdAt");

ALTER TABLE "bde_prospects"
    ADD CONSTRAINT "bde_prospects_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bde_prospects"
    ADD CONSTRAINT "bde_prospects_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "bde_missions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "bde_streaks" (
    "userId"         TEXT NOT NULL,
    "currentStreak"  INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE,

    CONSTRAINT "bde_streaks_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "bde_streaks"
    ADD CONSTRAINT "bde_streaks_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bde_rewards" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "status"    "BdeRewardStatus" NOT NULL DEFAULT 'LOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bde_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bde_rewards_userId_type_key" ON "bde_rewards"("userId", "type");
CREATE INDEX "bde_rewards_userId_idx" ON "bde_rewards"("userId");

ALTER TABLE "bde_rewards"
    ADD CONSTRAINT "bde_rewards_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
