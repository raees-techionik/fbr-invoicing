import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const rawCompanyId = req.headers["x-company-id"];
  if (Array.isArray(rawCompanyId)) {
    res.status(400).json({ error: "Only one X-Company-Id header may be supplied" });
    return;
  }

  const requestedCompanyId = rawCompanyId?.trim();
  if (rawCompanyId !== undefined && !requestedCompanyId) {
    res.status(400).json({ error: "X-Company-Id cannot be empty" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        memberships: {
          where: requestedCompanyId ? { companyId: requestedCompanyId } : undefined,
          include: { company: true },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
          take: 1,
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: "User account no longer exists" });
      return;
    }

    const membership = user.memberships[0];
    const company = membership?.company ?? (
      requestedCompanyId && user.isSuperAdmin
        ? await prisma.company.findUnique({ where: { id: requestedCompanyId } })
        : null
    );

    if (!company) {
      res.status(403).json({
        error: requestedCompanyId
          ? "You do not have access to the requested company"
          : "No company is assigned to this user",
      });
      return;
    }

    req.auth = {
      userId: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    };
    req.companyId = company.id;
    req.activeCompany = {
      id: company.id,
      name: company.name,
      kind: company.kind,
      membershipRole: membership?.role ?? null,
      isDefault: membership?.isDefault ?? false,
    };
    next();
  } catch (error) {
    next(error);
  }
};
