-- CreateEnum
CREATE TYPE "ServiceTicketStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable Lead
ALTER TABLE "Lead" ADD COLUMN "siteReport" TEXT;

-- AlterTable Installation
ALTER TABLE "Installation" ADD COLUMN "assignedTo" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "Installation_assignedTo_idx" ON "Installation"("assignedTo");

ALTER TABLE "Installation" ADD CONSTRAINT "Installation_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceTicket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ServiceTicketStatus" NOT NULL DEFAULT 'OPEN',
    "companyId" TEXT NOT NULL,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceTicket_companyId_idx" ON "ServiceTicket"("companyId");
CREATE INDEX "ServiceTicket_status_idx" ON "ServiceTicket"("status");
CREATE INDEX "ServiceTicket_assignedTo_idx" ON "ServiceTicket"("assignedTo");

ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
