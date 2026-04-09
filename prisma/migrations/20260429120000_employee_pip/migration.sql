-- CreateTable
CREATE TABLE "EmployeePip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeePip_companyId_idx" ON "EmployeePip"("companyId");

-- CreateIndex
CREATE INDEX "EmployeePip_userId_idx" ON "EmployeePip"("userId");

-- CreateIndex
CREATE INDEX "EmployeePip_companyId_userId_isCompleted_idx" ON "EmployeePip"("companyId", "userId", "isCompleted");

-- AddForeignKey
ALTER TABLE "EmployeePip" ADD CONSTRAINT "EmployeePip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePip" ADD CONSTRAINT "EmployeePip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
