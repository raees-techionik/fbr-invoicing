import jwt from "jsonwebtoken";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";

export function signAccessToken(payload: { sub: string; email: string; isSuperAdmin: boolean }): string {
  return jwt.sign(payload, getSecret(), { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
} {
  const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload & {
    sub: string;
    email: string;
    isSuperAdmin?: boolean;
  };
  return {
    sub: String(decoded.sub),
    email: String(decoded.email),
    isSuperAdmin: Boolean(decoded.isSuperAdmin),
  };
}
