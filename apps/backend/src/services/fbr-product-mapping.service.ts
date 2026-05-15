import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  getHsUoms,
  getItemDescriptions,
  getSaleTypeRates,
  getTransactionTypes,
} from "./fbr-reference.service.js";

type RawRecord = Record<string, unknown>;

interface ProductMappingRecord {
  id: string;
  productName: string;
  hsCode: string;
  hsDescription: string;
  salesTaxRate: number;
  unitOfMeasurement: string;
  inStock?: string;
  sroScheduleNo?: string | null;
  saleType: string;
  furtherTaxApplicable: boolean;
  extraTaxApplicable: boolean;
  fedApplicable: boolean;
  isActive: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ListProductMappingsParams {
  search?: string;
  status?: string;
  limit?: number;
}

interface ResolveHsFieldsParams {
  hsCode: string;
  saleType?: string;
  invoiceDate?: string;
  originationSupplier?: string;
  annexureId?: string;
}

const productMappingInputSchema = z.object({}).passthrough();

export async function listProductMappings(params: ListProductMappingsParams = {}) {
  const search = stringValue(params.search);
  const status = stringValue(params.status);
  const take = Math.min(Math.max(Number(params.limit) || 100, 1), 250);
  const isActive = parseStatusFilter(status);

  const records = await prisma.product.findMany({
    where: {
      ...(isActive === undefined ? {} : { isActive }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { hsCode: { contains: search, mode: "insensitive" } },
              { hsDescription: { contains: search, mode: "insensitive" } },
              { defaultSaleType: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    take,
  });

  return records.map((record) => toProductMappingDto(fromProductRecord(record)));
}

export async function getProductMapping(id: string) {
  const record = await prisma.product.findUnique({ where: { id } });

  if (!record) {
    throw httpError(404, "Product not found.");
  }

  return toProductMappingDto(fromProductRecord(record));
}

export async function getProductAutofill(id: string) {
  const product = await getProductMapping(id);

  return {
    id: product.id,
    productId: product.id,
    productName: product.productName,
    hsCode: product.hsCode,
    hsDescription: product.hsDescription,
    productDescription: product.hsDescription,
    rate: String(product.salesTaxRate),
    salesTaxRate: product.salesTaxRate,
    uoM: product.unitOfMeasurement,
    unitOfMeasurement: product.unitOfMeasurement,
    sroScheduleNo: product.sroScheduleNo ?? "",
    saleType: product.saleType,
    furtherTax: product.furtherTaxApplicable ? "" : "0",
    extraTax: product.extraTaxApplicable ? "" : "0",
    fedApplicable: product.fedApplicable,
    invoiceFields: product.invoiceFields,
  };
}

export async function bulkImportProductMappings(rows: unknown[]) {
  const results: Array<{ index: number; status: "created" | "error"; id?: string; error?: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const record = await createProductMapping(rows[i]);
      results.push({ index: i, status: "created", id: record.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ index: i, status: "error", error: message });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.filter((r) => r.status === "error").length;
  return { total: rows.length, created, failed, results };
}

export async function createProductMapping(raw: unknown) {
  const data = await normalizeAndValidateInput(raw);

  const record = await prisma.product.create({
    data: toPrismaProductData(data),
  });

  return toProductMappingDto(fromProductRecord(record));
}

export async function updateProductMapping(id: string, raw: unknown) {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) {
    throw httpError(404, "Product not found.");
  }

  const data = await normalizeAndValidateInput(raw, fromProductRecord(existing));
  const record = await prisma.product.update({
    where: { id },
    data: toPrismaProductData(data),
  });

  return toProductMappingDto(fromProductRecord(record));
}

export async function deleteProductMapping(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) {
    throw httpError(404, "Product not found.");
  }

  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return { id, deleted: true };
}

export async function searchHsCodeSuggestions(query = "", limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const result = await getItemDescriptions(false);
  const data = referenceList(result)
    .map((item) => ({
      hsCode: stringValue(item.hsCode),
      description: stringValue(item.description),
      raw: item.raw,
    }))
    .filter((item) => item.hsCode);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? data.filter(
        (item) =>
          item.hsCode.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery),
      )
    : data;

  return {
    query,
    source: stringValue(result.source),
    cacheHit: Boolean(result.cacheHit),
    data: filtered.slice(0, safeLimit),
  };
}

export async function resolveHsInvoiceFields(params: ResolveHsFieldsParams) {
  const hsCode = stringValue(params.hsCode);

  if (!hsCode) {
    throw httpError(400, "hsCode is required.");
  }

  const hsDescription = await validateHsCodeAndGetDescription(hsCode, "");
  const saleType = stringValue(params.saleType) || "Goods at standard rate (default)";
  const transactionType = await findTransactionType(saleType);
  const transactionTypeId = transactionType?.id ?? "";
  const annexureId = stringValue(params.annexureId) || transactionTypeId;
  const invoiceDate = stringValue(params.invoiceDate) || new Date().toISOString().slice(0, 10);
  const originationSupplier = stringValue(params.originationSupplier);
  const [rate, uom] = await Promise.all([
    transactionTypeId && originationSupplier
      ? resolveSalesTaxRate(transactionTypeId, invoiceDate, originationSupplier)
      : Promise.resolve(""),
    annexureId ? resolveUom(hsCode, annexureId) : Promise.resolve(""),
  ]);

  return {
    hsCode,
    hsDescription,
    saleType,
    transactionTypeId,
    salesTaxRate: rate,
    unitOfMeasurement: uom,
  };
}

async function normalizeAndValidateInput(raw: unknown, existing?: ProductMappingRecord) {
  const parsed = productMappingInputSchema.parse(raw) as RawRecord;
  const hsCode = valueFrom(parsed, ["hsCode", "hs_code"], existing?.hsCode);
  const hsDescription = await validateHsCodeAndGetDescription(
    hsCode,
    valueFrom(parsed, ["hsDescription", "hs_description", "description"], existing?.hsDescription),
  );
  const data = {
    productName: valueFrom(parsed, ["productName", "product_name"], existing?.productName),
    hsCode,
    hsDescription,
    salesTaxRate: numberValue(valueFrom(parsed, ["salesTaxRate", "sales_tax_rate", "rate", "defaultRate"], existing?.salesTaxRate)),
    unitOfMeasurement: valueFrom(parsed, ["unitOfMeasurement", "unit_of_measure", "unit_of_measurement", "defaultUom"], existing?.unitOfMeasurement),
    inStock: valueFrom(parsed, ["inStock", "in_stock"], existing?.inStock),
    sroScheduleNo: optionalValue(valueFrom(parsed, ["sroScheduleNo", "sro_schedule_no"], existing?.sroScheduleNo)),
    saleType: valueFrom(parsed, ["saleType", "sale_type", "defaultSaleType"], existing?.saleType || "Goods at standard rate (default)"),
    furtherTaxApplicable: booleanValue(
      valueFrom(parsed, ["furtherTaxApplicable", "further_tax_applicable"], existing?.furtherTaxApplicable),
    ),
    extraTaxApplicable: booleanValue(
      valueFrom(parsed, ["extraTaxApplicable", "extra_tax_applicable"], existing?.extraTaxApplicable),
    ),
    fedApplicable: booleanValue(valueFrom(parsed, ["fedApplicable", "fed_applicable"], existing?.fedApplicable)),
    isActive: statusToIsActive(valueFrom(parsed, ["status"], existing?.status || "Active")),
    status: valueFrom(parsed, ["status"], existing?.status || "Active"),
  };

  for (const key of ["productName", "hsCode", "hsDescription", "unitOfMeasurement", "saleType"] as const) {
    if (!data[key]) {
      throw httpError(400, `${key} is required.`);
    }
  }

  return data;
}

async function validateHsCodeAndGetDescription(hsCode: string, fallbackDescription: string) {
  if (!hsCode) {
    throw httpError(400, "hsCode is required.");
  }

  try {
    const result = await getItemDescriptions(false);
    const list = referenceList(result);

    if (list.length > 0) {
      const normalizedHsCode = normalizeHsCode(hsCode);
      const found = list.find((item) => normalizeHsCode(item.hsCode) === normalizedHsCode);

      if (!found) {
        throw httpError(
          400,
          `HS code "${hsCode}" was not found in the FBR item description reference. Please verify it against the FBR itemdesccode list.`,
        );
      }

      return stringValue(found.description) || fallbackDescription;
    }
  } catch (err) {
    const e = err as { status?: number };
    if (e.status === 400) throw err;
    // FBR reference API unavailable — accept the product with the provided description
  }

  // Reference list empty or API down — fall back gracefully
  return fallbackDescription || hsCode;
}

async function findTransactionType(saleType: string): Promise<{ id: string; description: string } | undefined> {
  const result = await getTransactionTypes(false);
  const normalizedSaleType = saleType.trim().toLowerCase();

  return referenceList(result)
    .map((item) => ({
      id: stringValue(item.id),
      description: stringValue(item.description),
    }))
    .find(
      (item) =>
        item.id === saleType ||
        item.description.trim().toLowerCase() === normalizedSaleType,
    );
}

async function resolveSalesTaxRate(transTypeId: string, date: string, originationSupplier: string) {
  try {
    const result = await getSaleTypeRates({ transTypeId, date, originationSupplier });
    const [firstRate] = referenceList(result);
    return stringValue(firstRate?.value) || parseRate(stringValue(firstRate?.description));
  } catch {
    return "";
  }
}

async function resolveUom(hsCode: string, annexureId: string) {
  try {
    const result = await getHsUoms({ hsCode, annexureId });
    const [firstUom] = referenceList(result);
    return stringValue(firstUom?.description);
  } catch {
    return "";
  }
}

function toProductMappingDto(record: ProductMappingRecord) {
  const dto = {
    id: record.id,
    productName: record.productName,
    hsCode: record.hsCode,
    hsDescription: record.hsDescription,
    salesTaxRate: record.salesTaxRate,
    unitOfMeasurement: record.unitOfMeasurement,
    inStock: record.inStock ?? "",
    sroScheduleNo: record.sroScheduleNo ?? "",
    saleType: record.saleType,
    furtherTaxApplicable: record.furtherTaxApplicable,
    extraTaxApplicable: record.extraTaxApplicable,
    fedApplicable: record.fedApplicable,
    isActive: record.isActive,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    invoiceFields: {
      productMappingId: record.id,
      hsCode: record.hsCode,
      productDescription: record.hsDescription,
      rate: String(record.salesTaxRate),
      uoM: record.unitOfMeasurement,
      sroScheduleNo: record.sroScheduleNo ?? "",
      saleType: record.saleType,
      furtherTax: record.furtherTaxApplicable ? "" : "0",
      extraTax: record.extraTaxApplicable ? "" : "0",
    },
  };

  return {
    ...dto,
    product_name: dto.productName,
    hs_code: dto.hsCode,
    description: dto.hsDescription,
    rate: dto.salesTaxRate,
    unit_of_measure: dto.unitOfMeasurement,
    in_stock: dto.inStock,
    sro_schedule_no: dto.sroScheduleNo,
    sale_type: dto.saleType,
    further_tax_applicable: dto.furtherTaxApplicable,
    extra_tax_applicable: dto.extraTaxApplicable,
    fed_applicable: dto.fedApplicable,
    is_active: dto.isActive,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function referenceList(result: unknown): RawRecord[] {
  const record = asRecord(result);
  const data = record.data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(asRecord);
}

function fromProductRecord(record: {
  id: string;
  name: string;
  hsCode: string;
  hsDescription: string;
  defaultSaleType: string;
  defaultRate: string;
  defaultUom: string;
  inStock: string | null;
  sroScheduleNo: string | null;
  furtherTaxApplicable: boolean;
  extraTaxApplicable: boolean;
  fedApplicable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductMappingRecord {
  return {
    id: record.id,
    productName: record.name,
    hsCode: record.hsCode,
    hsDescription: record.hsDescription,
    salesTaxRate: numberValue(record.defaultRate),
    unitOfMeasurement: record.defaultUom,
    inStock: record.inStock ?? "",
    sroScheduleNo: record.sroScheduleNo,
    saleType: record.defaultSaleType,
    furtherTaxApplicable: record.furtherTaxApplicable,
    extraTaxApplicable: record.extraTaxApplicable,
    fedApplicable: record.fedApplicable,
    isActive: record.isActive,
    status: record.isActive ? "Active" : "Inactive",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPrismaProductData(data: Awaited<ReturnType<typeof normalizeAndValidateInput>>) {
  return {
    name: data.productName,
    hsCode: data.hsCode,
    hsDescription: data.hsDescription,
    defaultSaleType: data.saleType,
    defaultRate: String(data.salesTaxRate),
    defaultUom: data.unitOfMeasurement,
    inStock: data.inStock || "",
    sroScheduleNo: data.sroScheduleNo,
    furtherTaxApplicable: data.furtherTaxApplicable,
    extraTaxApplicable: data.extraTaxApplicable,
    fedApplicable: data.fedApplicable,
    isActive: data.isActive,
  };
}

function valueFrom(raw: RawRecord, keys: string[], fallback?: unknown): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return fallback === undefined || fallback === null ? "" : String(fallback).trim();
}

function optionalValue(value: string): string | undefined {
  return value ? value : undefined;
}

function parseStatusFilter(status: string): boolean | undefined {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "active") return true;
  if (normalized === "inactive" || normalized === "deleted") return false;
  return undefined;
}

function statusToIsActive(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized !== "inactive" && normalized !== "deleted";
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = stringValue(value).replace("%", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = stringValue(value).toLowerCase();
  return ["true", "yes", "y", "1"].includes(normalized);
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeHsCode(value: unknown): string {
  return stringValue(value).replace(/\s+/g, "").toLowerCase();
}

function parseRate(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : "";
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
