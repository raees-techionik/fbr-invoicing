import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

type FbrErrorCategory = "sales" | "purchase" | "general";
type FbrErrorScope = "header" | "item";

export interface FbrErrorDefinition {
  code: string;
  category: FbrErrorCategory;
  field: string;
  message: string;
}

export interface NormalizedFbrError {
  scope: FbrErrorScope;
  itemIndex?: number;
  errorCode: string;
  category: FbrErrorCategory;
  field: string;
  message: string;
  userMessage: string;
  fbrMessage: string;
}

interface NormalizeErrorInput {
  scope: FbrErrorScope;
  itemIndex?: number;
  errorCode?: string;
  fbrMessage?: string;
  category?: FbrErrorCategory;
}

interface AuditInput {
  companyId: string;
  operation: string;
  endpoint?: string;
  statusCode?: string;
  invoiceSnapshot: unknown;
  errors: NormalizedFbrError[];
  raw?: unknown;
}

const salesOverrides: Record<string, Partial<FbrErrorDefinition>> = {
  "0001": { field: "invoiceType", message: "Select a valid invoice type." },
  "0002": { field: "invoiceDate", message: "Enter a valid invoice date." },
  "0003": { field: "sellerNTNCNIC", message: "Check the seller NTN/CNIC." },
  "0004": { field: "sellerBusinessName", message: "Check the seller business name." },
  "0005": { field: "sellerProvince", message: "Select a valid seller province." },
  "0006": { field: "sellerAddress", message: "Enter the seller address." },
  "0007": { field: "buyerNTNCNIC", message: "Check the buyer NTN/CNIC." },
  "0008": { field: "buyerBusinessName", message: "Check the buyer business name." },
  "0009": { field: "buyerProvince", message: "Select a valid buyer province." },
  "0010": { field: "buyerAddress", message: "Enter the buyer address." },
  "0011": { field: "buyerRegistrationType", message: "Select a valid buyer registration type." },
  "0012": { field: "invoiceRefNo", message: "Check the invoice reference number." },
  "0013": { field: "scenarioId", message: "Select the correct sandbox scenario ID." },
  "0014": { field: "items", message: "Add at least one valid invoice line item." },
  "0015": { field: "hsCode", message: "Check the HS code on this invoice line." },
  "0016": { field: "productDescription", message: "Check the product description on this invoice line." },
  "0017": { field: "rate", message: "Check the tax rate on this invoice line." },
  "0018": { field: "uoM", message: "Check the unit of measurement on this invoice line." },
  "0019": { field: "quantity", message: "Check the quantity on this invoice line." },
  "0020": { field: "totalValues", message: "Check the total value on this invoice line." },
  "0021": { field: "valueSalesExcludingST", message: "Check the value excluding sales tax." },
  "0022": { field: "fixedNotifiedValueOrRetailPrice", message: "Check the fixed/notified/retail price." },
  "0023": { field: "salesTaxApplicable", message: "Check the sales tax amount." },
  "0024": { field: "salesTaxWithheldAtSource", message: "Check the sales tax withheld at source." },
  "0025": { field: "extraTax", message: "Check the extra tax amount." },
  "0026": { field: "furtherTax", message: "Check the further tax amount." },
  "0027": { field: "sroScheduleNo", message: "Check the SRO schedule number." },
  "0028": { field: "fedPayable", message: "Check the FED payable amount." },
  "0029": { field: "discount", message: "Check the discount amount." },
  "0030": { field: "saleType", message: "Check the sale type on this invoice line." },
  "0031": { field: "sroItemSerialNo", message: "Check the SRO item serial number." },
  "0032": { field: "items", message: "Review the invoice line item sequence and required values." },
  "0033": { field: "sellerNTNCNIC", message: "Seller registration information could not be verified." },
  "0034": { field: "buyerNTNCNIC", message: "Buyer registration information could not be verified." },
  "0035": { field: "buyerRegistrationType", message: "Buyer registration type does not match FBR records." },
  "0036": { field: "invoiceDate", message: "Invoice date is outside the accepted range." },
  "0037": { field: "invoiceRefNo", message: "Referenced invoice could not be verified." },
  "0038": { field: "scenarioId", message: "Sandbox scenario does not match this invoice payload." },
  "0049": { field: "saleType", message: "Select a valid sale type for this invoice line." },
  "0050": { field: "rate", message: "Select a valid tax rate for this sale type." },
  "0051": { field: "uoM", message: "Select a valid unit of measurement for the HS code." },
  "0052": { field: "hsCode", message: "HS Code does not match the selected sale type. Review the HS code and sale type." },
  "0053": { field: "sroScheduleNo", message: "SRO schedule is required or invalid for this sale type." },
  "0054": { field: "sroItemSerialNo", message: "SRO item serial number is required or invalid." },
  "0055": { field: "fixedNotifiedValueOrRetailPrice", message: "Fixed/notified/retail price is required for this sale type." },
  "0056": { field: "fedPayable", message: "FED payable amount is required or invalid for this sale type." },
  "0057": { field: "extraTax", message: "Extra tax amount is required or invalid." },
  "0058": { field: "furtherTax", message: "Further tax amount is required or invalid." },
  "0059": { field: "discount", message: "Discount amount is invalid." },
  "0060": { field: "totalValues", message: "Invoice line total does not match the taxable values and taxes." },
  "0061": { field: "salesTaxApplicable", message: "Sales tax amount does not match the selected rate and value." },
  "0062": { field: "valueSalesExcludingST", message: "Value excluding sales tax is invalid for this line." },
  "0063": { field: "quantity", message: "Quantity is invalid for the selected UOM or HS code." },
  "0064": { field: "items", message: "One or more line item values failed FBR validation." },
};

