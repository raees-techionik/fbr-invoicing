CREATE TABLE "InvoiceRecord" (
  "id" TEXT NOT NULL,
  "invoiceType" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "invoiceRefNo" TEXT,
  "fbrInvoiceNumber" TEXT,
  "buyerBusinessName" TEXT NOT NULL,
  "buyerNTNCNIC" TEXT,
  "amountPkr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "payload" JSONB NOT NULL,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoiceRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceRecord_invoiceDate_idx" ON "InvoiceRecord"("invoiceDate");
CREATE INDEX "InvoiceRecord_invoiceType_idx" ON "InvoiceRecord"("invoiceType");
CREATE INDEX "InvoiceRecord_fbrInvoiceNumber_idx" ON "InvoiceRecord"("fbrInvoiceNumber");
CREATE INDEX "InvoiceRecord_status_idx" ON "InvoiceRecord"("status");
CREATE INDEX "InvoiceRecord_claimed_idx" ON "InvoiceRecord"("claimed");
