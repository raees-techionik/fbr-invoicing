CREATE TYPE "CompanyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "CompanyInvitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "status" "CompanyInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "tokenHash" TEXT NOT NULL,
  "invitedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyInvitation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompanyInvitation_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompanyInvitation_acceptedByUserId_fkey"
    FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CompanyInvitation_tokenHash_key"
  ON "CompanyInvitation"("tokenHash");
CREATE INDEX "CompanyInvitation_companyId_status_idx"
  ON "CompanyInvitation"("companyId", "status");
CREATE INDEX "CompanyInvitation_companyId_email_idx"
  ON "CompanyInvitation"("companyId", "email");
CREATE INDEX "CompanyInvitation_email_status_idx"
  ON "CompanyInvitation"("email", "status");
CREATE INDEX "CompanyInvitation_expiresAt_idx"
  ON "CompanyInvitation"("expiresAt");