const purchaseOverrides: Record<string, Partial<FbrErrorDefinition>> = {
  "0156": { field: "invoiceType", message: "Check the purchase invoice type." },
  "0157": { field: "invoiceDate", message: "Check the purchase invoice date." },
  "0158": { field: "sellerNTNCNIC", message: "Check the seller NTN/CNIC on the purchase invoice." },
  "0159": { field: "buyerNTNCNIC", message: "Check the buyer NTN/CNIC on the purchase invoice." },
  "0160": { field: "hsCode", message: "Check the HS code on the purchase invoice line." },
  "0161": { field: "rate", message: "Check the purchase tax rate." },
  "0162": { field: "uoM", message: "Check the purchase unit of measurement." },
  "0163": { field: "quantity", message: "Check the purchase quantity." },
  "0164": { field: "valueSalesExcludingST", message: "Check the purchase value excluding sales tax." },
  "0165": { field: "salesTaxApplicable", message: "Check the purchase sales tax amount." },
  "0166": { field: "salesTaxWithheldAtSource", message: "Check the purchase sales tax withheld at source." },
  "0167": { field: "extraTax", message: "Check the purchase extra tax amount." },
  "0168": { field: "furtherTax", message: "Check the purchase further tax amount." },
  "0169": { field: "sroScheduleNo", message: "Check the purchase SRO schedule number." },
  "0170": { field: "fedPayable", message: "Check the purchase FED payable amount." },
  "0171": { field: "discount", message: "Check the purchase discount amount." },
  "0172": { field: "saleType", message: "Check the purchase sale type." },
  "0173": { field: "sroItemSerialNo", message: "Check the purchase SRO item serial number." },
  "0174": { field: "buyerRegistrationType", message: "Check the buyer registration type on the purchase invoice." },
  "0175": { field: "totalValues", message: "Check the purchase line total value." },
  "0176": { field: "invoiceRefNo", message: "Check the referenced purchase invoice number." },
  "0177": { field: "items", message: "Review the purchase invoice line items." },
};

export const salesErrorLookupTable = buildErrorTable("sales", 1, 300, salesOverrides);
export const purchaseErrorLookupTable = buildErrorTable("purchase", 156, 177, purchaseOverrides);

