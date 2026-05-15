import { randomUUID } from "node:crypto";
import { getCache } from "../lib/cache.js";

const CACHE_KEY = "app:services";

interface ServiceRecord {
  id: string;
  service_name: string;
  rate: string;
  unit_of_measure: string;
  sales_tax: string;
  description: string;
  created_at: string;
  updated_at: string;
}

function httpError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

async function readAll(): Promise<ServiceRecord[]> {
  const cached = await getCache().get(CACHE_KEY);
  if (!cached) return [];
  return JSON.parse(cached) as ServiceRecord[];
}

async function writeAll(records: ServiceRecord[]): Promise<void> {
  await getCache().set(CACHE_KEY, JSON.stringify(records));
}

export async function listServices(params: { search?: string; limit?: number } = {}) {
  const search = params.search?.trim().toLowerCase() || "";
  const take = Math.min(Math.max(Number(params.limit) || 100, 1), 250);
  const records = await readAll();

  const filtered = search
    ? records.filter((r) =>
        [r.service_name, r.description, r.unit_of_measure]
          .some((v) => v?.toLowerCase().includes(search)),
      )
    : records;

  return filtered.slice(0, take);
}

export async function getService(id: string) {
  const records = await readAll();
  const record = records.find((r) => r.id === id);
  if (!record) throw httpError(404, "Service not found.");
  return record;
}

export async function createService(body: Record<string, unknown>) {
  const now = new Date().toISOString();
  const record: ServiceRecord = {
    id: randomUUID(),
    service_name: String(body.service_name || ""),
    rate: String(body.rate || ""),
    unit_of_measure: String(body.unit_of_measure || ""),
    sales_tax: String(body.sales_tax || ""),
    description: String(body.description || ""),
    created_at: now,
    updated_at: now,
  };
  const records = await readAll();
  await writeAll([...records, record]);
  return record;
}

export async function updateService(id: string, body: Record<string, unknown>) {
  const records = await readAll();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw httpError(404, "Service not found.");

  const existing = records[idx];
  const updated: ServiceRecord = {
    ...existing,
    service_name: String(body.service_name ?? existing.service_name),
    rate: String(body.rate ?? existing.rate),
    unit_of_measure: String(body.unit_of_measure ?? existing.unit_of_measure),
    sales_tax: String(body.sales_tax ?? existing.sales_tax),
    description: String(body.description ?? existing.description),
    updated_at: new Date().toISOString(),
  };
  records[idx] = updated;
  await writeAll(records);
  return updated;
}

export async function deleteService(id: string) {
  const records = await readAll();
  const next = records.filter((r) => r.id !== id);
  if (next.length === records.length) throw httpError(404, "Service not found.");
  await writeAll(next);
  return { id, deleted: true };
}
