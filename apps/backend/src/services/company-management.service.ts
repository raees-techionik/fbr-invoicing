import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  CompanyKind,
  FbrApprovalStatus,
  FbrOnboardingStatus,
  FbrSandboxStatus,
  FbrTokenStatus,
  InvitationEmailStatus,
  MembershipRole,
  type Prisma,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { makeInvitationLink, sendEmail, type EmailDeliveryResult } from "./email.service.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CompanyActor {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  membershipRole: MembershipRole | null;
}

const createCompanySchema = z.object({
  name: z.string().trim().min(1),
  legalName: z.string().trim().min(1).optional(),
  ntn: z.string().trim().min(1).optional(),
  ownerUserId: z.string().trim().min(1).optional(),
  ownerEmail: z.string().trim().email().optional(),
  businessNature: z.string().trim().min(1).optional(),
  primarySector: z.string().trim().min(1).optional(),
}).refine((data) => data.ownerUserId || data.ownerEmail, {
  message: "ownerUserId or ownerEmail is required",
  path: ["ownerEmail"],
});

const updateCompanySchema = z.object({
  name: z.string().trim().min(1).optional(),
  legalName: z.string().trim().min(1).nullable().optional(),
  ntn: z.string().trim().min(1).nullable().optional(),
});

const invitationSchema = z.object({
  email: z.string().trim().email(),
  role: z.nativeEnum(MembershipRole).default(MembershipRole.MEMBER),
});

const membershipRoleSchema = z.object({
  role: z.nativeEnum(MembershipRole),
});