export function normalizeFbrError(input: NormalizeErrorInput): NormalizedFbrError {
  const errorCode = normalizeCode(input.errorCode);
  const fbrMessage = input.fbrMessage ?? "";
  const definition = getFbrErrorDefinition(errorCode, input.category, fbrMessage);

  return {
    scope: input.scope,
    itemIndex: input.itemIndex,
    errorCode,
    category: definition.category,
    field: definition.field,
    message: definition.message,
    userMessage: definition.message,
    fbrMessage,
  };
}

export function parseAndMapFBRError(response: unknown): NormalizedFbrError[] {
  const root = asRecord(response);
  const validation = asRecord(root.validationResponse);
  const errors: NormalizedFbrError[] = [];
  const headerCode = stringFrom([validation.errorCode, validation.ErrorCode, root.errorCode, root.ErrorCode]);
  const headerMessage = stringFrom([
    validation.error,
    validation.errorMessage,
    validation.message,
    root.error,
    root.errorMessage,
    root.message,
  ]);

  if (headerCode || headerMessage) {
    errors.push(
      normalizeFbrError({
        scope: "header",
        errorCode: headerCode,
        fbrMessage: headerMessage,
      }),
    );
  }

  for (const [itemIndex, item] of extractItemStatusRows(root, validation).entries()) {
    const raw = asRecord(item);
    const itemCode = stringFrom([raw.errorCode, raw.ErrorCode]);
    const itemMessage = stringFrom([raw.error, raw.errorMessage, raw.message]);
    const statusCode = stringFrom([raw.statusCode, raw.StatusCode]);

    if (statusCode === "01" || itemCode || itemMessage) {
      errors.push(
        normalizeFbrError({
          scope: "item",
          itemIndex,
          errorCode: itemCode,
          fbrMessage: itemMessage,
        }),
      );
    }
  }

  return errors;
}

export function getFbrErrorDefinition(
  errorCode: string,
  category: FbrErrorCategory = "sales",
  fbrMessage = "",
): FbrErrorDefinition {
  const code = normalizeCode(errorCode);
  const lookup = category === "purchase" ? purchaseErrorLookupTable : salesErrorLookupTable;
  const definition = lookup[code] ?? salesErrorLookupTable[code] ?? purchaseErrorLookupTable[code];

  if (definition) {
    return {
      ...definition,
      field: definition.field || inferField(fbrMessage),
    };
  }

  return {
    code,
    category: "general",
    field: inferField(fbrMessage),
    message: `FBR validation error ${code}. Review the highlighted field and compare it with the FBR message.`,
  };
}

export async function logFbrErrorAudit(input: AuditInput): Promise<void> {
  if (input.errors.length === 0) {
    return;
  }

  const auditFile = process.env.FBR_ERROR_AUDIT_LOG_PATH ?? join(process.cwd(), ".data", "fbr-error-audit.log");
  const row = {
    companyId: input.companyId,
    timestamp: new Date().toISOString(),
    operation: input.operation,
    endpoint: input.endpoint,
    statusCode: input.statusCode,
    errors: input.errors,
    invoiceSnapshot: input.invoiceSnapshot,
    raw: input.raw,
  };

  await mkdir(dirname(auditFile), { recursive: true });
  await appendFile(auditFile, `${JSON.stringify(row)}\n`, "utf8");
}

function buildErrorTable(
  category: FbrErrorCategory,
  start: number,
  end: number,
  overrides: Record<string, Partial<FbrErrorDefinition>>,
): Record<string, FbrErrorDefinition> {
  const rows: Record<string, FbrErrorDefinition> = {};

  for (let index = start; index <= end; index += 1) {
    const code = normalizeCode(index);
    const override = overrides[code] ?? {};

    const defaultDefinition = defaultDefinitionForCode(category, index);

    rows[code] = {
      code,
      category,
      field: override.field ?? defaultDefinition.field,
      message:
        override.message ??
        defaultDefinition.message,
    };
  }

  return rows;
}

