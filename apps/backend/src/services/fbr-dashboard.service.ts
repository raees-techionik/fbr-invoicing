import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

type ChartPeriod = "daily" | "monthly" | "quarterly" | "yearly";

interface InvoiceDashboardFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  invoiceType?: string;
  status?: string;
  claimed?: string;
  limit?: number;
  offset?: number;
}

interface CreateInvoiceRecordInput {
  invoiceType?: unknown;
  invoiceDate?: unknown;
  invoiceRefNo?: unknown;
  fbrInvoiceNumber?: unknown;
  buyerBusinessName?: unknown;
  buyerNTNCNIC?: unknown;
  amountPkr?: unknown;
  status?: unknown;
  claimed?: unknown;
  source?: unknown;
  payload?: unknown;
  response?: unknown;
}

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true } }>;

export async function createInvoiceRecord(companyId: string, raw: CreateInvoiceRecordInput) {
  const normalized = normalizeCreateInput(raw);
  const created = await prisma.invoice.create({
    data: {
      companyId,
      fbrInvoiceNumber: normalized.fbrInvoiceNumber,
      invoiceType: normalized.invoiceType,
      invoiceDate: normalized.invoiceDate,
      invoiceRefNo: normalized.invoiceRefNo,
      sellerNTNCNIC: "",
      sellerBusinessName: "",
      sellerProvince: "",
      sellerAddress: "",
      buyerNTNCNIC: normalized.buyerNTNCNIC,
      buyerBusinessName: normalized.buyerBusinessName,
      buyerProvince: "",
      buyerAddress: "",
      buyerRegistrationType: "",
      status: normalized.status,
      fbrRawResponse: {
        dashboardSource: normalized.source,
        dashboardClaimed: normalized.claimed,
        response: normalized.response ?? null,
        legacyPayload: normalized.payload,
        legacyAmountPkr: normalized.amountPkr,
      } as Prisma.InputJsonValue,
    },
    include: {
      items: true,
    },
  });

  return toDashboardInvoiceDto(created);
}

export async function listInvoiceRecords(companyId: string, filters: InvoiceDashboardFilters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 250);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const where = prismaWhere(companyId, filters);
  const [total, records] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    data: records.map((record) => toDashboardInvoiceDto(record)),
    pagination: {
      total,
      limit,
      offset,
    },
  };
}

export async function getInvoiceRecord(companyId: string, id: string) {
  const record = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      items: true,
    },
  });

  if (!record) {
    throw httpError(404, "Invoice not found.");
  }

  return toDashboardInvoiceDto(record, true);
}

export async function getInvoiceSummary(companyId: string, filters: InvoiceDashboardFilters = {}) {
  const records = await getFilteredRecords(companyId, filters);
  const saleInvoices = records.filter((record) => normalizeInvoiceType(record.invoiceType) === "sale").length;
  const debitNotes = records.filter((record) => normalizeInvoiceType(record.invoiceType) === "debit").length;
  const totalAmountPkr = records.reduce((sum, record) => sum + calculateInvoiceAmount(record), 0);
  const submitted = records.filter((record) => record.status === "SUBMITTED").length;
  const failed = records.filter((record) => record.status === "FAILED").length;

  return {
    totalInvoices: records.length,
    totalSaleInvoices: saleInvoices,
    totalDebitNotes: debitNotes,
    totalAmountPkr: roundAmount(totalAmountPkr),
    submitted,
    failed,
    claimed: records.filter((record) => dashboardClaimed(record)).length,
    unclaimed: records.filter((record) => !dashboardClaimed(record)).length,
  };
}

export async function getInvoiceChartData(companyId: string, filters: InvoiceDashboardFilters & { period?: string } = {}) {
  const period = parsePeriod(filters.period);
  const records = await getFilteredRecords(companyId, filters);
  const buckets = new Map<string, { invoiceCount: number; totalAmountPkr: number }>();

  for (const record of records) {
    const bucketKey = chartBucketKey(record.invoiceDate, period);
    const current = buckets.get(bucketKey) ?? { invoiceCount: 0, totalAmountPkr: 0 };
    current.invoiceCount += 1;
    current.totalAmountPkr += calculateInvoiceAmount(record);
    buckets.set(bucketKey, current);
  }

  return {
    period,
    data: Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, value]) => ({
        bucket,
        invoiceCount: value.invoiceCount,
        totalAmountPkr: roundAmount(value.totalAmountPkr),
      })),
  };
}

export async function deleteInvoiceRecord(companyId: string, id: string): Promise<void> {
  try {
    await prisma.invoice.delete({ where: { id, companyId } });
  } catch {
    throw httpError(404, "Invoice not found.");
  }
}

export async function updateInvoiceClaimStatus(companyId: string, id: string, claimed: unknown) {
  const existing = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      items: true,
    },
  });

  if (!existing) {
    throw httpError(404, "Invoice not found.");
  }

  const raw = objectValue(existing.fbrRawResponse);
  const updated = await prisma.invoice.update({
    where: { id, companyId },
    data: {
      fbrRawResponse: {
        ...raw,
        dashboardClaimed: booleanValue(claimed, false),
      } as Prisma.InputJsonValue,
    },
    include: {
      items: true,
    },
  });

  return toDashboardInvoiceDto(updated);
}

