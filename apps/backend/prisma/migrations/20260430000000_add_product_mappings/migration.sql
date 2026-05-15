CREATE TABLE "ProductMapping" (
  "id" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "hsCode" TEXT NOT NULL,
  "hsDescription" TEXT NOT NULL,
  "salesTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unitOfMeasurement" TEXT NOT NULL,
  "sroScheduleNo" TEXT,
  "saleType" TEXT NOT NULL,
  "furtherTaxApplicable" BOOLEAN NOT NULL DEFAULT false,
  "extraTaxApplicable" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductMapping_productName_idx" ON "ProductMapping"("productName");
CREATE INDEX "ProductMapping_hsCode_idx" ON "ProductMapping"("hsCode");
CREATE INDEX "ProductMapping_status_idx" ON "ProductMapping"("status");
