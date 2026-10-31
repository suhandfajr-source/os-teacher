-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_order" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "dokuPaymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "activationToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_order_invoiceNumber_key" ON "payment_order"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_order_activationToken_key" ON "payment_order"("activationToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_order_customerEmail_idx" ON "payment_order"("customerEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_order_status_idx" ON "payment_order"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_order_createdAt_idx" ON "payment_order"("createdAt");

-- AddForeignKey
ALTER TABLE "payment_order" DROP CONSTRAINT IF EXISTS "payment_order_userId_fkey";
ALTER TABLE "payment_order" ADD CONSTRAINT "payment_order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
