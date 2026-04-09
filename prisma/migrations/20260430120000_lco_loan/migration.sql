-- CreateTable
CREATE TABLE "LcoLoan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "loanAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LcoLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LcoLoan_companyId_idx" ON "LcoLoan"("companyId");

-- CreateIndex
CREATE INDEX "LcoLoan_leadId_idx" ON "LcoLoan"("leadId");

-- CreateIndex
CREATE INDEX "LcoLoan_status_idx" ON "LcoLoan"("status");

-- AddForeignKey
ALTER TABLE "LcoLoan" ADD CONSTRAINT "LcoLoan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LcoLoan" ADD CONSTRAINT "LcoLoan_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
