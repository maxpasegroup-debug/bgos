-- CreateTable
CREATE TABLE "bde_onboarding" (
    "userId" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "progressJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "bde_onboarding_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "bde_onboarding" ADD CONSTRAINT "bde_onboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
