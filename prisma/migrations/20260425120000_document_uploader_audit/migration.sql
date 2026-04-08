-- AlterTable
ALTER TABLE "Document" ADD COLUMN "uploadedByUserId" TEXT,
ADD COLUMN "uploadedByRole" TEXT;

-- CreateIndex
CREATE INDEX "Document_companyId_uploadedByUserId_idx" ON "Document"("companyId", "uploadedByUserId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
