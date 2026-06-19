-- Create the onboarding enums used by company-scoped FBR setup.
DO $$ BEGIN
  CREATE TYPE "FbrOnboardingStatus" AS ENUM (
    'PROFILE_PENDING',
    'PRODUCT_MAPPING_PENDING',
    'IRIS_REGISTRATION_PENDING',
    'IP_WHITELIST_PENDING',
    'SANDBOX_TOKEN_PENDING',
    'SANDBOX_TESTING',
    'CLIENT_TESTING',
    'PRODUCTION_TOKEN_PENDING',
    'READY_FOR_LIVE',
    'LIVE',
    'SUSPENDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FbrApprovalStatus" AS ENUM (
    'NOT_STARTED',
    'PENDING',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FbrTokenStatus" AS ENUM (
    'MISSING',
    'REQUESTED',
    'CONFIGURED',
    'INVALID',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FbrSandboxStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'PASSED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FbrSandboxResultStatus" AS ENUM ('PASSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FbrSandboxOperation" AS ENUM ('VALIDATE', 'SUBMIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Existing services do not provide company context until Step 2. This
-- transitional workspace keeps every row owned and the current app runnable.
INSERT INTO "Company" (
  "id",
  "name",
  "kind",
  "legalName",
  "ntn",
  "createdAt",
  "updatedAt"
)
VALUES (
  'legacy-default-company',
  'Legacy Workspace',
  'BUSINESS',
  'Legacy Workspace',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- These tables exist in the current schema but were previously created with
-- db push rather than the checked-in migration chain. Create them for fresh
-- deployments before adding company ownership.
CREATE TABLE IF NOT EXISTS "CompanyProfile" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL DEFAULT '',
  "ntnOrCnic" TEXT NOT NULL DEFAULT '',
  "businessType" TEXT NOT NULL DEFAULT '',
  "province" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "phoneNumber" TEXT NOT NULL DEFAULT '',
  "emailAddress" TEXT NOT NULL DEFAULT '',
  "logoBase64" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffMember" (
  "id" TEXT NOT NULL,
  "memberName" TEXT NOT NULL,
  "designation" TEXT NOT NULL,
  "cnicNtn" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cnic" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "registrationType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Bring the Product table in line with the current Prisma model on databases
-- created only from the historical migrations.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "inStock" TEXT DEFAULT '';

-- Add non-null company ownership to every business/FBR root record.
ALTER TABLE "CompanyProfile" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Token" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "CompanyProfile"
SET "companyId" = 'legacy-default-company'
WHERE "companyId" IS NULL;

UPDATE "StaffMember"
SET "companyId" = 'legacy-default-company'
WHERE "companyId" IS NULL;

UPDATE "Customer"
SET "companyId" = 'legacy-default-company'
WHERE "companyId" IS NULL;

UPDATE "Invoice"
SET "companyId" = 'legacy-default-company'
WHERE "companyId" IS NULL;

UPDATE "Product"
SET "companyId" = 'legacy-default-company'
WHERE "companyId" IS NULL;

UPDATE "Token"
SET "companyId" = 'legacy-default-company'
WHERE "companyId" IS NULL;

-- A company has one profile. If a legacy database contains multiple global
-- profiles, preserve each by assigning the additional profiles a workspace.
DO $$
DECLARE
  profile_row RECORD;
  generated_company_id TEXT;
BEGIN
  FOR profile_row IN
    SELECT "id", "companyName"
    FROM (
      SELECT
        "id",
        "companyName",
        ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
      FROM "CompanyProfile"
      WHERE "companyId" = 'legacy-default-company'
    ) ranked_profiles
    WHERE row_number > 1
  LOOP
    generated_company_id := 'legacy-profile-' || MD5(profile_row."id");

    INSERT INTO "Company" (
      "id",
      "name",
      "kind",
      "legalName",
      "ntn",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      generated_company_id,
      COALESCE(NULLIF(profile_row."companyName", ''), 'Legacy Company Profile'),
      'BUSINESS',
      NULLIF(profile_row."companyName", ''),
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO NOTHING;

    UPDATE "CompanyProfile"
    SET "companyId" = generated_company_id
    WHERE "id" = profile_row."id";
  END LOOP;
END $$;

ALTER TABLE "CompanyProfile"
  ALTER COLUMN "companyId" SET DEFAULT 'legacy-default-company',
  ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "StaffMember"
  ALTER COLUMN "companyId" SET DEFAULT 'legacy-default-company',
  ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Customer"
  ALTER COLUMN "companyId" SET DEFAULT 'legacy-default-company',
  ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Invoice"
  ALTER COLUMN "companyId" SET DEFAULT 'legacy-default-company',
  ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Product"
  ALTER COLUMN "companyId" SET DEFAULT 'legacy-default-company',
  ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Token"
  ALTER COLUMN "companyId" SET DEFAULT 'legacy-default-company',
  ALTER COLUMN "companyId" SET NOT NULL;

-- Remove global-only indexes and replace them with tenant-aware indexes.
DROP INDEX IF EXISTS "StaffMember_memberName_idx";
DROP INDEX IF EXISTS "StaffMember_email_idx";
DROP INDEX IF EXISTS "Customer_name_idx";
DROP INDEX IF EXISTS "Customer_cnic_idx";
DROP INDEX IF EXISTS "Invoice_fbrInvoiceNumber_idx";
DROP INDEX IF EXISTS "Invoice_invoiceDate_idx";
DROP INDEX IF EXISTS "Invoice_invoiceType_idx";
DROP INDEX IF EXISTS "Invoice_status_idx";
DROP INDEX IF EXISTS "Invoice_isOffline_idx";
DROP INDEX IF EXISTS "Product_name_idx";
DROP INDEX IF EXISTS "Product_hsCode_idx";
DROP INDEX IF EXISTS "Product_isActive_idx";
DROP INDEX IF EXISTS "Token_environment_idx";
DROP INDEX IF EXISTS "Token_isActive_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyProfile_companyId_key"
  ON "CompanyProfile"("companyId");
CREATE INDEX IF NOT EXISTS "StaffMember_companyId_idx"
  ON "StaffMember"("companyId");
CREATE INDEX IF NOT EXISTS "StaffMember_companyId_memberName_idx"
  ON "StaffMember"("companyId", "memberName");
CREATE INDEX IF NOT EXISTS "StaffMember_companyId_email_idx"
  ON "StaffMember"("companyId", "email");
CREATE INDEX IF NOT EXISTS "Customer_companyId_idx"
  ON "Customer"("companyId");
CREATE INDEX IF NOT EXISTS "Customer_companyId_name_idx"
  ON "Customer"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Customer_companyId_cnic_idx"
  ON "Customer"("companyId", "cnic");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_idx"
  ON "Invoice"("companyId");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_fbrInvoiceNumber_idx"
  ON "Invoice"("companyId", "fbrInvoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_invoiceDate_idx"
  ON "Invoice"("companyId", "invoiceDate");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_invoiceType_idx"
  ON "Invoice"("companyId", "invoiceType");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_status_idx"
  ON "Invoice"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_isOffline_idx"
  ON "Invoice"("companyId", "isOffline");
CREATE INDEX IF NOT EXISTS "Product_companyId_idx"
  ON "Product"("companyId");
CREATE INDEX IF NOT EXISTS "Product_companyId_name_idx"
  ON "Product"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Product_companyId_hsCode_idx"
  ON "Product"("companyId", "hsCode");
CREATE INDEX IF NOT EXISTS "Product_companyId_isActive_idx"
  ON "Product"("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "Token_companyId_idx"
  ON "Token"("companyId");
CREATE INDEX IF NOT EXISTS "Token_companyId_environment_isActive_idx"
  ON "Token"("companyId", "environment", "isActive");

-- Add company ownership foreign keys without duplicating constraints if this
-- migration is replayed in a repaired local environment.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompanyProfile_companyId_fkey'
  ) THEN
    ALTER TABLE "CompanyProfile"
      ADD CONSTRAINT "CompanyProfile_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StaffMember_companyId_fkey'
  ) THEN
    ALTER TABLE "StaffMember"
      ADD CONSTRAINT "StaffMember_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Customer_companyId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_companyId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_companyId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Token_companyId_fkey'
  ) THEN
    ALTER TABLE "Token"
      ADD CONSTRAINT "Token_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FbrOnboarding" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL DEFAULT 'legacy-default-company',
  "status" "FbrOnboardingStatus" NOT NULL DEFAULT 'PROFILE_PENDING',
  "businessNature" TEXT,
  "primarySector" TEXT,
  "technicalContactName" TEXT,
  "technicalContactMobile" TEXT,
  "technicalContactEmail" TEXT,
  "erpProvider" TEXT NOT NULL DEFAULT 'Techionik',
  "softwareType" TEXT NOT NULL DEFAULT 'Cloud',
  "ipWhitelistStatus" "FbrApprovalStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "sandboxTokenStatus" "FbrTokenStatus" NOT NULL DEFAULT 'MISSING',
  "sandboxStatus" "FbrSandboxStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "productionTokenStatus" "FbrTokenStatus" NOT NULL DEFAULT 'MISSING',
  "irisSubmittedAt" TIMESTAMP(3),
  "ipWhitelistApprovedAt" TIMESTAMP(3),
  "sandboxStartedAt" TIMESTAMP(3),
  "sandboxCompletedAt" TIMESTAMP(3),
  "productionRequestedAt" TIMESTAMP(3),
  "goLiveAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FbrOnboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FbrOnboarding_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FbrOnboarding_companyId_key"
  ON "FbrOnboarding"("companyId");

CREATE TABLE IF NOT EXISTS "SandboxResult" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL DEFAULT 'legacy-default-company',
  "scenarioId" TEXT NOT NULL,
  "scenarioName" TEXT,
  "operation" "FbrSandboxOperation" NOT NULL,
  "status" "FbrSandboxResultStatus" NOT NULL,
  "statusCode" TEXT,
  "invoiceNumber" TEXT,
  "payload" JSONB NOT NULL,
  "response" JSONB,
  "errors" JSONB,
  "durationMs" INTEGER,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "passedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SandboxResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SandboxResult_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SandboxResult_companyId_idx"
  ON "SandboxResult"("companyId");
CREATE INDEX IF NOT EXISTS "SandboxResult_companyId_scenarioId_idx"
  ON "SandboxResult"("companyId", "scenarioId");
CREATE INDEX IF NOT EXISTS "SandboxResult_companyId_status_idx"
  ON "SandboxResult"("companyId", "status");
CREATE INDEX IF NOT EXISTS "SandboxResult_companyId_runAt_idx"
  ON "SandboxResult"("companyId", "runAt");