export async function seedMockInvoiceRecords(companyId: string) {
  const existing = await listInvoiceRecords(companyId, { limit: 1 });

  if (existing.pagination.total > 0) {
    return {
      created: 0,
      skipped: true,
      message: "Invoice dashboard already has records.",
    };
  }

  const today = new Date();
  const samples = [
    mockRecordInput("Sale Invoice", daysAgo(today, 0), "Demo Buyer A", 125000, "SUBMITTED", "000001010526120000-0001"),
    mockRecordInput("Sale Invoice", daysAgo(today, 1), "Demo Buyer B", 76000, "SUBMITTED", "000001300426150000-0001"),
    mockRecordInput("Debit Note", daysAgo(today, 6), "Demo Buyer A", 22000, "SUBMITTED", "000001250426110000-0001"),
    mockRecordInput("Sale Invoice", daysAgo(today, 35), "Demo Buyer C", 310000, "FAILED", ""),
  ];

  for (const sample of samples) {
    await createInvoiceRecord(companyId, sample);
  }

  return {
    created: samples.length,
    skipped: false,
    message: "Mock invoice dashboard records created.",
  };
}

function normalizeCreateInput(raw: CreateInvoiceRecordInput) {
  const invoiceDate = parseDate(raw.invoiceDate) ?? new Date();

  return {
    invoiceType: stringValue(raw.invoiceType, "Sale Invoice"),
    invoiceDate,
    invoiceRefNo: optionalString(raw.invoiceRefNo),
    fbrInvoiceNumber: optionalString(raw.fbrInvoiceNumber),
    buyerBusinessName: stringValue(raw.buyerBusinessName, "Unknown Buyer"),
    buyerNTNCNIC: optionalString(raw.buyerNTNCNIC),
    amountPkr: numberValue(raw.amountPkr),
    status: stringValue(raw.status, "DRAFT").toUpperCase(),
    claimed: booleanValue(raw.claimed, false),
    source: stringValue(raw.source, "manual"),
    payload: raw.payload ?? raw,
    response: raw.response,
  };
}

