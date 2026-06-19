import type { CompanyKind, MembershipRole } from "../../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        isSuperAdmin: boolean;
      };
      companyId?: string;
      activeCompany?: {
        id: string;
        name: string;
        kind: CompanyKind;
        membershipRole: MembershipRole | null;
        isDefault: boolean;
      };
    }
  }
}

export {};
