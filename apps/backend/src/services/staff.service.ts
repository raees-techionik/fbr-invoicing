import { prisma } from "../lib/prisma.js";

function httpError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function toDto(record: {
  id: string;
  memberName: string;
  designation: string;
  cnicNtn: string;
  phoneNumber: string;
  email: string;
  province: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    member_name: record.memberName,
    designation: record.designation,
    cnic_ntn: record.cnicNtn,
    phone_number: record.phoneNumber,
    email: record.email,
    province: record.province,
    address: record.address,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

export async function listStaff(params: { search?: string; limit?: number } = {}) {
  const search = params.search?.trim() || "";
  const take = Math.min(Math.max(Number(params.limit) || 100, 1), 250);

  const records = await prisma.staffMember.findMany({
    where: search
      ? {
          OR: [
            { memberName: { contains: search, mode: "insensitive" } },
            { designation: { contains: search, mode: "insensitive" } },
            { cnicNtn: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { province: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take,
  });

  return records.map(toDto);
}

export async function getStaffMember(id: string) {
  const record = await prisma.staffMember.findUnique({ where: { id } });
  if (!record) throw httpError(404, "Staff member not found.");
  return toDto(record);
}

export async function createStaffMember(body: Record<string, unknown>) {
  const record = await prisma.staffMember.create({
    data: {
      memberName: String(body.member_name || ""),
      designation: String(body.designation || ""),
      cnicNtn: String(body.cnic_ntn || ""),
      phoneNumber: String(body.phone_number || ""),
      email: String(body.email || ""),
      province: String(body.province || ""),
      address: String(body.address || ""),
    },
  });
  return toDto(record);
}

export async function updateStaffMember(id: string, body: Record<string, unknown>) {
  const existing = await prisma.staffMember.findUnique({ where: { id } });
  if (!existing) throw httpError(404, "Staff member not found.");

  const record = await prisma.staffMember.update({
    where: { id },
    data: {
      memberName: String(body.member_name ?? existing.memberName),
      designation: String(body.designation ?? existing.designation),
      cnicNtn: String(body.cnic_ntn ?? existing.cnicNtn),
      phoneNumber: String(body.phone_number ?? existing.phoneNumber),
      email: String(body.email ?? existing.email),
      province: String(body.province ?? existing.province),
      address: String(body.address ?? existing.address),
    },
  });
  return toDto(record);
}

export async function deleteStaffMember(id: string) {
  const existing = await prisma.staffMember.findUnique({ where: { id } });
  if (!existing) throw httpError(404, "Staff member not found.");
  await prisma.staffMember.delete({ where: { id } });
  return { id, deleted: true };
}