async function getFilteredRecords(companyId: string, filters: InvoiceDashboardFilters): Promise<InvoiceWithItems[]> {
  return prisma.invoice.findMany({
    where: prismaWhere(companyId, filters),
    include: {
      items: true,
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
  });
}

function prismaWhere(companyId: string, filters: InvoiceDashboardFilters): Prisma.InvoiceWhereInput {
  const search = stringValue(filters.search);
  const dateFrom = parseDate(filters.dateFrom);
  const dateTo = parseEndDate(filters.dateTo);
  const invoiceType = stringValue(filters.invoiceType);
  const status = stringValue(filters.status).toUpperCase();
  const claimed = parseOptionalBoolean(filters.claimed);

  return {
    companyId,
    ...(invoiceType ? { invoiceType } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          invoiceDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { fbrInvoiceNumber: { contains: search, mode: "insensitive" } },
            { buyerBusinessName: { contains: search, mode: "insensitive" } },
            { buyerNTNCNIC: { contains: search, mode: "insensitive" } },
            { invoiceRefNo: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(claimed !== undefined
      ? {
          fbrRawResponse: {
            path: ["dashboardClaimed"],
            equals: claimed,
          },
        }
      : {}),
  };
}

function toDashboardInvoiceDto(record: InvoiceWithItems, includeItems = false) {
  const dto = {
    id: record.id,
    invoiceType: record.invoiceType,
    invoiceDate: record.invoiceDate.toISOString().slice(0, 10),
    invoiceRefNo: record.invoiceRefNo ?? "",
    fbrInvoiceNumber: record.fbrInvoiceNumber ?? "",
    buyerBusinessName: record.buyerBusinessName,
    buyerNTNCNIC: record.buyerNTNCNIC ?? "",
    amountPkr: calculateInvoiceAmount(record),
    status: record.status,
    claimed: dashboardClaimed(record),
    source: dashboardSource(record),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };

  return {
    ...dto,
    invoice_type: dto.invoiceType,
    invoice_date: dto.invoiceDate,
    invoice_ref_no: dto.invoiceRefNo,
    fbr_invoice_number: dto.fbrInvoiceNumber,
    buyer_business_name: dto.buyerBusinessName,
    buyer_ntn_cnic: dto.buyerNTNCNIC,
    amount_pkr: dto.amountPkr,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    ...(includeItems
      ? {
          seller_ntn_cnic: record.sellerNTNCNIC,
          seller_business_name: record.sellerBusinessName,
          seller_province: record.sellerProvince,
          seller_address: record.sellerAddress,
          buyer_province: record.buyerProvince,
          buyer_address: record.buyerAddress,
          buyer_registration_type: record.buyerRegistrationType,
          is_offline: record.isOffline,
          submitted_at: record.submittedAt?.toISOString() ?? "",
          fbr_raw_response: record.fbrRawResponse,
          items: record.items.map(toInvoiceItemDto),
        }
      : {}),
  };
}

function toInvoiceItemDto(item: InvoiceWithItems["items"][number]) {
  return {
    id: item.id,
    fbrItemInvoiceNo: item.fbrItemInvoiceNo ?? "",
    fbr_item_invoice_no: item.fbrItemInvoiceNo ?? "",
    hsCode: item.hsCode,
    hs_code: item.hsCode,
    productDescription: item.productDescription,
    product_description: item.productDescription,
    rate: item.rate,
    uom: item.uom,
    quantity: item.quantity,
    totalValues: item.totalValues,
    total_values: item.totalValues,
    valueSalesExcludingST: item.valueSalesExcludingST,
    value_sales_excluding_st: item.valueSalesExcludingST,
    fixedNotifiedValueOrRetailPrice: item.fixedNotifiedValueOrRetailPrice,
    fixed_notified_value_or_retail_price: item.fixedNotifiedValueOrRetailPrice,
    salesTaxApplicable: item.salesTaxApplicable,
    sales_tax_applicable: item.salesTaxApplicable,
    salesTaxWithheldAtSource: item.salesTaxWithheldAtSource,
    sales_tax_withheld_at_source: item.salesTaxWithheldAtSource,
    extraTax: item.extraTax ?? 0,
    extra_tax: item.extraTax ?? 0,
    furtherTax: item.furtherTax ?? 0,
    further_tax: item.furtherTax ?? 0,
    sroScheduleNo: item.sroScheduleNo ?? "",
    sro_schedule_no: item.sroScheduleNo ?? "",
    fedPayable: item.fedPayable ?? 0,
    fed_payable: item.fedPayable ?? 0,
    discount: item.discount ?? 0,
    saleType: item.saleType,
    sale_type: item.saleType,
    sroItemSerialNo: item.sroItemSerialNo ?? "",
    sro_item_serial_no: item.sroItemSerialNo ?? "",
  };
}

function calculateInvoiceAmount(record: InvoiceWithItems): number {
  const legacyAmount = numberValue(objectValue(record.fbrRawResponse).legacyAmountPkr);
  if (legacyAmount) {
    return roundAmount(legacyAmount);
  }

  return roundAmount(
    record.items.reduce((sum, item) => {
      if (item.totalValues) {
        return sum + item.totalValues;
      }

      return (
        sum +
        item.valueSalesExcludingST +
        item.salesTaxApplicable +
        (item.furtherTax ?? 0) +
        (item.extraTax ?? 0) +
        (item.fedPayable ?? 0) -
        (item.discount ?? 0)
      );
    }, 0),
  );
}

function dashboardClaimed(record: { fbrRawResponse: Prisma.JsonValue | null }): boolean {
  return booleanValue(objectValue(record.fbrRawResponse).dashboardClaimed, false);
}

function dashboardSource(record: { isOffline: boolean; fbrRawResponse: Prisma.JsonValue | null }): string {
  const raw = objectValue(record.fbrRawResponse);
  return stringValue(raw.dashboardSource, record.isOffline ? "offline" : "fbr");
}

function objectValue(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function mockRecordInput(
  invoiceType: string,
  invoiceDate: Date,
  buyerBusinessName: string,
  amountPkr: number,
  status: string,
  fbrInvoiceNumber: string,
) {
  return {
    invoiceType,
    invoiceDate: invoiceDate.toISOString().slice(0, 10),
    fbrInvoiceNumber,
    buyerBusinessName,
    buyerNTNCNIC: "0000000000000",
    amountPkr,
    status,
    claimed: false,
    source: "mock",
    payload: { invoiceType, invoiceDate, buyerBusinessName, amountPkr },
    response: { statusCode: status === "SUBMITTED" ? "00" : "01" },
  };
}

function chartBucketKey(date: Date, period: ChartPeriod): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (period === "daily") return `${year}-${month}-${day}`;
  if (period === "monthly") return `${year}-${month}`;
  if (period === "quarterly") return `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  return String(year);
}

function parsePeriod(value: unknown): ChartPeriod {
  const text = stringValue(value).toLowerCase();
  if (text === "monthly" || text === "quarterly" || text === "yearly") return text;
  return "daily";
}

function normalizeInvoiceType(invoiceType: string): "sale" | "debit" | "other" {
  const normalized = invoiceType.toLowerCase();
  if (normalized.includes("debit")) return "debit";
  if (normalized.includes("sale")) return "sale";
  return "other";
}

function parseDate(value: unknown): Date | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseEndDate(value: unknown): Date | undefined {
  const date = parseDate(value);
  if (!date) return undefined;
  date.setHours(23, 59, 59, 999);
  return date;
}

function daysAgo(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function roundAmount(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "y"].includes(value.toLowerCase());
  return fallback;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  const text = stringValue(value).toLowerCase();
  if (!text) return undefined;
  if (["true", "1", "yes", "y"].includes(text)) return true;
  if (["false", "0", "no", "n"].includes(text)) return false;
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  const text = stringValue(value);
  return text || undefined;
}

function stringValue(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
