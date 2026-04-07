-- AlterTable
ALTER TABLE "Installation" ADD COLUMN "leadId" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "leadId" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN "issue" TEXT;

-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "report" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Installation_leadId_idx" ON "Installation"("leadId");
CREATE UNIQUE INDEX "Installation_companyId_leadId_key" ON "Installation"("companyId", "leadId");
CREATE INDEX "ServiceTicket_leadId_idx" ON "ServiceTicket"("leadId");
CREATE UNIQUE INDEX "SiteVisit_companyId_leadId_key" ON "SiteVisit"("companyId", "leadId");
CREATE INDEX "SiteVisit_companyId_idx" ON "SiteVisit"("companyId");
CREATE INDEX "SiteVisit_assignedTo_idx" ON "SiteVisit"("assignedTo");
CREATE INDEX "SiteVisit_status_idx" ON "SiteVisit"("status");
CREATE UNIQUE INDEX "Approval_companyId_leadId_key" ON "Approval"("companyId", "leadId");
CREATE INDEX "Approval_companyId_idx" ON "Approval"("companyId");
CREATE INDEX "Approval_status_idx" ON "Approval"("status");

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
