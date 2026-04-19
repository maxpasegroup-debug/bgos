-- Sales hierarchy engine V1: membership metrics, hierarchy subscriptions/earnings, promotion tracker fields.

CREATE TYPE "SalesBenefitLevel" AS ENUM ('FULL', 'GRACE', 'REDUCED');

CREATE TYPE "SalesHierarchyPlan" AS ENUM ('BASIC', 'PRO', 'CUSTOM');

CREATE TYPE "SalesHierarchySubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

ALTER TABLE "UserCompany"
ADD COLUMN "activeSubscriptionsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "recurringCap" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "bdeSlotLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "benefitLevel" "SalesBenefitLevel" NOT NULL DEFAULT 'FULL';

ALTER TABLE "UserCompany"
ADD CONSTRAINT "UserCompany_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UserCompany_createdByUserId_idx" ON "UserCompany"("createdByUserId");

ALTER TABLE "promotion_tracker"
ADD COLUMN "roleTarget" "SalesNetworkRole",
ADD COLUMN "activeCountSnapshot" INTEGER,
ADD COLUMN "lastPromotionCheckAt" TIMESTAMP(3);

CREATE TABLE "sales_subscriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "planType" "SalesHierarchyPlan" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" "SalesHierarchySubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_subscriptions_companyId_ownerUserId_idx" ON "sales_subscriptions"("companyId", "ownerUserId");
CREATE INDEX "sales_subscriptions_status_expiresAt_idx" ON "sales_subscriptions"("status", "expiresAt");

ALTER TABLE "sales_subscriptions" ADD CONSTRAINT "sales_subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_subscriptions" ADD CONSTRAINT "sales_subscriptions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sales_hierarchy_earnings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUserId" TEXT,
    "subscriptionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "NetworkCommissionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_hierarchy_earnings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_hierarchy_earnings_companyId_userId_idx" ON "sales_hierarchy_earnings"("companyId", "userId");
CREATE INDEX "sales_hierarchy_earnings_createdAt_idx" ON "sales_hierarchy_earnings"("createdAt");

ALTER TABLE "sales_hierarchy_earnings" ADD CONSTRAINT "sales_hierarchy_earnings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_hierarchy_earnings" ADD CONSTRAINT "sales_hierarchy_earnings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_hierarchy_earnings" ADD CONSTRAINT "sales_hierarchy_earnings_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_hierarchy_earnings" ADD CONSTRAINT "sales_hierarchy_earnings_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "sales_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
