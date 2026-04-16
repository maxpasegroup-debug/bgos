-- Persist pricing version snapshots for auditability.
ALTER TABLE "RazorpayPayment"
ADD COLUMN "pricingVersion" TEXT NOT NULL DEFAULT 'v1.0';

ALTER TABLE "Invoice"
ADD COLUMN "pricingVersion" TEXT NOT NULL DEFAULT 'v1.0';