const onboardingSchema = z.object({
  status: z.nativeEnum(FbrOnboardingStatus).optional(),
  businessNature: z.string().trim().nullable().optional(),
  primarySector: z.string().trim().nullable().optional(),
  technicalContactName: z.string().trim().nullable().optional(),
  technicalContactMobile: z.string().trim().nullable().optional(),
  technicalContactEmail: z.string().trim().email().nullable().optional(),
  erpProvider: z.string().trim().min(1).optional(),
  softwareType: z.string().trim().min(1).optional(),
  ipWhitelistStatus: z.nativeEnum(FbrApprovalStatus).optional(),
  sandboxTokenStatus: z.nativeEnum(FbrTokenStatus).optional(),
  sandboxStatus: z.nativeEnum(FbrSandboxStatus).optional(),
  productionTokenStatus: z.nativeEnum(FbrTokenStatus).optional(),
  irisSubmittedAt: z.coerce.date().nullable().optional(),
  ipWhitelistApprovedAt: z.coerce.date().nullable().optional(),
  sandboxStartedAt: z.coerce.date().nullable().optional(),
  sandboxCompletedAt: z.coerce.date().nullable().optional(),
  productionRequestedAt: z.coerce.date().nullable().optional(),
  goLiveAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export async function listCompanies(actor: CompanyActor, includeAll = false) {
  if (includeAll && actor.isSuperAdmin) {
    const companies = await prisma.company.findMany({
      include: {
        onboarding: true,
        _count: { select: { memberships: true, invitations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const withProgress = companies.map((company) => {
      const onboarding = company.onboarding ? onboardingDto(company.onboarding) : null;
      return { company, onboarding };
    });
    return withProgress.map(({ company, onboarding }) => ({
      ...companyDto(company),
      role: null,
      isDefault: false,
      memberCount: company._count.memberships,
      invitationCount: company._count.invitations,
      onboardingStatus: onboarding?.status ?? null,
      onboardingProgress: onboarding?.progress ?? null,
      onboardingNextStep: onboarding?.nextStep ?? null,
    }));
  }

  const memberships = await prisma.userCompanyMembership.findMany({
    where: { userId: actor.userId },
    include: {
      company: {
        include: {
          onboarding: true,
          _count: { select: { memberships: true, invitations: true } },
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });

  return memberships.map((membership) => {
    const onboarding = membership.company.onboarding ? onboardingDto(membership.company.onboarding) : null;
    return {
    ...companyDto(membership.company),
    role: membership.role,
    isDefault: membership.isDefault,
    memberCount: membership.company._count.memberships,
      invitationCount: membership.company._count.invitations,
      onboardingStatus: onboarding?.status ?? null,
      onboardingProgress: onboarding?.progress ?? null,
      onboardingNextStep: onboarding?.nextStep ?? null,
    };
  });
}

export async function getCurrentCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      onboarding: true,
      _count: { select: { memberships: true, invitations: true } },
    },
  });
  if (!company) throw httpError(404, "Company not found.");
  return {
    ...companyDto(company),
    memberCount: company._count.memberships,
    invitationCount: company._count.invitations,
    onboarding: company.onboarding ? onboardingDto(company.onboarding) : null,
  };
}

export async function createBusinessCompany(actor: CompanyActor, raw: unknown) {
  requireSuperAdmin(actor);
  const data = createCompanySchema.parse(raw);
  const owner = await resolveOwner(data.ownerUserId, data.ownerEmail);
  const invitationToken = owner ? null : makeInvitationToken();
  const ownerEmail = owner?.email ?? normalizeEmail(data.ownerEmail!);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const company = await tx.company.create({
      data: {
        name: data.name,
        legalName: data.legalName,
        ntn: data.ntn,
        kind: CompanyKind.BUSINESS,
        profile: {
          create: {
            companyName: data.legalName ?? data.name,
            ntnOrCnic: data.ntn ?? "",
            businessType: data.businessNature ?? "",
          },
        },
        onboarding: {
          create: {
            businessNature: data.businessNature,
            primarySector: data.primarySector,
          },
        },
      },
    });

    if (owner) {
      await tx.userCompanyMembership.create({
        data: {
          userId: owner.id,
          companyId: company.id,
          role: MembershipRole.OWNER,
        },
      });
      await recordCompanyActivity(tx, {
        companyId: company.id,
        actor,
        action: "company.owner_assigned",
        summary: `${owner.email} was assigned as company owner.`,
        metadata: { userId: owner.id, email: owner.email, role: MembershipRole.OWNER },
      });
    } else {
      const invitation = await tx.companyInvitation.create({
        data: {
          companyId: company.id,
          email: ownerEmail,
          role: MembershipRole.OWNER,
          tokenHash: hashToken(invitationToken!),
          invitedByUserId: actor.userId,
          expiresAt: invitationExpiry(),
        },
      });
      await recordCompanyActivity(tx, {
        companyId: company.id,
        actor,
        action: "company.owner_invited",
        summary: `${ownerEmail} was invited as company owner.`,
        metadata: { invitationId: invitation.id, email: ownerEmail, role: MembershipRole.OWNER },
      });
    }

    await recordCompanyActivity(tx, {
      companyId: company.id,
      actor,
      action: "company.created",
      summary: `${company.name} business tenant was created.`,
      metadata: {
        name: company.name,
        legalName: company.legalName,
        ntn: company.ntn,
        ownerEmail,
      },
    });
    return company;
  });

  const ownerDelivery = invitationToken
    ? await sendInvitationEmailAndUpdate({
      companyId: result.id,
      companyName: result.name,
      email: ownerEmail,
      role: MembershipRole.OWNER,
      token: invitationToken,
      actor,
      action: "invitation.owner_email",
    })
    : null;

  return {
    company: companyDto(result),
    owner: owner ? { userId: owner.id, email: owner.email, assigned: true } : {
      email: ownerEmail,
      assigned: false,
      invitationPending: true,
      emailDelivery: ownerDelivery,
      ...(shouldExposeInvitationToken(ownerDelivery) ? { devInvitationToken: invitationToken } : {}),
    },
  };
}

export async function updateCurrentCompany(companyId: string, actor: CompanyActor, raw: unknown) {
  requireCompanyAdmin(actor);
  const data = updateCompanySchema.parse(raw);
  const previous = await prisma.company.findUnique({ where: { id: companyId } });
  if (!previous) throw httpError(404, "Company not found.");
  const company = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await tx.company.update({ where: { id: companyId }, data });
    if (data.name !== undefined || data.legalName !== undefined || data.ntn !== undefined) {
      await tx.companyProfile.upsert({
      where: { companyId },
      create: {
        companyId,
          companyName: data.legalName ?? data.name ?? updated.name,
        ntnOrCnic: data.ntn ?? "",
      },
      update: {
        ...(data.name !== undefined || data.legalName !== undefined
            ? { companyName: data.legalName ?? data.name ?? updated.name }
          : {}),
        ...(data.ntn !== undefined ? { ntnOrCnic: data.ntn ?? "" } : {}),
      },
    });
    }
    await recordCompanyActivity(tx, {
      companyId,
      actor,
      action: "company.updated",
      summary: "Company details were updated.",
      metadata: changedValues(previous, updated, ["name", "legalName", "ntn"]),
    });
    return updated;
  });
  return companyDto(company);
}

export async function setDefaultCompany(userId: string, companyId: string) {
  const membership = await prisma.userCompanyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership) throw httpError(403, "You are not a member of this company.");

  await prisma.$transaction([
    prisma.userCompanyMembership.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.userCompanyMembership.update({ where: { id: membership.id }, data: { isDefault: true } }),
  ]);
  return { companyId, isDefault: true };
}

export async function listCompanyMembers(companyId: string) {
  const memberships = await prisma.userCompanyMembership.findMany({
    where: { companyId },
    include: { user: { select: { id: true, email: true, fullName: true, phone: true } } },
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });
  return memberships.map((membership) => ({
    id: membership.id,
    role: membership.role,
    isDefault: membership.isDefault,
    user: membership.user,
  }));
}

export async function inviteCompanyMember(companyId: string, actor: CompanyActor, raw: unknown) {
  requireCompanyAdmin(actor);
  const data = invitationSchema.parse(raw);
  assertCanAssignRole(actor, data.role);
  const email = normalizeEmail(data.email);
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId: existingUser.id, companyId } },
    });
    if (existingMembership) throw httpError(409, "This user is already a company member.");
  }

  const token = makeInvitationToken();
  const expiry = invitationExpiry();
  const invitation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.companyInvitation.updateMany({
      where: { companyId, email, status: "PENDING" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    const createdInvitation = await tx.companyInvitation.create({
      data: {
        companyId,
        email,
        role: data.role,
        tokenHash: hashToken(token),
        invitedByUserId: actor.userId,
        expiresAt: expiry,
      },
    });
    await recordCompanyActivity(tx, {
      companyId,
      actor,
      action: "invitation.created",
      summary: `${email} was invited as ${data.role.toLowerCase()}.`,
      metadata: { invitationId: createdInvitation.id, email, role: data.role },
    });
    return createdInvitation;
  });

  const emailDelivery = await sendInvitationEmailAndUpdate({
    invitationId: invitation.id,
    companyId,
    email,
    role: data.role,
    token,
    actor,
    action: "invitation.email",
  });

  return {
    email,
    role: data.role,
    status: "PENDING",
    expiresAt: expiry.toISOString(),
    emailDelivery,
    ...(shouldExposeInvitationToken(emailDelivery) ? { devInvitationToken: token } : {}),
  };
}

