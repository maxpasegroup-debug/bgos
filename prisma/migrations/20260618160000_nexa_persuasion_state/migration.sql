-- Persuasion engine: idempotent micro-win flags per user per tenant.

CREATE TABLE "nexa_persuasion_state" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "celebratedWins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nexa_persuasion_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nexa_persuasion_state_companyId_userId_key" ON "nexa_persuasion_state"("companyId", "userId");

ALTER TABLE "nexa_persuasion_state" ADD CONSTRAINT "nexa_persuasion_state_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nexa_persuasion_state" ADD CONSTRAINT "nexa_persuasion_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
