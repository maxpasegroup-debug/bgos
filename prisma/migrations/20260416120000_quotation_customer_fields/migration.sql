-- Optional customer snapshot on quotations (builder + PDFs)
ALTER TABLE "Quotation" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "customerPhone" TEXT;