function defaultDefinitionForCode(category: FbrErrorCategory, index: number): Pick<FbrErrorDefinition, "field" | "message"> {
  if (category === "purchase") {
    return {
      field: purchaseFieldForCode(index),
      message: `FBR purchase validation error ${normalizeCode(index)}. Review the highlighted purchase invoice field using the original FBR message.`,
    };
  }

  return {
    field: salesFieldForCode(index),
    message: `FBR sales validation error ${normalizeCode(index)}. Review the highlighted invoice field using the original FBR message.`,
  };
}

function salesFieldForCode(index: number): string {
  if (index <= 14) return "invoice";
  if (index <= 32) return "items";
  if (index <= 38) return "registration";
  if (index <= 48) return "invoice";
  if (index <= 64) return "items";
  if (index <= 80) return "tax";
  if (index <= 96) return "sro";
  if (index <= 120) return "scenarioId";
  return "invoice";
}

function purchaseFieldForCode(index: number): string {
  if (index <= 159) return "invoice";
  if (index <= 175) return "items";
  return "invoiceRefNo";
}

function normalizeCode(code: unknown): string {
  const text = String(code ?? "").trim();

  if (!text) {
    return "UNKNOWN";
  }

  return /^\d+$/.test(text) ? text.padStart(4, "0") : text;
}

function inferField(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invoice type") || normalized.includes("document type")) return "invoiceType";
  if (normalized.includes("hs code") || normalized.includes("hscode")) return "hsCode";
  if (normalized.includes("description")) return "productDescription";
  if (normalized.includes("sale type")) return "saleType";
  if (normalized.includes("rate")) return "rate";
  if (normalized.includes("uom") || normalized.includes("unit")) return "uoM";
  if (normalized.includes("quantity")) return "quantity";
  if (normalized.includes("total")) return "totalValues";
  if (normalized.includes("excluding")) return "valueSalesExcludingST";
  if (normalized.includes("retail") || normalized.includes("fixed") || normalized.includes("notified")) return "fixedNotifiedValueOrRetailPrice";
  if (normalized.includes("withheld")) return "salesTaxWithheldAtSource";
  if (normalized.includes("sales tax")) return "salesTaxApplicable";
  if (normalized.includes("further")) return "furtherTax";
  if (normalized.includes("extra")) return "extraTax";
  if (normalized.includes("fed")) return "fedPayable";
  if (normalized.includes("discount")) return "discount";
  if (normalized.includes("seller") && (normalized.includes("ntn") || normalized.includes("cnic"))) return "sellerNTNCNIC";
  if (normalized.includes("buyer") && (normalized.includes("ntn") || normalized.includes("cnic"))) return "buyerNTNCNIC";
  if (normalized.includes("seller")) return "seller";
  if (normalized.includes("buyer")) return "buyer";
  if (normalized.includes("ntn") || normalized.includes("cnic")) return "ntnCnic";
  if (normalized.includes("province")) return "province";
  if (normalized.includes("sro item")) return "sroItemSerialNo";
  if (normalized.includes("sro")) return "sroScheduleNo";
  if (normalized.includes("invoice reference") || normalized.includes("ref")) return "invoiceRefNo";
  if (normalized.includes("scenario")) return "scenarioId";
  if (normalized.includes("date")) return "invoiceDate";

  return "invoice";
}

function extractItemStatusRows(root: Record<string, unknown>, validation: Record<string, unknown>): unknown[] {
  const possibleArrays = [
    root.invoiceStatuses,
    root.itemStatuses,
    root.items,
    validation.invoiceStatuses,
    validation.itemStatuses,
    validation.items,
  ];

  return possibleArrays.find(Array.isArray) as unknown[] | undefined ?? [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringFrom(values: unknown[], fallback = ""): string {
  for (const value of values) {
    const parsed = String(value ?? "").trim();
    if (parsed) return parsed;
  }

  return fallback;
}
