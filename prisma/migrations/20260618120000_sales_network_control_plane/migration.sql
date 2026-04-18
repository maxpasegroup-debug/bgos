-- BGOS Control v3 sales network: enums, UserCompany columns, and related tables.
-- Schema was updated without a migration; Railway DB was missing these objects (P2022).

-- CreateEnum
CREATE TYPE "SalesNetworkRole" AS ENUM ('BOSS', 'RSM', 'BDM', 'BDE', 'TECH_EXEC');

CREATE TYPE "NetworkCommissionType" AS ENUM ('DIRECT', 'OVERRIDE', 'RECURRING');

CREATE TYPE "TechQueueStatus" AS ENUM ('PENDING', 'ASSIGNED', 'DONE', 'CANCELLED');

CREATE TYPE "NexaTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

CREATE TYPE "NexaTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "UserCompany"
ADD COLUMN "salesNetworkRole" "SalesNetworkRole",
ADD COLUMN "parentUserId" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "UserCompany"
ADD CONSTRAINT "UserCompany_parentUserId_fkey"
FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "UserCompany_parentUserId_idx" ON "UserCompany"("parentUserId");

CREATE INDEX "UserCompany_companyId_salesNetworkRole_idx" ON "UserCompany"("companyId", "salesNetworkRole");

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "bdeCreated" INTEGER NOT NULL DEFAULT 0,
    "promotionsAchieved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_metrics_companyId_userId_month_key" ON "performance_metrics"("companyId", "userId", "month");

CREATE INDEX "performance_metrics_companyId_idx" ON "performance_metrics"("companyId");

CREATE INDEX "performance_metrics_userId_idx" ON "performance_metrics"("userId");

ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "sales_network_targets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "SalesNetworkRole" NOT NULL,
    "monthlyRevenueTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyCustomerTarget" INTEGER NOT NULL DEFAULT 0,
    "bdeCreationTarget" INTEGER NOT NULL DEFAULT 0,
    "consecutiveMonthsRequired" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_network_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_network_targets_companyId_role_key" ON "sales_network_targets"("companyId", "role");

CREATE INDEX "sales_network_targets_companyId_idx" ON "sales_network_targets"("companyId");

ALTER TABLE "sales_network_targets" ADD CONSTRAINT "sales_network_targets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "network_commissions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUserId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "NetworkCommissionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_commissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "network_commissions_companyId_userId_idx" ON "network_commissions"("companyId", "userId");

CREATE INDEX "network_commissions_createdAt_idx" ON "network_commissions"("createdAt");

ALTER TABLE "network_commissions" ADD CONSTRAINT "network_commissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "network_commissions" ADD CONSTRAINT "network_commissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "network_commissions" ADD CONSTRAINT "network_commissions_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "promotion_tracker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "targetMet" BOOLEAN NOT NULL DEFAULT false,
    "eligibleForPromotion" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_tracker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promotion_tracker_companyId_userId_key" ON "promotion_tracker"("companyId", "userId");

CREATE INDEX "promotion_tracker_companyId_idx" ON "promotion_tracker"("companyId");

ALTER TABLE "promotion_tracker" ADD CONSTRAINT "promotion_tracker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_tracker" ADD CONSTRAINT "promotion_tracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "tech_queue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "status" "TechQueueStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tech_queue_companyId_status_idx" ON "tech_queue"("companyId", "status");

CREATE INDEX "tech_queue_assignedToUserId_idx" ON "tech_queue"("assignedToUserId");

ALTER TABLE "tech_queue" ADD CONSTRAINT "tech_queue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tech_queue" ADD CONSTRAINT "tech_queue_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "nexa_tasks" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "status" "NexaTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "NexaTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nexa_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nexa_tasks_companyId_userId_status_idx" ON "nexa_tasks"("companyId", "userId", "status");

ALTER TABLE "nexa_tasks" ADD CONSTRAINT "nexa_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nexa_tasks" ADD CONSTRAINT "nexa_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "tech_round_robin_state" (
    "companyId" TEXT NOT NULL,
    "lastAssignedUserId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tech_round_robin_state_pkey" PRIMARY KEY ("companyId")
);

ALTER TABLE "tech_round_robin_state" ADD CONSTRAINT "tech_round_robin_state_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
