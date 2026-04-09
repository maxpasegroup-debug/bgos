-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE INDEX "Document_customerId_idx" ON "Document"("customerId");
