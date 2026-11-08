-- Additive only. Historical environments are deliberately not guessed.
ALTER TABLE "payment_order"
  ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'DOKU',
  ADD COLUMN "paymentEnvironment" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "paymentUrl" TEXT,
  ADD COLUMN "gatewaySessionId" TEXT,
  ADD COLUMN "gatewayTransactionId" TEXT,
  ADD COLUMN "activationEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "activationEmailLeaseAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "payment_order_provider_environment_transaction_key"
  ON "payment_order"("paymentProvider", "paymentEnvironment", "gatewayTransactionId");
CREATE UNIQUE INDEX "payment_order_provider_environment_session_key"
  ON "payment_order"("paymentProvider", "paymentEnvironment", "gatewaySessionId");
