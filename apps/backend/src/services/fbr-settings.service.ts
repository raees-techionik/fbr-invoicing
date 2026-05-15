import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { getCache } from "../lib/cache.js";
import { prisma } from "../lib/prisma.js";

type FbrEnvironment = "sandbox" | "production";
type TokenValidityStatus = "mock" | "missing" | "configured_unverified" | "active" | "invalid" | "error";

export interface StoredFbrSettings {
  environment: FbrEnvironment;
  useMock: boolean;
  sandboxToken?: string;
  productionToken?: string;
  updatedAt: string;
}

interface CachedFbrSettings {
  environment: FbrEnvironment;
  useMock: boolean;
  updatedAt: string;
}

export interface PublicFbrSettings {
  environment: FbrEnvironment;
  useMock: boolean;
  tokens: {
    sandbox: MaskedToken;
    production: MaskedToken;
  };
  tokenStatus: {
    sandbox: TokenStatus;
    production: TokenStatus;
    active: TokenStatus;
  };
  updatedAt: string;
}

export interface RuntimeFbrSettings {
  environment: FbrEnvironment;
  useMock: boolean;
  sandboxToken: string;
  productionToken: string;
  activeToken: string;
}

interface MaskedToken {
  configured: boolean;
  masked: string;
}

interface TokenStatus {
  environment: FbrEnvironment;
  status: TokenValidityStatus;
  message: string;
  checkedAt: string;
}

interface UpdateSettingsInput {
  environment?: unknown;
  useMock?: unknown;
  sandboxToken?: unknown;
  productionToken?: unknown;
  clearSandboxToken?: unknown;
  clearProductionToken?: unknown;
}

interface OutboundIpResult {
  publicIp: string;
  source: "env" | "ipify" | "unavailable";
  localAddresses: string[];
  checkedAt: string;
}

const SETTINGS_CACHE_KEY = "fbr:settings:global";
const FBR_BASE_URL = process.env.FBR_BASE_URL ?? "https://gw.fbr.gov.pk";

export async function getPublicFbrSettings(checkLive = false): Promise<PublicFbrSettings> {
  const settings = await getStoredFbrSettings();

  return {
    environment: settings.environment,
    useMock: settings.useMock,
    tokens: {
      sandbox: maskToken(settings.sandboxToken),
      production: maskToken(settings.productionToken),
    },
    tokenStatus: {
      sandbox: await getTokenStatus("sandbox", checkLive),
      production: await getTokenStatus("production", checkLive),
      active: await getTokenStatus(settings.environment, checkLive),
    },
    updatedAt: settings.updatedAt,
  };
}

export async function updateFbrSettings(input: UpdateSettingsInput): Promise<PublicFbrSettings> {
  const current = await getStoredFbrSettings();

  const next: CachedFbrSettings = {
    environment: input.environment === undefined ? current.environment : parseEnvironment(input.environment),
    useMock: input.useMock === undefined ? current.useMock : parseBoolean(input.useMock, current.useMock),
    updatedAt: new Date().toISOString(),
  };

  if (parseBoolean(input.clearSandboxToken, false)) {
    await deactivateTokens("sandbox");
  } else if (stringValue(input.sandboxToken)) {
    await storeActiveToken("sandbox", stringValue(input.sandboxToken));
  }

  if (parseBoolean(input.clearProductionToken, false)) {
    await deactivateTokens("production");
  } else if (stringValue(input.productionToken)) {
    await storeActiveToken("production", stringValue(input.productionToken));
  }

  await getCache().set(SETTINGS_CACHE_KEY, JSON.stringify(next));
  return getPublicFbrSettings(false);
}

export async function getRuntimeFbrSettings(overrides: {
  environment?: unknown;
  token?: unknown;
  sandboxToken?: unknown;
  productionToken?: unknown;
  useMock?: unknown;
} = {}): Promise<RuntimeFbrSettings> {
  const stored = await getStoredFbrSettings();
  const environment = overrides.environment === undefined ? stored.environment : parseEnvironment(overrides.environment);
  const useMock = overrides.useMock === undefined ? stored.useMock : parseBoolean(overrides.useMock, stored.useMock);
  const requestToken = stringValue(overrides.token);
  const sandboxToken =
    requestToken ||
    stringValue(overrides.sandboxToken) ||
    decryptToken(stored.sandboxToken) ||
    stringValue(process.env.FBR_SANDBOX_TOKEN);
  const productionToken =
    requestToken ||
    stringValue(overrides.productionToken) ||
    decryptToken(stored.productionToken) ||
    stringValue(process.env.FBR_PRODUCTION_TOKEN);
  const fallbackToken = stringValue(process.env.FBR_API_TOKEN);
  const activeToken = (environment === "production" ? productionToken : sandboxToken) || fallbackToken;

  return {
    environment,
    useMock,
    sandboxToken,
    productionToken,
    activeToken,
  };
}

