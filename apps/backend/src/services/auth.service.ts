import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { CompanyKind, MembershipRole } from "../../generated/prisma/client.js";

const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  personalWorkspaceName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const devAdminEmail = process.env.ADMIN_EMAIL || "admin@fbr.com";
const devAdminPassword = process.env.ADMIN_PASSWORD || "admin123";
const devAdminFullName = process.env.ADMIN_FULL_NAME || "Admin";
const devAdminWorkspaceName = process.env.ADMIN_WORKSPACE_NAME || "Admin Workspace";
const allowDevAdminLogin = process.env.ALLOW_DEV_ADMIN_LOGIN === "true";

function isDevAdminLogin(email: string, password: string) {
  return allowDevAdminLogin && email === devAdminEmail && password === devAdminPassword;
}

async function makeDevAdminAuthResponse() {
  const passwordHash = await bcrypt.hash(devAdminPassword, 12);
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.upsert({
      where: { email: devAdminEmail },
      create: {
        id: "admin-user",
        email: devAdminEmail,
        passwordHash,
        fullName: devAdminFullName,
        isSuperAdmin: true,
      },
      update: {
        passwordHash,
        fullName: devAdminFullName,
        isSuperAdmin: true,
      },
    });
    const company = await tx.company.upsert({
      where: { id: "admin-company" },
      create: {
        id: "admin-company",
        name: devAdminWorkspaceName,
        kind: CompanyKind.PERSONAL,
      },
      update: { name: devAdminWorkspaceName },
    });

    await tx.userCompanyMembership.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
    const membership = await tx.userCompanyMembership.upsert({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId: company.id,
        },
      },
      create: {
        userId: user.id,
        companyId: company.id,
        role: MembershipRole.OWNER,
        isDefault: true,
      },
      update: {
        role: MembershipRole.OWNER,
        isDefault: true,
      },
    });

    return { user, company, membership };
  });

  const token = signAccessToken({
    sub: result.user.id,
    email: result.user.email,
    isSuperAdmin: true,
  });

  return {
    accessToken: token,
    user: {
      id: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
      phone: result.user.phone,
    },
    companies: [
      {
        id: result.company.id,
        name: result.company.name,
        kind: result.company.kind,
        role: result.membership.role,
        isDefault: result.membership.isDefault,
      },
    ],
    activeCompany: {
      id: result.company.id,
      name: result.company.name,
      kind: result.company.kind,
      membershipRole: result.membership.role,
      isDefault: result.membership.isDefault,
    },
  };
}

export async function registerUser(raw: unknown) {
  const data = registerSchema.parse(raw);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    const err = new Error("Email already registered");
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const workspaceName = data.personalWorkspaceName ?? `${data.fullName}'s workspace`;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone,
      },
    });

    const company = await tx.company.create({
      data: {
        name: workspaceName,
        kind: CompanyKind.PERSONAL,
      },
    });

    await tx.userCompanyMembership.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: MembershipRole.OWNER,
        isDefault: true,
      },
    });

    return { user, company };
  });

  const token = signAccessToken({
    sub: result.user.id,
    email: result.user.email,
    isSuperAdmin: result.user.isSuperAdmin,
  });

  return {
    accessToken: token,
    user: {
      id: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
      phone: result.user.phone,
    },
    defaultCompany: {
      id: result.company.id,
      name: result.company.name,
      kind: result.company.kind,
    },
    activeCompany: {
      id: result.company.id,
      name: result.company.name,
      kind: result.company.kind,
      membershipRole: MembershipRole.OWNER,
      isDefault: true,
    },
  };
}

export async function loginUser(raw: unknown) {
  const data = loginSchema.parse(raw);

  if (isDevAdminLogin(data.email, data.password)) {
    return makeDevAdminAuthResponse();
  }

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    const err = new Error("Invalid email or password");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }

  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) {
    const err = new Error("Invalid email or password");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }

  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
  });

  const memberships = await prisma.userCompanyMembership.findMany({
    where: { userId: user.id },
    include: { company: true },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });
  const activeMembership = memberships[0];

  return {
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
    },
    companies: memberships.map((m: (typeof memberships)[number]) => ({
      id: m.company.id,
      name: m.company.name,
      kind: m.company.kind,
      role: m.role,
      isDefault: m.isDefault,
    })),
    activeCompany: activeMembership ? {
      id: activeMembership.company.id,
      name: activeMembership.company.name,
      kind: activeMembership.company.kind,
      membershipRole: activeMembership.role,
      isDefault: activeMembership.isDefault,
    } : null,
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { company: true },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      },
    },
  });
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    isSuperAdmin: user.isSuperAdmin,
    companies: user.memberships.map((m: (typeof user.memberships)[number]) => ({
      id: m.company.id,
      name: m.company.name,
      kind: m.company.kind,
      role: m.role,
      isDefault: m.isDefault,
    })),
  };
}

function makeError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

// ── Forgot Password ───────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  // Always respond the same way — don't reveal whether the email exists
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: "If that email is registered, a reset code has been sent." };
  }

  const code = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit OTP
  const resetToken = randomBytes(24).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);
  const cacheKey = `password-reset:${email}`;

  await prisma.referenceCache.upsert({
    where: { cacheKey },
    create: { cacheKey, data: { code, resetToken, email }, fetchedAt: now, expiresAt },
    update: { data: { code, resetToken, email }, fetchedAt: now, expiresAt },
  });

  // No email service — return code in response (dev/sandbox mode)
  return {
    message: "Reset code generated.",
    devCode: code,
  };
}

export async function verifyResetCode(email: string, code: string) {
  const cacheKey = `password-reset:${email}`;
  const cached = await prisma.referenceCache.findUnique({ where: { cacheKey } });

  if (!cached || new Date() > cached.expiresAt) {
    throw makeError("Reset code has expired. Please request a new one.", 400);
  }

  const data = cached.data as { code: string; resetToken: string; email: string };
  if (data.code !== code.trim()) {
    throw makeError("Invalid reset code.", 400);
  }

  return { resetToken: data.resetToken };
}

export async function resetPassword(email: string, resetToken: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw makeError("Password must be at least 8 characters.", 400);
  }

  const cacheKey = `password-reset:${email}`;
  const cached = await prisma.referenceCache.findUnique({ where: { cacheKey } });

  if (!cached || new Date() > cached.expiresAt) {
    throw makeError("Reset session has expired. Please start again.", 400);
  }

  const data = cached.data as { code: string; resetToken: string; email: string };
  if (data.resetToken !== resetToken) {
    throw makeError("Invalid reset token.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  await prisma.referenceCache.delete({ where: { cacheKey } });

  return { message: "Password reset successfully. You can now log in." };
}
