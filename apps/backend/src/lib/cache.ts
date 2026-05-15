import { Redis } from "ioredis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Optional Redis (SOW: sessions / queues). If REDIS_URL is unset, uses a JSON file under .data/ (easy local dev without Redis).
 */
export interface AppCache {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class FileCache implements AppCache {
  private readonly path: string;
  private memory = new Map<string, { value: string; expiresAt?: number }>();
  private loaded = false;
  private writeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(filePath: string) {
    this.path = filePath;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.path, "utf8");
      const data = JSON.parse(raw) as Record<string, { value: string; expiresAt?: number }>;
      this.memory = new Map(Object.entries(data));
    } catch {
      this.memory = new Map();
    }
    this.loaded = true;
  }

  private schedulePersist(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      void this.persist();
    }, 100);
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const obj = Object.fromEntries(this.memory);
    await writeFile(this.path, JSON.stringify(obj), "utf8");
  }

  async get(key: string): Promise<string | undefined> {
    await this.ensureLoaded();
    const row = this.memory.get(key);
    if (!row) return undefined;
    if (row.expiresAt && Date.now() > row.expiresAt) {
      this.memory.delete(key);
      this.schedulePersist();
      return undefined;
    }
    return row.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.ensureLoaded();
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memory.set(key, { value, expiresAt });
    this.schedulePersist();
  }

  async del(key: string): Promise<void> {
    await this.ensureLoaded();
    this.memory.delete(key);
    this.schedulePersist();
  }
}

class RedisCache implements AppCache {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | undefined> {
    const v = await this.redis.get(key);
    return v ?? undefined;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.redis.setex(key, ttlSeconds, value);
    else await this.redis.set(key, value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

let _cache: AppCache | undefined;

export function getCache(): AppCache {
  if (_cache) return _cache;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
    _cache = new RedisCache(redis);
    return _cache;
  }
  const file = process.env.CACHE_FILE_PATH ?? join(process.cwd(), ".data", "cache.json");
  _cache = new FileCache(file);
  return _cache;
}