export async function getTokenStatus(environment: FbrEnvironment, checkLive = false): Promise<TokenStatus> {
  const settings = await getRuntimeFbrSettings({ environment });
  const checkedAt = new Date().toISOString();

  if (settings.useMock) {
    return {
      environment,
      status: "mock",
      message: "Mock mode is enabled. Live token validation is skipped.",
      checkedAt,
    };
  }

  const token = environment === "production" ? settings.productionToken : settings.sandboxToken;

  if (!token) {
    return {
      environment,
      status: "missing",
      message: "No token is stored for this environment.",
      checkedAt,
    };
  }

  if (!checkLive) {
    return {
      environment,
      status: "configured_unverified",
      message: "Token is stored, but live validation was not requested.",
      checkedAt,
    };
  }

  try {
    const response = await fetch(new URL("/pdi/v1/provinces", FBR_BASE_URL), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 401) {
      return {
        environment,
        status: "invalid",
        message: "FBR rejected the token.",
        checkedAt,
      };
    }

    return {
      environment,
      status: response.ok ? "active" : "error",
      message: response.ok ? "FBR accepted the token." : `FBR returned HTTP ${response.status}.`,
      checkedAt,
    };
  } catch (error) {
    return {
      environment,
      status: "error",
      message: error instanceof Error ? error.message : "Token validation failed.",
      checkedAt,
    };
  }
}

export async function getOutboundIp(): Promise<OutboundIpResult> {
  const configuredIp = stringValue(process.env.FBR_OUTBOUND_IP);

  if (configuredIp) {
    return {
      publicIp: configuredIp,
      source: "env",
      localAddresses: getLocalAddresses(),
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5_000),
    });
    const body = (await response.json()) as { ip?: string };

    return {
      publicIp: body.ip ?? "",
      source: body.ip ? "ipify" : "unavailable",
      localAddresses: getLocalAddresses(),
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      publicIp: "",
      source: "unavailable",
      localAddresses: getLocalAddresses(),
      checkedAt: new Date().toISOString(),
    };
  }
}

async function getStoredFbrSettings(): Promise<StoredFbrSettings> {
  const cachedSettings = await getCachedFbrSettings();
  await seedEnvironmentTokensIfNeeded();
  const [sandboxToken, productionToken] = await Promise.all([
    getActiveEncryptedToken("sandbox"),
    getActiveEncryptedToken("production"),
  ]);

  return {
    ...cachedSettings,
    sandboxToken,
    productionToken,
  };
}

async function getCachedFbrSettings(): Promise<CachedFbrSettings> {
  const cached = await getCache().get(SETTINGS_CACHE_KEY);

  if (cached) {
    const parsed = JSON.parse(cached) as Partial<StoredFbrSettings>;
    return {
      environment: parseEnvironment(parsed.environment),
      useMock: parsed.useMock === undefined ? process.env.FBR_INVOICE_USE_MOCKS !== "false" : Boolean(parsed.useMock),
      updatedAt: stringValue(parsed.updatedAt) || new Date().toISOString(),
    };
  }

  const initial: CachedFbrSettings = {
    environment: parseEnvironment(process.env.FBR_ENVIRONMENT),
    useMock: process.env.FBR_INVOICE_USE_MOCKS !== "false",
    updatedAt: new Date().toISOString(),
  };

  await getCache().set(SETTINGS_CACHE_KEY, JSON.stringify(initial));
  return initial;
}

async function seedEnvironmentTokensIfNeeded(): Promise<void> {
  await Promise.all([
    seedEnvironmentTokenIfNeeded("sandbox", process.env.FBR_SANDBOX_TOKEN),
    seedEnvironmentTokenIfNeeded("production", process.env.FBR_PRODUCTION_TOKEN),
  ]);
}

async function seedEnvironmentTokenIfNeeded(environment: FbrEnvironment, rawToken: unknown): Promise<void> {
  const token = stringValue(rawToken);

  if (!token) {
    return;
  }

  const existing = await prisma.token.findFirst({
    where: {
      environment,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return;
  }

  await storeActiveToken(environment, token);
}

async function getActiveEncryptedToken(environment: FbrEnvironment): Promise<string | undefined> {
  const token = await prisma.token.findFirst({
    where: {
      environment,
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      token: true,
    },
  });

  return token?.token;
}

async function storeActiveToken(environment: FbrEnvironment, rawToken: string): Promise<void> {
  await prisma.$transaction([
    prisma.token.updateMany({
      where: {
        environment,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    }),
    prisma.token.create({
      data: {
        environment,
        token: encryptToken(rawToken),
        isActive: true,
      },
    }),
  ]);
}

async function deactivateTokens(environment: FbrEnvironment): Promise<void> {
  await prisma.token.updateMany({
    where: {
      environment,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptToken(encryptedToken: string | undefined): string {
  if (!encryptedToken) {
    return "";
  }

  const [version, ivRaw, authTagRaw, encryptedRaw] = encryptedToken.split(":");

  if (version !== "v1" || !ivRaw || !authTagRaw || !encryptedRaw) {
    return "";
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptionKey(): Buffer {
  const secret = process.env.FBR_SETTINGS_ENCRYPTION_KEY ?? process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("FBR_SETTINGS_ENCRYPTION_KEY or JWT_SECRET is required for FBR token storage.");
  }

  return createHash("sha256").update(secret).digest();
}

function maskToken(encryptedToken: string | undefined): MaskedToken {
  const token = decryptToken(encryptedToken);

  if (!token) {
    return {
      configured: false,
      masked: "",
    };
  }

  return {
    configured: true,
    masked: `****${token.slice(-4)}`,
  };
}

function parseEnvironment(value: unknown): FbrEnvironment {
  return stringValue(value).toLowerCase() === "production" ? "production" : "sandbox";
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getLocalAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}