export async function listCompanyInvitations(companyId: string, actor: CompanyActor) {
  requireCompanyAdmin(actor);
  await expireInvitations(companyId);
  const invitations = await prisma.companyInvitation.findMany({
    where: { companyId },
    include: { invitedBy: { select: { id: true, email: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return invitations.map(invitationDto);
}

export async function revokeCompanyInvitation(companyId: string, actor: CompanyActor, invitationId: string) {
  requireCompanyAdmin(actor);
  const invitation = await prisma.companyInvitation.findFirst({
    where: { id: invitationId, companyId, status: "PENDING" },
  });
  if (!invitation) throw httpError(404, "Pending invitation not found.");
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.companyInvitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await recordCompanyActivity(tx, {
      companyId,
      actor,
      action: "invitation.revoked",
      summary: `Invitation for ${invitation.email} was revoked.`,
      metadata: { invitationId: invitation.id, email: invitation.email, role: invitation.role },
    });
  });
  return { id: invitation.id, revoked: true };
}

export async function acceptCompanyInvitation(
  actor: CompanyActor,
  token: string,
  makeDefault: boolean,
) {
  const invitation = await prisma.companyInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { company: true },
  });
  if (!invitation || invitation.status !== "PENDING") {
    throw httpError(404, "Pending invitation not found.");
  }
  if (invitation.expiresAt <= new Date()) {
    await prisma.companyInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    throw httpError(410, "Invitation has expired.");
  }
  if (normalizeEmail(actor.email) !== invitation.email) {
    throw httpError(403, "This invitation belongs to a different email address.");
  }

  const membership = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (makeDefault) {
      await tx.userCompanyMembership.updateMany({
        where: { userId: actor.userId },
        data: { isDefault: false },
      });
    }
    const acceptedMembership = await tx.userCompanyMembership.upsert({
      where: { userId_companyId: { userId: actor.userId, companyId: invitation.companyId } },
      create: {
        userId: actor.userId,
        companyId: invitation.companyId,
        role: invitation.role,
        isDefault: makeDefault,
      },
      update: { role: invitation.role, ...(makeDefault ? { isDefault: true } : {}) },
    });
    await tx.companyInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedByUserId: actor.userId,
        acceptedAt: new Date(),
      },
    });
    await recordCompanyActivity(tx, {
      companyId: invitation.companyId,
      actor,
      action: "invitation.accepted",
      summary: `${actor.email} accepted an invitation as ${invitation.role.toLowerCase()}.`,
      metadata: {
        invitationId: invitation.id,
        membershipId: acceptedMembership.id,
        email: invitation.email,
        role: invitation.role,
        makeDefault,
      },
    });
    return acceptedMembership;
  });

  return {
    company: companyDto(invitation.company),
    membership: { id: membership.id, role: membership.role, isDefault: membership.isDefault },
  };
}

