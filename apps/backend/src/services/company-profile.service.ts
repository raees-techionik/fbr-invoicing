import { prisma } from "../lib/prisma.js";
import { devIsoNow, withDevDbFallback } from "./dev-db-fallback.js";

// Singleton profile — upsert against a fixed well-known ID so there is
// always exactly one row regardless of how many times PUT is called.
const devCompanyProfiles = new Map<string, ReturnType<typeof makeDevCompanyProfile>>();

function makeDevCompanyProfile(companyId: string) {
  return {
    id: `dev-profile-${companyId}`,
    company_name: process.env.DEV_COMPANY_NAME || "Techionik (Pvt) Ltd.",
    ntn_or_cnic: process.env.DEV_COMPANY_NTN || "1234567890123",
    business_type: process.env.DEV_COMPANY_BUSINESS_TYPE || "Digital Invoicing",
    province: process.env.DEV_COMPANY_PROVINCE || "PUNJAB",
    address: process.env.DEV_COMPANY_ADDRESS || "Techionik Office, Lahore",
    phone_number: process.env.DEV_COMPANY_PHONE || "+92-300-0000000",
    email_address: process.env.DEV_COMPANY_EMAIL || "admin@fbr.com",
    logo_base64: null as string | null,
    created_at: devIsoNow(),
    updated_at: devIsoNow(),
  };
}

function devCompanyProfile(companyId: string) {
  const profile = devCompanyProfiles.get(companyId) ?? makeDevCompanyProfile(companyId);
  devCompanyProfiles.set(companyId, profile);
  return profile;
}

function toDto(record: {
  id: string;
  companyName: string;
  ntnOrCnic: string;
  businessType: string;
  province: string;
  address: string;
  phoneNumber: string;
  emailAddress: string;
  logoBase64: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    company_name: record.companyName,
    ntn_or_cnic: record.ntnOrCnic,
    business_type: record.businessType,
    province: record.province,
    address: record.address,
    phone_number: record.phoneNumber,
    email_address: record.emailAddress,
    logo_base64: record.logoBase64 ?? null,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

export async function getCompanyProfile(companyId: string) {
  const record = await withDevDbFallback(
    "companyProfile.findUnique",
    prisma.companyProfile.findUnique({ where: { companyId } }),
    () => null,
  );
  if (!record) {
    return devCompanyProfile(companyId);
  }
  return toDto(record);
}

export async function updateCompanyProfile(companyId: string, body: Record<string, unknown>) {
  const str = (v: unknown, fallback = "") => (v !== undefined && v !== null ? String(v) : fallback);

  const existing = await withDevDbFallback(
    "companyProfile.findUniqueForUpdate",
    prisma.companyProfile.findUnique({ where: { companyId } }),
    () => null,
  );

  const data = {
    companyName: str(body.company_name, existing?.companyName),
    ntnOrCnic: str(body.ntn_or_cnic, existing?.ntnOrCnic),
    businessType: str(body.business_type, existing?.businessType),
    province: str(body.province, existing?.province),
    address: str(body.address, existing?.address),
    phoneNumber: str(body.phone_number, existing?.phoneNumber),
    emailAddress: str(body.email_address, existing?.emailAddress),
    logoBase64: body.logo_base64 !== undefined
      ? (body.logo_base64 ? String(body.logo_base64) : null)
      : existing?.logoBase64 ?? null,
  };

  const record = await withDevDbFallback(
    "companyProfile.upsert",
    prisma.companyProfile.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    }),
    () => null,
  );

  if (!record) {
    const now = devIsoNow();
    const updated = {
      ...devCompanyProfile(companyId),
      company_name: data.companyName,
      ntn_or_cnic: data.ntnOrCnic,
      business_type: data.businessType,
      province: data.province,
      address: data.address,
      phone_number: data.phoneNumber,
      email_address: data.emailAddress,
      logo_base64: data.logoBase64,
      updated_at: now,
    };
    devCompanyProfiles.set(companyId, updated);
    return updated;
  }

  return toDto(record);
}
