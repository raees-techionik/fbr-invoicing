import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  formatInvoiceForFbr,
  submitInvoiceToFbr,
  type FbrInvoiceInput,
  type FbrInvoicePayload,
  type FbrInvoiceSettings,
} from "./fbr-invoice.service.js";
import { getRuntimeFbrSettings } from "./fbr-settings.service.js";
import { withDevDbFallback } from "./dev-db-fallback.js";

type OfflineQueueStatus = "PENDING" | "UPLOADED" | "FAILED";

interface QueueInvoiceInput {
  invoice?: FbrInvoiceInput;
  invoicePayload?: FbrInvoiceInput;
  settings?: FbrInvoiceSettings;
}

interface ListQueueFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

interface ProcessQueueOptions {
  retryFailed?: unknown;
  limit?: unknown;
  settings?: FbrInvoiceSettings;
}

const WARNING_AFTER_HOURS = 20;
const LEGAL_UPLOAD_HOURS = 24;
const MAX_RETRY_COUNT = 3;
const AUTO_PROCESS_INTERVAL_MS = 2 * 60 * 1000;

let autoProcessorTimer: ReturnType<typeof setInterval> | null = null;
let autoProcessorRunning = false;

type DevOfflineQueueRecord = {
  id: string;
  invoiceId: string;
  invoicePayload: FbrInvoicePayload;
  status: OfflineQueueStatus;
  queuedAt: Date;
  uploadedAt: Date | null;
  retryCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoice?: {
    fbrInvoiceNumber?: string | null;
    submittedAt?: Date | null;
  };
};

let devOfflineQueue: DevOfflineQueueRecord[] = [];

export async function enqueueOfflineInvoice(raw: QueueInvoiceInput | FbrInvoiceInput) {
  const invoice = extractInvoice(raw);
  const settings = extractSettings(raw);
  const payload = formatInvoiceForFbr(invoice, parseEnvironment(settings?.environment));
  const now = new Date();

  const created = await withDevDbFallback(
    "offlineQueue.enqueue",
    prisma.invoice.create({
      data: {
        invoiceType: payload.invoiceType,
        invoiceDate: parseDate(payload.invoiceDate),
        invoiceRefNo: optionalString(payload.invoiceRefNo),
        sellerNTNCNIC: payload.sellerNTNCNIC,
        sellerBusinessName: payload.sellerBusinessName,
        sellerProvince: payload.sellerProvince,
        sellerAddress: payload.sellerAddress,
        buyerNTNCNIC: optionalString(payload.buyerNTNCNIC),
        buyerBusinessName: payload.buyerBusinessName,
        buyerProvince: payload.buyerProvince,
        buyerAddress: payload.buyerAddress,
        buyerRegistrationType: payload.buyerRegistrationType,
        status: "OFFLINE",
        isOffline: true,
        offlineQueuedAt: now,
        items: {
          create: payload.items.map(toInvoiceItemCreate),
        },
        offlineQueue: {
          create: {
            invoicePayload: payload as unknown as Prisma.InputJsonValue,
            status: "PENDING",
            queuedAt: now,
          },
        },
      },
      include: {
        offlineQueue: true,
      },
    }),
    () => null,
  );

  if (!created) {
    const record: DevOfflineQueueRecord = {
      id: `dev-queue-${randomUUID()}`,
      invoiceId: `dev-invoice-${randomUUID()}`,
      invoicePayload: payload,
      status: "PENDING",
      queuedAt: now,
      uploadedAt: null,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    devOfflineQueue = [record, ...devOfflineQueue];
    return toFallbackQueueDto(record);
  }

  const [queueRecord] = created.offlineQueue;
  return toQueueDto({
    ...queueRecord,
    invoice: created,
    invoicePayload: payload,
  });
}

export async function listOfflineQueue(filters: ListQueueFilters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 250);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const status = parseStatus(filters.status);
  const where = status ? { status } : {};
  const result = await withDevDbFallback(
    "offlineQueue.list",
    Promise.all([
      prisma.offlineQueue.count({ where }),
      prisma.offlineQueue.findMany({
        where,
        include: {
          invoice: true,
        },
        orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
        take: limit,
        skip: offset,
      }),
    ]),
    () => null,
  );

  if (!result) {
    const filtered = status ? devOfflineQueue.filter((record) => record.status === status) : devOfflineQueue;
    const records = filtered.slice(offset, offset + limit);
    return {
      data: records.map(toFallbackQueueDto),
      pagination: {
        total: filtered.length,
        limit,
        offset,
      },
    };
  }

  const [total, records] = result;

  return {
    data: records.map(toQueueDto),
    pagination: {
      total,
      limit,
      offset,
    },
  };
}

