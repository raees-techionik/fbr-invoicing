CREATE TABLE "OfflineInvoiceQueue" (
  "id" TEXT NOT NULL,
  "invoice" JSONB NOT NULL,
  "settings" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OFFLINE',
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "fbrInvoiceNumber" TEXT,
  "errorMessage" TEXT,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OfflineInvoiceQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfflineInvoiceQueue_status_idx" ON "OfflineInvoiceQueue"("status");
CREATE INDEX "OfflineInvoiceQueue_queuedAt_idx" ON "OfflineInvoiceQueue"("queuedAt");
CREATE INDEX "OfflineInvoiceQueue_submittedAt_idx" ON "OfflineInvoiceQueue"("submittedAt");