export async function updateCompanyMemberRole(
  companyId: string,
  actor: CompanyActor,
  membershipId: string,
  raw: unknown,
) {
  requireCompanyAdmin(actor);
  const { role } = membershipRoleSchema.parse(raw);
  assertCanAssignRole(actor, role);
  const target = await prisma.userCompanyMembership.findFirst({
    where: { id: membershipId, companyId },
  });
  if (!target) throw httpError(404, "Company member not found.");
  assertCanManageTarget(actor, target.role);
  if (target.role === MembershipRole.OWNER && role !== MembershipRole.OWNER) {
    await assertAnotherOwnerExists(companyId, target.id);
  }
  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const changed = await tx.userCompanyMembership.update({
      where: { id: target.id },
      data: { role },
      include: { user: { select: { email: true, fullName: true } } },
    });
    await recordCompanyActivity(tx, {
      companyId,
      actor,
      action: "member.role_updated",
      summary: `${changed.user.email} role changed from ${target.role} to ${role}.`,
      metadata: { membershipId: target.id, userEmail: changed.user.email, previousRole: target.role, role },
    });
    return changed;
  });
  return { id: updated.id, role: updated.role };
}

export async function removeCompanyMember(companyId: string, actor: CompanyActor, membershipId: string) {
  requireCompanyAdmin(actor);
  const target = await prisma.userCompanyMembership.findFirst({
    where: { id: membershipId, companyId },
    include: { user: { select: { email: true, fullName: true } } },
  });
  if (!target) throw httpError(404, "Company member not found.");
  assertCanManageTarget(actor, target.role);
  if (target.role === MembershipRole.OWNER) {
    await assertAnotherOwnerExists(companyId, target.id);
  }
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.userCompanyMembership.delete({ where: { id: target.id } });
    await recordCompanyActivity(tx, {
      companyId,
      actor,
      action: "member.removed",
      summary: `${target.user.email} was removed from the company.`,
      metadata: { membershipId: target.id, userEmail: target.user.email, role: target.role },
    });
  });
  return { id: target.id, removed: true };
}

export async function getCompanyOnboarding(companyId: string) {
  const onboarding = await prisma.fbrOnboarding.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
  return onboardingDto(onboarding);
}