export async function getOfflineQueueSummary() {
  const records = await withDevDbFallback(
    "offlineQueue.summary",
    prisma.offlineQueue.findMany({
      include: {
        invoice: true,
      },
    }),
    () => null,
  );
  if (!records) {
    return offlineQueueSummary(devOfflineQueue);
  }
  
  const pending = records.filter((record) => record.status === "PENDING").length;
  const uploaded = records.filter((record) => record.status === "UPLOADED").length;
  const failed = records.filter((record) => record.status === "FAILED").length;

  return {
    total: records.length,
    pending,
    uploaded,
    failed,
    offline: pending,
    submitted: uploaded,
    uploadFailed: failed,
    upload_failed: failed,
    warningCount: records.filter((record) => queueTiming(record).isUploadDeadlineWarning).length,
    expiredCount: records.filter((record) => queueTiming(record).isUploadDeadlineExpired).length,
  };
}

export async function processOfflineQueue(options: ProcessQueueOptions = {}) {
  const retryFailed = parseBoolean(options.retryFailed, false);
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
  const records = await withDevDbFallback(
    "offlineQueue.process.findMany",
    prisma.offlineQueue.findMany({
      where: {
        status: retryFailed ? { in: ["PENDING", "FAILED"] } : "PENDING",
        retryCount: retryFailed ? undefined : { lt: MAX_RETRY_COUNT },
      },
      include: {
        invoice: true,
      },
      orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    }),
    () => null,
  );
  if (!records) {
    const candidates = devOfflineQueue
      .filter((record) => retryFailed ? ["PENDING", "FAILED"].includes(record.status) : record.status === "PENDING")
      .slice(0, limit);
    return {
      processed: candidates.length,
      uploaded: 0,
      failed: 0,
      submitted: 0,
      results: candidates.map(toFallbackQueueDto),
    };
  }
  const results = [];

  for (const record of records) {
    results.push(await processQueueRecord(record, options.settings));
  }

  return {
    processed: results.length,
    uploaded: results.filter((result) => result.status === "UPLOADED").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    submitted: results.filter((result) => result.status === "UPLOADED").length,
    results,
  };
}

export function startAutomaticOfflineQueueProcessor() {
  if (parseBoolean(process.env.OFFLINE_QUEUE_AUTO_PROCESS_DISABLED, false)) {
    console.log("[offline-queue] automatic processor disabled.");
    return;
  }

  if (autoProcessorTimer) {
    return;
  }

  const limit = Math.min(Math.max(Number(process.env.OFFLINE_QUEUE_PROCESS_LIMIT) || 25, 1), 100);
  const run = async () => {
    if (autoProcessorRunning) {
      return;
    }

    autoProcessorRunning = true;
    try {
      const settings = await getRuntimeFbrSettings();

      if (!settings.useMock && !settings.activeToken) {
        console.warn("[offline-queue] automatic processor skipped: active FBR token is missing.");
        return;
      }

      const result = await processOfflineQueue({
        limit,
        settings: {
          environment: settings.environment,
          token: settings.activeToken,
          useMock: settings.useMock,
        },
      });

      if (result.processed > 0) {
        console.log("[offline-queue] automatic processor completed", {
          processed: result.processed,
          uploaded: result.uploaded,
          failed: result.failed,
        });
      }
    } catch (error) {
      console.warn("[offline-queue] automatic processor failed", errorMessage(error));
    } finally {
      autoProcessorRunning = false;
    }
  };

  autoProcessorTimer = setInterval(run, AUTO_PROCESS_INTERVAL_MS);
  void run();
  console.log("[offline-queue] automatic processor started: every 2 minutes.");
}

export async function retryOfflineQueueItem(id: string, settings?: FbrInvoiceSettings) {
  const record = await withDevDbFallback(
    "offlineQueue.retry.findUnique",
    getQueueRecord(id),
    () => null,
  );

  if (!record) {
    const devRecord = devOfflineQueue.find((item) => item.id === id);
    if (!devRecord) {
      throw httpError(404, "Offline queue invoice not found.");
    }
    return toFallbackQueueDto(devRecord);
  }

  if (record.status === "UPLOADED") {
    throw httpError(409, "Invoice is already uploaded.");
  }

  return processQueueRecord(record, settings);
}

