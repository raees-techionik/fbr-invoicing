import { prisma } from "../lib/prisma.js";
import { devIsoNow, withDevDbFallback } from "./dev-db-fallback.js";

// Singleton profile — upsert against a fixed well-known ID so there is
// always exactly one row regardless of how many times PUT is called.
const PROFILE_ID = "singleton";

let devCompanyProfile = {
  id: PROFILE_ID,
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

export async function getCompanyProfile() {
  const record = await withDevDbFallback(
    "companyProfile.findUnique",
    prisma.companyProfile.findUnique({ where: { id: PROFILE_ID } }),
    () => null,
  );
  if (!record) {
    return devCompanyProfile;
  }
  return toDto(record);
}

export async function updateCompanyProfile(body: Record<string, unknown>) {
  const str = (v: unknown, fallback = "") => (v !== undefined && v !== null ? String(v) : fallback);

  const existing = await withDevDbFallback(
    "companyProfile.findUniqueForUpdate",
    prisma.companyProfile.findUnique({ where: { id: PROFILE_ID } }),
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
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, ...data },
      update: data,
    }),
    () => null,
  );

  if (!record) {
    const now = devIsoNow();
    devCompanyProfile = {
      ...devCompanyProfile,
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
    return devCompanyProfile;
  }

  return toDto(record);
}
