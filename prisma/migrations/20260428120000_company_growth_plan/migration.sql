-- CreateTable
CREATE TABLE "CompanyGrowthPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetRevenueOneMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetLeadsOneMonth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyGrowthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyGrowthPlan_companyId_key" ON "CompanyGrowthPlan"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyGrowthPlan" ADD CONSTRAINT "CompanyGrowthPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