async function processQueueRecord(
  record: Awaited<ReturnType<typeof getQueueRecord>>,
  overrideSettings?: FbrInvoiceSettings,
) {
  const retryCount = record.retryCount + 1;
  const payload = record.invoicePayload as unknown as FbrInvoicePayload;

  try {
    const result = await submitInvoiceToFbr(payloadToInvoiceInput(payload), overrideSettings ?? {});

    if (!result.isValid) {
      return toQueueDto(await markQueueFailed(record.id, retryCount, result.message));
    }

    const uploadedAt = new Date();
    const updated = await prisma.offlineQueue.update({
      where: { id: record.id },
      data: {
        status: "UPLOADED",
        uploadedAt,
        retryCount,
        lastError: null,
        invoice: {
          update: {
            fbrInvoiceNumber: optionalString(result.invoiceNumber),
            status: "SUBMITTED",
            submittedAt: uploadedAt,
            fbrRawResponse: result.raw as Prisma.InputJsonValue,
            items: {
              updateMany: result.itemResponses.map((itemResponse) => ({
                where: {
                  invoiceId: record.invoiceId,
                  hsCode: stringValue(payload.items[itemResponse.index]?.hsCode),
                },
                data: {
                  fbrItemInvoiceNo: optionalString(itemResponse.fbrInvoiceNumber),
                },
              })),
            },
          },
        },
      },
      include: {
        invoice: true,
      },
    });

    return toQueueDto(updated);
  } catch (error) {
    return toQueueDto(await markQueueFailed(record.id, retryCount, errorMessage(error)));
  }
}

async function markQueueFailed(id: string, retryCount: number, lastError: string) {
  const terminalFailure = retryCount >= MAX_RETRY_COUNT;

  return prisma.offlineQueue.update({
    where: { id },
    data: {
      status: terminalFailure ? "FAILED" : "PENDING",
      retryCount,
      lastError,
      invoice: {
        update: {
          status: terminalFailure ? "FAILED" : "OFFLINE",
        },
      },
    },
    include: {
      invoice: true,
    },
  });
}

async function getQueueRecord(id: string) {
  const record = await prisma.offlineQueue.findUnique({
    where: { id },
    include: {
      invoice: true,
    },
  });

  if (!record) {
    throw httpError(404, "Offline queue invoice not found.");
  }

  return record;
}

function toInvoiceItemCreate(item: FbrInvoicePayload["items"][number]): Prisma.InvoiceItemCreateWithoutInvoiceInput {
  return {
    hsCode: stringValue(item.hsCode),
    productDescription: stringValue(item.productDescription),
    rate: stringValue(item.rate),
    uom: stringValue(item.uoM),
    quantity: numberValue(item.quantity),
    totalValues: numberValue(item.totalValues),
    valueSalesExcludingST: numberValue(item.valueSalesExcludingST),
    fixedNotifiedValueOrRetailPrice: numberValue(item.fixedNotifiedValueOrRetailPrice),
    salesTaxApplicable: numberValue(item.salesTaxApplicable),
    salesTaxWithheldAtSource: numberValue(item.salesTaxWithheldAtSource),
    extraTax: optionalNumber(item.extraTax),
    furtherTax: optionalNumber(item.furtherTax),
    sroScheduleNo: optionalString(item.sroScheduleNo),
    fedPayable: optionalNumber(item.fedPayable),
    discount: optionalNumber(item.discount),
    saleType: stringValue(item.saleType),
    sroItemSerialNo: optionalString(item.sroItemSerialNo),
  };
}

