-- CreateTable
CREATE TABLE "CustomerPortalUser" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerComplaint" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPortalUser_leadId_key" ON "CustomerPortalUser"("leadId");

-- CreateIndex
CREATE INDEX "CustomerPortalUser_companyId_idx" ON "CustomerPortalUser"("companyId");

-- CreateIndex
CREATE INDEX "CustomerPortalUser_mobile_idx" ON "CustomerPortalUser"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPortalUser_companyId_mobile_key" ON "CustomerPortalUser"("companyId", "mobile");

-- CreateIndex
CREATE INDEX "CustomerComplaint_companyId_idx" ON "CustomerComplaint"("companyId");

-- CreateIndex
CREATE INDEX "CustomerComplaint_leadId_idx" ON "CustomerComplaint"("leadId");

-- CreateIndex
CREATE INDEX "CustomerComplaint_status_idx" ON "CustomerComplaint"("status");

-- AddForeignKey
ALTER TABLE "CustomerPortalUser" ADD CONSTRAINT "CustomerPortalUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalUser" ADD CONSTRAINT "CustomerPortalUser_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
