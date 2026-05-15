import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/jwt.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      isSuperAdmin: payload.isSuperAdmin,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
