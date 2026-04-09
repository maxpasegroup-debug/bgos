-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "subscriptionPeriodStart" TIMESTAMP(3),
ADD COLUMN     "subscriptionPeriodEnd" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RazorpayPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "plan" "CompanyPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RazorpayPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayPayment_razorpayOrderId_key" ON "RazorpayPayment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayPayment_razorpayPaymentId_key" ON "RazorpayPayment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "RazorpayPayment_companyId_idx" ON "RazorpayPayment"("companyId");

-- CreateIndex
CREATE INDEX "RazorpayPayment_userId_idx" ON "RazorpayPayment"("userId");

-- AddForeignKey
ALTER TABLE "RazorpayPayment" ADD CONSTRAINT "RazorpayPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RazorpayPayment" ADD CONSTRAINT "RazorpayPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