export async function listCompanyActivity(companyId: string, actor: CompanyActor, limitRaw: unknown = 50) {
  requireCompanyAdmin(actor);
  const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 100);
  const logs = await prisma.companyActivityLog.findMany({
    where: { companyId },
    include: { actor: { select: { id: true, email: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return logs.map(activityDto);
}

export async function updateCompanyOnboarding(companyId: string, actor: CompanyActor, raw: unknown) {
  requireCompanyAdmin(actor);
  const parsed = onboardingSchema.parse(raw);
  const now = new Date();
  const data = {
    ...parsed,
    ...(parsed.ipWhitelistStatus === FbrApprovalStatus.APPROVED && parsed.ipWhitelistApprovedAt === undefined
      ? { ipWhitelistApprovedAt: now }
      : {}),
    ...(parsed.sandboxStatus === FbrSandboxStatus.IN_PROGRESS && parsed.sandboxStartedAt === undefined
      ? { sandboxStartedAt: now }
      : {}),
    ...(parsed.sandboxStatus === FbrSandboxStatus.PASSED && parsed.sandboxCompletedAt === undefined
      ? { sandboxCompletedAt: now }
      : {}),
    ...(parsed.productionTokenStatus === FbrTokenStatus.REQUESTED && parsed.productionRequestedAt === undefined
      ? { productionRequestedAt: now }
      : {}),
    ...(parsed.status === FbrOnboardingStatus.LIVE && parsed.goLiveAt === undefined
      ? { goLiveAt: now }
      : {}),
  };
  const previous = await prisma.fbrOnboarding.findUnique({ where: { companyId } });
  const onboarding = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await tx.fbrOnboarding.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
    });
    await recordCompanyActivity(tx, {
      companyId,
      actor,
      action: "onboarding.updated",
      summary: "FBR onboarding workflow was updated.",
      metadata: previous ? changedValues(previous, updated, Object.keys(data)) : { created: true, values: toAuditJsonObject(data) },
    });
    return updated;
  });
  return onboardingDto(onboarding);
}

async function resolveOwner(userId?: string, email?: string) {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw httpError(404, "Owner user not found.");
    if (email && user.email !== normalizeEmail(email)) {
      throw httpError(400, "ownerUserId and ownerEmail refer to different users.");
    }
    return user;
  }
  return email ? prisma.user.findUnique({ where: { email: normalizeEmail(email) } }) : null;
}

async function assertAnotherOwnerExists(companyId: string, excludedMembershipId: string) {
  const owners = await prisma.userCompanyMembership.count({
    where: { companyId, role: MembershipRole.OWNER, id: { not: excludedMembershipId } },
  });
  if (owners === 0) throw httpError(409, "A company must retain at least one owner.");
}

function requireSuperAdmin(actor: CompanyActor) {
  if (!actor.isSuperAdmin) throw httpError(403, "Platform administrator access is required.");
}

function requireCompanyAdmin(actor: CompanyActor) {
  if (!actor.isSuperAdmin && actor.membershipRole !== MembershipRole.OWNER && actor.membershipRole !== MembershipRole.ADMIN) {
    throw httpError(403, "Company owner or administrator access is required.");
  }
}

function assertCanAssignRole(actor: CompanyActor, role: MembershipRole) {
  if (!actor.isSuperAdmin && actor.membershipRole === MembershipRole.ADMIN && (role === MembershipRole.OWNER || role === MembershipRole.ADMIN)) {
    throw httpError(403, "Company administrators cannot assign owner or administrator roles.");
  }
}

function assertCanManageTarget(actor: CompanyActor, targetRole: MembershipRole) {
  if (!actor.isSuperAdmin && actor.membershipRole === MembershipRole.ADMIN && (targetRole === MembershipRole.OWNER || targetRole === MembershipRole.ADMIN)) {
    throw httpError(403, "Company administrators cannot manage owners or other administrators.");
  }
}

async function expireInvitations(companyId: string) {
  await prisma.companyInvitation.updateMany({
    where: { companyId, status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
}

async function recordCompanyActivity(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    actor: CompanyActor;
    action: string;
    summary: string;
    metadata?: Prisma.InputJsonObject;
  },
) {
  await tx.companyActivityLog.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actor.userId,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata ?? undefined,
    },
  });
}

