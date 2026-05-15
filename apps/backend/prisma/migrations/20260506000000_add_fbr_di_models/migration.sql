CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "fbrInvoiceNumber" TEXT,
  "invoiceType" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "invoiceRefNo" TEXT,
  "sellerNTNCNIC" TEXT NOT NULL,
  "sellerBusinessName" TEXT NOT NULL,
  "sellerProvince" TEXT NOT NULL,
  "sellerAddress" TEXT NOT NULL,
  "buyerNTNCNIC" TEXT,
  "buyerBusinessName" TEXT NOT NULL,
  "buyerProvince" TEXT NOT NULL,
  "buyerAddress" TEXT NOT NULL,
  "buyerRegistrationType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "isOffline" BOOLEAN NOT NULL DEFAULT false,
  "offlineQueuedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "fbrRawResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "fbrItemInvoiceNo" TEXT,
  "hsCode" TEXT NOT NULL,
  "productDescription" TEXT NOT NULL,
  "rate" TEXT NOT NULL,
  "uom" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "totalValues" DOUBLE PRECISION NOT NULL,
  "valueSalesExcludingST" DOUBLE PRECISION NOT NULL,
  "fixedNotifiedValueOrRetailPrice" DOUBLE PRECISION NOT NULL,
  "salesTaxApplicable" DOUBLE PRECISION NOT NULL,
  "salesTaxWithheldAtSource" DOUBLE PRECISION NOT NULL,
  "extraTax" DOUBLE PRECISION,
  "furtherTax" DOUBLE PRECISION,
  "sroScheduleNo" TEXT,
  "fedPayable" DOUBLE PRECISION,
  "discount" DOUBLE PRECISION,
  "saleType" TEXT NOT NULL,
  "sroItemSerialNo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "hsCode" TEXT NOT NULL,
  "hsDescription" TEXT NOT NULL,
  "defaultSaleType" TEXT NOT NULL,
  "defaultRate" TEXT NOT NULL,
  "defaultUom" TEXT NOT NULL,
  "sroScheduleNo" TEXT,
  "furtherTaxApplicable" BOOLEAN NOT NULL DEFAULT false,
  "extraTaxApplicable" BOOLEAN NOT NULL DEFAULT false,
  "fedApplicable" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Token" (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfflineQueue" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "invoicePayload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OfflineQueue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferenceCache" (
  "id" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReferenceCache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Invoice_fbrInvoiceNumber_idx" ON "Invoice"("fbrInvoiceNumber");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_invoiceType_idx" ON "Invoice"("invoiceType");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_isOffline_idx" ON "Invoice"("isOffline");

CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_hsCode_idx" ON "InvoiceItem"("hsCode");
CREATE INDEX "InvoiceItem_saleType_idx" ON "InvoiceItem"("saleType");

CREATE INDEX "Product_name_idx" ON "Product"("name");
CREATE INDEX "Product_hsCode_idx" ON "Product"("hsCode");
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

CREATE INDEX "Token_environment_idx" ON "Token"("environment");
CREATE INDEX "Token_isActive_idx" ON "Token"("isActive");

CREATE INDEX "OfflineQueue_invoiceId_idx" ON "OfflineQueue"("invoiceId");
CREATE INDEX "OfflineQueue_status_idx" ON "OfflineQueue"("status");
CREATE INDEX "OfflineQueue_queuedAt_idx" ON "OfflineQueue"("queuedAt");
CREATE INDEX "OfflineQueue_uploadedAt_idx" ON "OfflineQueue"("uploadedAt");

CREATE UNIQUE INDEX "ReferenceCache_cacheKey_key" ON "ReferenceCache"("cacheKey");
CREATE INDEX "ReferenceCache_expiresAt_idx" ON "ReferenceCache"("expiresAt");

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfflineQueue" ADD CONSTRAINT "OfflineQueue_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
