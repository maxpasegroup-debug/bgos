-- CreateTable
CREATE TABLE "OnboardingConversation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "bossUserId" TEXT NOT NULL,
  "stage" INTEGER NOT NULL DEFAULT 1,
  "companyProfile" JSONB,
  "departments" JSONB,
  "roles" JSONB,
  "employees" JSONB,
  "bossDashboardNeeds" JSONB,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3),
  "techRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingConversation_companyId_key"
ON "OnboardingConversation"("companyId");

-- CreateIndex
CREATE INDEX "OnboardingConversation_bossUserId_idx"
ON "OnboardingConversation"("bossUserId");

-- AddForeignKey
ALTER TABLE "OnboardingConversation"
ADD CONSTRAINT "OnboardingConversation_companyId_fkey"
FOREIGN KEY ("companyId")
REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
