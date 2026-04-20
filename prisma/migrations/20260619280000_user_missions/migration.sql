-- CreateEnum
CREATE TYPE "UserMissionType" AS ENUM ('ONBOARDING', 'DAILY');

-- CreateEnum
CREATE TYPE "UserMissionStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "UserTaskStatus" AS ENUM ('PENDING', 'DONE');

-- CreateTable
CREATE TABLE "user_missions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionDate" DATE NOT NULL,
    "type" "UserMissionType" NOT NULL,
    "onboardingDay" INTEGER,
    "targetCount" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "callsLogged" INTEGER NOT NULL DEFAULT 0,
    "status" "UserMissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userMissionId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "UserTaskStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_missions_userId_missionDate_key" ON "user_missions"("userId", "missionDate");

-- CreateIndex
CREATE INDEX "user_missions_userId_missionDate_idx" ON "user_missions"("userId", "missionDate");

-- CreateIndex
CREATE UNIQUE INDEX "user_tasks_userMissionId_taskKey_key" ON "user_tasks"("userMissionId", "taskKey");

-- CreateIndex
CREATE INDEX "user_tasks_userMissionId_status_idx" ON "user_tasks"("userMissionId", "status");

-- AddForeignKey
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_userMissionId_fkey" FOREIGN KEY ("userMissionId") REFERENCES "user_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "bde_prospects" ADD COLUMN "userMissionId" TEXT;

-- CreateIndex
CREATE INDEX "bde_prospects_userMissionId_idx" ON "bde_prospects"("userMissionId");

-- AddForeignKey
ALTER TABLE "bde_prospects" ADD CONSTRAINT "bde_prospects_userMissionId_fkey" FOREIGN KEY ("userMissionId") REFERENCES "user_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