function changedValues<T extends Record<string, unknown>>(previous: T, next: T, keys: string[]): Prisma.InputJsonObject {
  const changes: Record<string, { from: Prisma.InputJsonValue | null; to: Prisma.InputJsonValue | null }> = {};
  for (const key of keys) {
    const before = normalizeAuditValue(previous[key]);
    const after = normalizeAuditValue(next[key]);
    if (before !== after) changes[key] = { from: before, to: after };
  }
  return changes as Prisma.InputJsonObject;
}

function normalizeAuditValue(value: unknown): Prisma.InputJsonValue | null {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function toAuditJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

async function sendInvitationEmailAndUpdate(input: {
  invitationId?: string;
  companyId: string;
  companyName?: string;
  email: string;
  role: MembershipRole;
  token: string;
  actor: CompanyActor;
  action: string;
}): Promise<EmailDeliveryResult> {
  const company = input.companyName
    ? { name: input.companyName }
    : await prisma.company.findUnique({ where: { id: input.companyId }, select: { name: true } });
  const invitationLink = makeInvitationLink(input.token);
  const delivery = await sendEmail({
    to: input.email,
    subject: `Invitation to ${company?.name ?? "your company"} on Techionik FBR Digital Invoicing`,
    text: [
      `You have been invited as ${input.role.toLowerCase()} for ${company?.name ?? "a company"} on Techionik FBR Digital Invoicing.`,
      "",
      `Accept invitation: ${invitationLink}`,
      "",
      "This link expires in 7 days.",
    ].join("\n"),
    html: [
      `<p>You have been invited as <strong>${escapeHtml(input.role.toLowerCase())}</strong> for <strong>${escapeHtml(company?.name ?? "a company")}</strong> on Techionik FBR Digital Invoicing.</p>`,
      `<p><a href="${escapeHtml(invitationLink)}">Accept invitation</a></p>`,
      "<p>This link expires in 7 days.</p>",
    ].join(""),
  });
  const now = new Date();
  const emailStatus = delivery.status === "SENT"
    ? InvitationEmailStatus.SENT
    : delivery.status === "FAILED"
      ? InvitationEmailStatus.FAILED
      : InvitationEmailStatus.DEV_LOGGED;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const where = input.invitationId
      ? { id: input.invitationId }
      : { tokenHash: hashToken(input.token) };
    const invitation = await tx.companyInvitation.update({
      where,
      data: {
        emailStatus,
        emailAttemptedAt: now,
        emailSentAt: delivery.status === "SENT" ? now : null,
        emailError: delivery.error ?? null,
      },
    });
    await recordCompanyActivity(tx, {
      companyId: input.companyId,
      actor: input.actor,
      action: input.action,
      summary: delivery.status === "SENT"
        ? `Invitation email was sent to ${input.email}.`
        : delivery.status === "FAILED"
          ? `Invitation email to ${input.email} failed.`
          : `Invitation email for ${input.email} was logged for local delivery.`,
      metadata: {
        invitationId: invitation.id,
        email: input.email,
        role: input.role,
        emailStatus,
        emailError: delivery.error ?? null,
      },
    });
  });

  return delivery;
}

