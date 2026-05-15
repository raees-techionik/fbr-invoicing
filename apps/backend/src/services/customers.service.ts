import { prisma } from "../lib/prisma.js";
import { devIsoNow, withDevDbFallback } from "./dev-db-fallback.js";

type CustomerDto = {
  id: string;
  name: string;
  cnic: string;
  phone: string;
  email: string;
  province: string;
  address: string;
  registration_type: string;
  created_at: string;
  updated_at: string;
};

let devCustomers: CustomerDto[] = [
  {
    id: "dev-customer-alpha",
    name: "Alpha Traders",
    cnic: "9876543210987",
    phone: "+92-300-1111111",
    email: "alpha@example.com",
    province: "SINDH",
    address: "Alpha Market, Karachi",
    registration_type: "Registered",
    created_at: devIsoNow(),
    updated_at: devIsoNow(),
  },
  {
    id: "dev-customer-smart",
    name: "Smart Solutions",
    cnic: "8765432109876",
    phone: "+92-300-2222222",
    email: "smart@example.com",
    province: "PUNJAB",
    address: "Business District, Lahore",
    registration_type: "Registered",
    created_at: devIsoNow(),
    updated_at: devIsoNow(),
  },
];

function httpError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function toDto(record: {
  id: string;
  name: string;
  cnic: string;
  phone: string;
  email: string;
  province: string;
  address: string;
  registrationType: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    name: record.name,
    cnic: record.cnic,
    phone: record.phone,
    email: record.email,
    province: record.province,
    address: record.address,
    registration_type: record.registrationType,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

export async function listCustomers(params: { search?: string; limit?: number } = {}) {
  const search = params.search?.trim() || "";
  const take = Math.min(Math.max(Number(params.limit) || 100, 1), 250);

  const records = await withDevDbFallback(
    "customer.findMany",
    prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { cnic: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { province: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } },
              { registrationType: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      take,
    }),
    () => null,
  );

  if (!records) {
    const normalized = search.toLowerCase();
    return devCustomers
      .filter((customer) => (
        !normalized ||
        customer.name.toLowerCase().includes(normalized) ||
        customer.cnic.toLowerCase().includes(normalized) ||
        customer.phone.toLowerCase().includes(normalized) ||
        customer.email.toLowerCase().includes(normalized) ||
        customer.province.toLowerCase().includes(normalized) ||
        customer.address.toLowerCase().includes(normalized) ||
        customer.registration_type.toLowerCase().includes(normalized)
      ))
      .slice(0, take);
  }

  return records.map(toDto);
}

export async function getCustomer(id: string) {
  const record = await withDevDbFallback(
    "customer.findUnique",
    prisma.customer.findUnique({ where: { id } }),
    () => null,
  );
  if (!record) {
    const devCustomer = devCustomers.find((customer) => customer.id === id);
    if (devCustomer) return devCustomer;
  }
  if (!record) throw httpError(404, "Customer not found.");
  return toDto(record);
}

export async function createCustomer(body: Record<string, unknown>) {
  const data = {
    name: String(body.name || ""),
    cnic: String(body.cnic || ""),
    phone: String(body.phone || ""),
    email: String(body.email || ""),
    province: String(body.province || ""),
    address: String(body.address || ""),
    registrationType: String(body.registration_type || body.registrationType || ""),
  };
  const record = await withDevDbFallback(
    "customer.create",
    prisma.customer.create({ data }),
    () => null,
  );
  if (!record) {
    const now = devIsoNow();
    const created = {
      id: `dev-customer-${Date.now()}`,
      name: data.name,
      cnic: data.cnic,
      phone: data.phone,
      email: data.email,
      province: data.province,
      address: data.address,
      registration_type: data.registrationType,
      created_at: now,
      updated_at: now,
    };
    devCustomers = [created, ...devCustomers];
    return created;
  }
  return toDto(record);
}

export async function updateCustomer(id: string, body: Record<string, unknown>) {
  const existing = await withDevDbFallback(
    "customer.findUniqueForUpdate",
    prisma.customer.findUnique({ where: { id } }),
    () => null,
  );
  if (!existing) {
    const current = devCustomers.find((customer) => customer.id === id);
    if (current) {
      const updated = {
        ...current,
        name: String(body.name ?? current.name),
        cnic: String(body.cnic ?? current.cnic),
        phone: String(body.phone ?? current.phone),
        email: String(body.email ?? current.email),
        province: String(body.province ?? current.province),
        address: String(body.address ?? current.address),
        registration_type: String(body.registration_type ?? body.registrationType ?? current.registration_type),
        updated_at: devIsoNow(),
      };
      devCustomers = devCustomers.map((customer) => customer.id === id ? updated : customer);
      return updated;
    }
  }
  if (!existing) throw httpError(404, "Customer not found.");

  const data = {
    name: String(body.name ?? existing.name),
    cnic: String(body.cnic ?? existing.cnic),
    phone: String(body.phone ?? existing.phone),
    email: String(body.email ?? existing.email),
    province: String(body.province ?? existing.province),
    address: String(body.address ?? existing.address),
    registrationType: String(
      body.registration_type ?? body.registrationType ?? existing.registrationType,
    ),
  };
  const record = await withDevDbFallback(
    "customer.update",
    prisma.customer.update({ where: { id }, data }),
    () => null,
  );
  if (!record) {
    const updated = {
      id,
      name: data.name,
      cnic: data.cnic,
      phone: data.phone,
      email: data.email,
      province: data.province,
      address: data.address,
      registration_type: data.registrationType,
      created_at: devIsoNow(),
      updated_at: devIsoNow(),
    };
    devCustomers = [updated, ...devCustomers.filter((customer) => customer.id !== id)];
    return updated;
  }
  return toDto(record);
}

export async function deleteCustomer(id: string) {
  const existing = await withDevDbFallback(
    "customer.findUniqueForDelete",
    prisma.customer.findUnique({ where: { id } }),
    () => null,
  );
  if (!existing && devCustomers.some((customer) => customer.id === id)) {
    devCustomers = devCustomers.filter((customer) => customer.id !== id);
    return { id, deleted: true };
  }
  if (!existing) throw httpError(404, "Customer not found.");
  await withDevDbFallback(
    "customer.delete",
    prisma.customer.delete({ where: { id } }),
    () => null,
  );
  return { id, deleted: true };
}
