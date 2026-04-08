-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "externalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookEvent_externalId_key" ON "BillingWebhookEvent"("externalId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_receivedAt_idx" ON "BillingWebhookEvent"("receivedAt");