function shouldExposeInvitationToken(delivery: EmailDeliveryResult | null) {
  return delivery?.status === "DEV_LOGGED" || process.env.EXPOSE_DEV_INVITATION_TOKENS === "true";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function companyDto(company: { id: string; name: string; kind: CompanyKind; legalName: string | null; ntn: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: company.id,
    name: company.name,
    kind: company.kind,
    legalName: company.legalName,
    ntn: company.ntn,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

function onboardingDto(onboarding: {
  id: string;
  companyId: string;
  status: FbrOnboardingStatus;
  businessNature: string | null;
  primarySector: string | null;
  technicalContactName: string | null;
  technicalContactMobile: string | null;
  technicalContactEmail: string | null;
  erpProvider: string;
  softwareType: string;
  ipWhitelistStatus: FbrApprovalStatus;
  sandboxTokenStatus: FbrTokenStatus;
  sandboxStatus: FbrSandboxStatus;
  productionTokenStatus: FbrTokenStatus;
  irisSubmittedAt: Date | null;
  ipWhitelistApprovedAt: Date | null;
  sandboxStartedAt: Date | null;
  sandboxCompletedAt: Date | null;
  productionRequestedAt: Date | null;
  goLiveAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const milestones = [
    Boolean(onboarding.businessNature && onboarding.primarySector && onboarding.technicalContactEmail),
    Boolean(onboarding.irisSubmittedAt),
    onboarding.ipWhitelistStatus === FbrApprovalStatus.APPROVED,
    onboarding.sandboxTokenStatus === FbrTokenStatus.CONFIGURED,
    onboarding.sandboxStatus === FbrSandboxStatus.PASSED,
    onboarding.productionTokenStatus === FbrTokenStatus.CONFIGURED,
    onboarding.status === FbrOnboardingStatus.LIVE,
  ];
  return {
    ...onboarding,
    createdAt: onboarding.createdAt.toISOString(),
    updatedAt: onboarding.updatedAt.toISOString(),
    irisSubmittedAt: onboarding.irisSubmittedAt?.toISOString() ?? null,
    ipWhitelistApprovedAt: onboarding.ipWhitelistApprovedAt?.toISOString() ?? null,
    sandboxStartedAt: onboarding.sandboxStartedAt?.toISOString() ?? null,
    sandboxCompletedAt: onboarding.sandboxCompletedAt?.toISOString() ?? null,
    productionRequestedAt: onboarding.productionRequestedAt?.toISOString() ?? null,
    goLiveAt: onboarding.goLiveAt?.toISOString() ?? null,
    progress: {
      completed: milestones.filter(Boolean).length,
      total: milestones.length,
      percentage: Math.round((milestones.filter(Boolean).length / milestones.length) * 100),
    },
    nextStep: onboardingNextStep(onboarding.status),
  };
}

function onboardingNextStep(status: FbrOnboardingStatus) {
  const steps: Record<FbrOnboardingStatus, string> = {
    PROFILE_PENDING: "Complete the business and technical contact profile.",
    PRODUCT_MAPPING_PENDING: "Map products and services to FBR HS codes and sale types.",
    IRIS_REGISTRATION_PENDING: "Submit digital invoicing registration through IRIS.",
    IP_WHITELIST_PENDING: "Submit and confirm the production server IP whitelist request.",
    SANDBOX_TOKEN_PENDING: "Configure the company sandbox token.",
    SANDBOX_TESTING: "Run and pass the required PRAL sandbox scenarios.",
    CLIENT_TESTING: "Complete client acceptance testing and sign-off.",
    PRODUCTION_TOKEN_PENDING: "Request and configure the production token.",
    READY_FOR_LIVE: "Confirm final readiness and schedule go-live.",
    LIVE: "Monitor live invoice submissions and token health.",
    SUSPENDED: "Resolve the suspension before submitting invoices.",
  };
  return steps[status];
}

function invitationDto(invitation: {
  id: string;
  email: string;
  role: MembershipRole;
  status: string;
  emailStatus: string;
  emailSentAt: Date | null;
  emailError: string | null;
  emailAttemptedAt: Date | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedBy: { id: string; email: string; fullName: string };
}) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    emailStatus: invitation.emailStatus,
    emailSentAt: invitation.emailSentAt?.toISOString() ?? null,
    emailError: invitation.emailError,
    emailAttemptedAt: invitation.emailAttemptedAt?.toISOString() ?? null,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
    invitedBy: invitation.invitedBy,
  };
}

function activityDto(activity: {
  id: string;
  action: string;
  summary: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: { id: string; email: string; fullName: string } | null;
}) {
  return {
    id: activity.id,
    action: activity.action,
    summary: activity.summary,
    metadata: activity.metadata,
    createdAt: activity.createdAt.toISOString(),
    actor: activity.actor,
  };
}

function makeInvitationToken() {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function invitationExpiry() {
  return new Date(Date.now() + INVITATION_TTL_MS);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function httpError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}
