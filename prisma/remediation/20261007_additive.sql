-- REVIEW ONLY. No existing table, column, index or row is deleted or changed.
-- This project previously used db push: do NOT run migrate deploy without a baseline.
BEGIN;
CREATE TABLE "StockReservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "stockAccountId" TEXT NOT NULL REFERENCES "StockAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "checkoutSessionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'held' CHECK ("status" IN ('held', 'consumed', 'released')),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "StockReservation_orderId_key" ON "StockReservation"("orderId");
CREATE UNIQUE INDEX "StockReservation_checkoutSessionId_key" ON "StockReservation"("checkoutSessionId");
CREATE INDEX "StockReservation_stockAccountId_status_expiresAt_idx" ON "StockReservation"("stockAccountId", "status", "expiresAt");
CREATE TABLE "PaymentRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),
  "currency" TEXT NOT NULL DEFAULT 'eur',
  "status" TEXT NOT NULL DEFAULT 'paid' CHECK ("status" IN ('paid', 'refund_needed', 'refunded')),
  "clientEmail" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "termsVersion" TEXT,
  "providerInvoiceId" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PaymentRecord_provider_providerPaymentId_key" ON "PaymentRecord"("provider", "providerPaymentId");
CREATE INDEX "PaymentRecord_orderId_paidAt_idx" ON "PaymentRecord"("orderId", "paidAt");
CREATE TABLE "DeliveryJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "dedupeKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "leaseToken" TEXT,
  "lastError" TEXT,
  "providerMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "DeliveryJob_dedupeKey_key" ON "DeliveryJob"("dedupeKey");
CREATE INDEX "DeliveryJob_status_nextAttemptAt_idx" ON "DeliveryJob"("status", "nextAttemptAt");
CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3)
);
CREATE INDEX "AdminSession_expiresAt_revokedAt_idx" ON "AdminSession"("expiresAt", "revokedAt");
COMMIT;