function toQueueDto(record: {
  id: string;
  invoiceId: string;
  invoicePayload: unknown;
  status: string;
  queuedAt: Date;
  uploadedAt: Date | null;
  retryCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoice?: {
    fbrInvoiceNumber?: string | null;
    submittedAt?: Date | null;
  };
}) {
  const timing = queueTiming(record);
  const uploaded = record.uploadedAt ?? record.invoice?.submittedAt ?? null;

  return {
    id: record.id,
    invoiceId: record.invoiceId,
    invoice: record.invoicePayload,
    status: record.status,
    queuedAt: record.queuedAt.toISOString(),
    uploadedAt: uploaded ? uploaded.toISOString() : "",
    submittedAt: uploaded ? uploaded.toISOString() : "",
    lastAttemptAt: record.retryCount > 0 ? record.updatedAt.toISOString() : "",
    retryCount: record.retryCount,
    attemptCount: record.retryCount,
    fbrInvoiceNumber: record.invoice?.fbrInvoiceNumber ?? "",
    errorMessage: record.lastError ?? "",
    lastError: record.lastError ?? "",
    uploadDeadlineAt: timing.uploadDeadlineAt.toISOString(),
    warningAt: timing.warningAt.toISOString(),
    hoursQueued: timing.hoursQueued,
    isUploadDeadlineWarning: timing.isUploadDeadlineWarning,
    isUploadDeadlineExpired: timing.isUploadDeadlineExpired,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toFallbackQueueDto(record: DevOfflineQueueRecord) {
  const timing = queueTiming(record);
  const uploaded = record.uploadedAt ?? record.invoice?.submittedAt ?? null;

  return {
    id: record.id,
    invoiceId: record.invoiceId,
    invoice: record.invoicePayload,
    status: record.status,
    queuedAt: record.queuedAt.toISOString(),
    uploadedAt: uploaded ? uploaded.toISOString() : "",
    submittedAt: uploaded ? uploaded.toISOString() : "",
    lastAttemptAt: record.retryCount > 0 ? record.updatedAt.toISOString() : "",
    retryCount: record.retryCount,
    attemptCount: record.retryCount,
    fbrInvoiceNumber: record.invoice?.fbrInvoiceNumber ?? "",
    errorMessage: record.lastError ?? "",
    lastError: record.lastError ?? "",
    uploadDeadlineAt: timing.uploadDeadlineAt.toISOString(),
    warningAt: timing.warningAt.toISOString(),
    hoursQueued: timing.hoursQueued,
    isUploadDeadlineWarning: timing.isUploadDeadlineWarning,
    isUploadDeadlineExpired: timing.isUploadDeadlineExpired,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function offlineQueueSummary(records: DevOfflineQueueRecord[]) {
  const pending = records.filter((record) => record.status === "PENDING").length;
  const uploaded = records.filter((record) => record.status === "UPLOADED").length;
  const failed = records.filter((record) => record.status === "FAILED").length;

  return {
    total: records.length,
    pending,
    uploaded,
    failed,
    offline: pending,
    submitted: uploaded,
    uploadFailed: failed,
    upload_failed: failed,
    warningCount: records.filter((record) => queueTiming(record).isUploadDeadlineWarning).length,
    expiredCount: records.filter((record) => queueTiming(record).isUploadDeadlineExpired).length,
  };
}

function queueTiming(record: { status: string; queuedAt: Date }) {
  const warningAt = addHours(record.queuedAt, WARNING_AFTER_HOURS);
  const uploadDeadlineAt = addHours(record.queuedAt, LEGAL_UPLOAD_HOURS);
  const now = new Date();
  const active = record.status !== "UPLOADED";

  return {
    warningAt,
    uploadDeadlineAt,
    hoursQueued: Math.round(((now.getTime() - record.queuedAt.getTime()) / (60 * 60 * 1000)) * 100) / 100,
    isUploadDeadlineWarning: active && now >= warningAt,
    isUploadDeadlineExpired: active && now >= uploadDeadlineAt,
  };
}

function extractInvoice(raw: QueueInvoiceInput | FbrInvoiceInput): FbrInvoiceInput {
  const candidate =
    raw && typeof raw === "object" && "invoice" in raw
      ? (raw as QueueInvoiceInput).invoice
      : raw && typeof raw === "object" && "invoicePayload" in raw
        ? (raw as QueueInvoiceInput).invoicePayload
        : raw;

  if (!candidate || typeof candidate !== "object") {
    throw httpError(400, "invoice is required.");
  }

  return candidate as FbrInvoiceInput;
}

function extractSettings(raw: QueueInvoiceInput | FbrInvoiceInput): FbrInvoiceSettings | null {
  if (raw && typeof raw === "object" && "settings" in raw) {
    return (raw as QueueInvoiceInput).settings ?? null;
  }

  return null;
}

function payloadToInvoiceInput(payload: FbrInvoicePayload): FbrInvoiceInput {
  return {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      uoM: item.uoM,
    })),
  };
}

function parseStatus(value: unknown): OfflineQueueStatus | undefined {
  const status = String(value ?? "").trim().toUpperCase();
  if (status === "PENDING" || status === "OFFLINE") return "PENDING";
  if (status === "UPLOADED" || status === "SUBMITTED") return "UPLOADED";
  if (status === "FAILED" || status === "UPLOAD_FAILED") return "FAILED";
  return undefined;
}

function parseEnvironment(value: unknown): "sandbox" | "production" {
  return String(value ?? "").trim().toLowerCase() === "production" ? "production" : "sandbox";
}

function parseDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "y"].includes(value.toLowerCase());
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  const text = stringValue(value);
  return text || undefined;
}

function optionalNumber(value: unknown): number | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberValue(value: unknown): number {
  const parsed = Number(stringValue(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Offline invoice upload failed.";
}

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
