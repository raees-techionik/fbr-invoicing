import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { normalizeFbrError, parseAndMapFBRError } from "./fbr-error.service.js";
import type { FbrInvoiceInput, FbrInvoiceItemInput, FbrOperationResult } from "./fbr-invoice.service.js";

type FbrPayloadItem = FbrOperationResult["payload"]["items"][number];

export async function saveNormalizedInvoiceRecord(
  _invoice: FbrInvoiceInput,
  result: FbrOperationResult,
) {
  const payload = result.payload;
  const created = await prisma.invoice.create({
    data: {
      fbrInvoiceNumber: optionalString(result.invoiceNumber),
      invoiceType: payload.invoiceType,
      invoiceDate: parseInvoiceDate(payload.invoiceDate),
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
      status: result.isValid ? "SUBMITTED" : "FAILED",
      isOffline: false,
      submittedAt: result.isValid ? parseSubmittedAt(result.dated) : undefined,
      fbrRawResponse: toJsonValue(buildFbrRawResponse(result)),
      items: {
        create: payload.items.map((item, index) => toInvoiceItemCreate(item, result, index)),
      },
    },
    include: {
      items: true,
    },
  });

  return {
    id: created.id,
    fbrInvoiceNumber: created.fbrInvoiceNumber ?? "",
    invoiceType: created.invoiceType,
    invoiceDate: created.invoiceDate.toISOString().slice(0, 10),
    buyerBusinessName: created.buyerBusinessName,
    status: created.status,
    itemCount: created.items.length,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function saveFailedInvoiceRecord(
  invoice: FbrInvoiceInput,
  error: Error & { status?: number; code?: string; details?: string; rawResponse?: unknown },
) {
  const rawResponse = error.rawResponse ?? parseErrorDetails(error.details) ?? {
    message: error.message,
    code: error.code ?? null,
    httpStatus: error.status ?? null,
  };
  const mappedError = normalizeFbrError({
    scope: "header",
    errorCode: error.code ?? String(error.status ?? "HTTP"),
    fbrMessage: error.details ?? error.message,
    category: "general",
  });

  const created = await prisma.invoice.create({
    data: {
      invoiceType: stringValue(invoice.invoiceType, "Sale Invoice"),
      invoiceDate: parseInvoiceDate(stringValue(invoice.invoiceDate)),
      invoiceRefNo: optionalString(invoice.invoiceRefNo),
      sellerNTNCNIC: stringValue(invoice.sellerNTNCNIC),
      sellerBusinessName: stringValue(invoice.sellerBusinessName),
      sellerProvince: stringValue(invoice.sellerProvince),
      sellerAddress: stringValue(invoice.sellerAddress),
      buyerNTNCNIC: optionalString(invoice.buyerNTNCNIC),
      buyerBusinessName: stringValue(invoice.buyerBusinessName),
      buyerProvince: stringValue(invoice.buyerProvince),
      buyerAddress: stringValue(invoice.buyerAddress),
      buyerRegistrationType: stringValue(invoice.buyerRegistrationType),
      status: "FAILED",
      isOffline: false,
      fbrRawResponse: toJsonValue({
        timestamp: new Date().toISOString(),
        operation: "submit",
        statusCode: String(error.status ?? ""),
        mappedErrorCode: mappedError.errorCode,
        mappedErrors: [mappedError],
        invoiceSnapshot: invoice,
        rawResponse,
        transportError: {
          message: error.message,
          code: error.code ?? null,
          httpStatus: error.status ?? null,
        },
      }),
      items: {
        create: (invoice.items ?? []).map((item) => toFailedItemCreate(item)),
      },
    },
  });

  return {
    id: created.id,
    status: "FAILED" as const,
    error: error.message,
  };
}

function buildFbrRawResponse(result: FbrOperationResult): unknown {
  if (result.isValid) {
    return result.raw;
  }

  const mappedErrors = result.errors.length > 0 ? result.errors : parseAndMapFBRError(result.raw);

  return {
    timestamp: new Date().toISOString(),
    operation: result.endpoint,
    statusCode: result.statusCode,
    mappedErrorCode: mappedErrors[0]?.errorCode ?? result.statusCode,
    mappedErrors,
    invoiceSnapshot: result.payload,
    rawResponse: result.raw,
  };
}

function parseErrorDetails(details: string | undefined): unknown {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details);
  } catch {
    return details;
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export async function getInvoiceById(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!invoice) {
    const err = new Error("Invoice not found.") as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const amountPkr = calculateInvoiceAmount(invoice.items);
  const dto = {
    id: invoice.id,
    fbrInvoiceNumber: invoice.fbrInvoiceNumber ?? "",
    invoiceType: invoice.invoiceType,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    invoiceRefNo: invoice.invoiceRefNo ?? "",
    sellerNTNCNIC: invoice.sellerNTNCNIC,
    sellerBusinessName: invoice.sellerBusinessName,
    sellerProvince: invoice.sellerProvince,
    sellerAddress: invoice.sellerAddress,
    buyerNTNCNIC: invoice.buyerNTNCNIC ?? "",
    buyerBusinessName: invoice.buyerBusinessName,
    buyerProvince: invoice.buyerProvince,
    buyerAddress: invoice.buyerAddress,
    buyerRegistrationType: invoice.buyerRegistrationType,
    status: invoice.status,
    isOffline: invoice.isOffline,
    amountPkr,
    submittedAt: invoice.submittedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    fbrRawResponse: invoice.fbrRawResponse,
    items: invoice.items.map((item) => ({
      id: item.id,
      fbrItemInvoiceNo: item.fbrItemInvoiceNo ?? "",
      hsCode: item.hsCode,
      productDescription: item.productDescription,
      rate: item.rate,
      uom: item.uom,
      quantity: item.quantity,
      totalValues: item.totalValues,
      valueSalesExcludingST: item.valueSalesExcludingST,
      fixedNotifiedValueOrRetailPrice: item.fixedNotifiedValueOrRetailPrice,
      salesTaxApplicable: item.salesTaxApplicable,
      salesTaxWithheldAtSource: item.salesTaxWithheldAtSource,
      extraTax: item.extraTax ?? 0,
      furtherTax: item.furtherTax ?? 0,
      sroScheduleNo: item.sroScheduleNo ?? "",
      fedPayable: item.fedPayable ?? 0,
      discount: item.discount ?? 0,
      saleType: item.saleType,
      sroItemSerialNo: item.sroItemSerialNo ?? "",
    })),
  };

  return {
    ...dto,
    fbr_invoice_number: dto.fbrInvoiceNumber,
    invoice_type: dto.invoiceType,
    invoice_date: dto.invoiceDate,
    invoice_ref_no: dto.invoiceRefNo,
    seller_ntn_cnic: dto.sellerNTNCNIC,
    seller_business_name: dto.sellerBusinessName,
    seller_province: dto.sellerProvince,
    seller_address: dto.sellerAddress,
    buyer_ntn_cnic: dto.buyerNTNCNIC,
    buyer_business_name: dto.buyerBusinessName,
    buyer_province: dto.buyerProvince,
    buyer_address: dto.buyerAddress,
    buyer_registration_type: dto.buyerRegistrationType,
    is_offline: dto.isOffline,
    amount_pkr: dto.amountPkr,
    submitted_at: dto.submittedAt,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    fbr_raw_response: dto.fbrRawResponse,
  };
}

function toFailedItemCreate(item: FbrInvoiceItemInput): Prisma.InvoiceItemCreateWithoutInvoiceInput {
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

function toInvoiceItemCreate(
  item: FbrPayloadItem,
  result: FbrOperationResult,
  index: number,
): Prisma.InvoiceItemCreateWithoutInvoiceInput {
  const itemResponse = result.itemResponses.find((response) => response.index === index);

  return {
    fbrItemInvoiceNo: optionalString(itemResponse?.fbrInvoiceNumber),
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

function calculateInvoiceAmount(items: Array<{
  totalValues: number;
  valueSalesExcludingST: number;
  salesTaxApplicable: number;
  furtherTax: number | null;
  extraTax: number | null;
  fedPayable: number | null;
  discount: number | null;
}>): number {
  const total = items.reduce((sum, item) => {
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
  }, 0);

  return Math.round(total * 100) / 100;
}

function parseInvoiceDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseSubmittedAt(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
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

function stringValue(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}
