export function isDevDbFallbackEnabled() {
  if (process.env.DEV_DB_FALLBACK_DISABLED === "true") {
    return false;
  }

  return process.env.ALLOW_DEV_ADMIN_LOGIN === "true";
}

function fallbackTimeoutMs() {
  return Number(process.env.DEV_DB_FALLBACK_TIMEOUT_MS || 2500);
}

export async function withDevDbFallback<T>(
  label: string,
  operation: Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!isDevDbFallbackEnabled()) {
    return operation;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutToken = Symbol("dev-db-timeout");

  const guardedOperation = operation
    .then((value) => ({ ok: true as const, value }))
    .catch((error) => ({ ok: false as const, error }));

  const timeoutMs = fallbackTimeoutMs();
  const timeoutOperation = new Promise<typeof timeoutToken>((resolve) => {
    timeout = setTimeout(() => resolve(timeoutToken), timeoutMs);
  });

  const result = await Promise.race([guardedOperation, timeoutOperation]);
  if (timeout) clearTimeout(timeout);

  if (result === timeoutToken) {
    console.warn(`[dev-db-fallback] ${label} exceeded ${timeoutMs}ms; using local fallback data.`);
    return fallback();
  }

  if (!result.ok) {
    console.warn(`[dev-db-fallback] ${label} failed; using local fallback data.`, errorMessage(result.error));
    return fallback();
  }

  return result.value;
}

export function devIsoNow() {
  return new Date().toISOString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
