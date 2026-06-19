-- Add invitation email delivery status and company activity audit logs.

CREATE TYPE "InvitationEmailStatus" AS ENUM ('NOT_SENT', 'SENT', 'FAILED', 'DEV_LOGGED');

ALTER TABLE "CompanyInvitation"
ADD COLUMN "emailStatus" "InvitationEmailStatus" NOT NULL DEFAULT 'NOT_SENT',
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailError" TEXT,
ADD COLUMN "emailAttemptedAt" TIMESTAMP(3);

CREATE TABLE "CompanyActivityLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyActivityLog_companyId_createdAt_idx" ON "CompanyActivityLog"("companyId", "createdAt");
CREATE INDEX "CompanyActivityLog_companyId_action_idx" ON "CompanyActivityLog"("companyId", "action");
CREATE INDEX "CompanyActivityLog_actorUserId_idx" ON "CompanyActivityLog"("actorUserId");

ALTER TABLE "CompanyActivityLog"
ADD CONSTRAINT "CompanyActivityLog_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyActivityLog"
ADD CONSTRAINT "CompanyActivityLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
