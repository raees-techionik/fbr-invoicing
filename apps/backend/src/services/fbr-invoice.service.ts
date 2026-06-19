import {
  logFbrErrorAudit,
  normalizeFbrError,
  type NormalizedFbrError,
} from "./fbr-error.service.js";
import { getRuntimeFbrSettings } from "./fbr-settings.service.js";

const FBR_BASE_URL = process.env.FBR_BASE_URL ?? "https://gw.fbr.gov.pk";

type FbrEnvironment = "sandbox" | "production";
type RawRecord = Record<string, unknown>;

export interface FbrInvoiceItemInput {
  hsCode?: unknown;
  productDescription?: unknown;
  rate?: unknown;
  uoM?: unknown;
  quantity?: unknown;
  totalValues?: unknown;
  valueSalesExcludingST?: unknown;
  fixedNotifiedValueOrRetailPrice?: unknown;
  salesTaxApplicable?: unknown;
  salesTaxWithheldAtSource?: unknown;
  extraTax?: unknown;
  furtherTax?: unknown;
  sroScheduleNo?: unknown;
  fedPayable?: unknown;
  discount?: unknown;
  saleType?: unknown;
  sroItemSerialNo?: unknown;
}

export interface FbrInvoiceInput {
  invoiceType?: unknown;
  invoiceDate?: unknown;
  sellerNTNCNIC?: unknown;
  sellerBusinessName?: unknown;
  sellerProvince?: unknown;
  sellerAddress?: unknown;
  buyerNTNCNIC?: unknown;
  buyerBusinessName?: unknown;
  buyerProvince?: unknown;
  buyerAddress?: unknown;
  buyerRegistrationType?: unknown;
  invoiceRefNo?: unknown;
  scenarioId?: unknown;
  items?: FbrInvoiceItemInput[];
}

export interface FbrInvoiceSettings {
  environment?: unknown;
  token?: unknown;
  sandboxToken?: unknown;
  productionToken?: unknown;
  useMock?: unknown;
  mockStatus?: unknown;
}

interface FbrRequestConfig {
  environment: FbrEnvironment;
  token: string;
  useMock: boolean;
  mockStatus: "valid" | "invalid";
}

export interface FbrInvoicePayload {
  invoiceType: string;
  invoiceDate: string;
  sellerNTNCNIC: string;
  sellerBusinessName: string;
  sellerProvince: string;
  sellerAddress: string;
  buyerNTNCNIC: string;
  buyerBusinessName: string;
  buyerProvince: string;
  buyerAddress: string;
  buyerRegistrationType: string;
  invoiceRefNo: string;
  scenarioId?: string;
  items: Array<Record<string, string | number>>;
}

interface FbrItemResponse {
  index: number;
  statusCode: string;
  isValid: boolean;
  fbrInvoiceNumber: string;
  errorCode: string;
  error: string;
  errorDetail?: NormalizedFbrError;
  raw: unknown;
}

export interface FbrOperationResult {
  environment: FbrEnvironment;
  endpoint: "format" | "validate" | "submit";
  isValid: boolean;
  statusCode: string;
  message: string;
  errors: NormalizedFbrError[];
  headerErrors: NormalizedFbrError[];
  invoiceNumber: string;
  dated: string;
  itemResponses: FbrItemResponse[];
  printData: {
    fbrInvoiceNumber: string;
    dated: string;
    itemInvoiceNumbers: string[];
  };
  payload: FbrInvoicePayload;
  raw: unknown;
}

interface ReferenceInvoiceLookupResult {
  environment: FbrEnvironment;
  found: boolean;
  invoiceRefNo: string;
  source: "mock" | "configured-url" | "not-configured";
  message: string;
  raw: unknown;
}

export function formatInvoiceForFbr(
  invoice: FbrInvoiceInput,
  environment: FbrEnvironment = "sandbox",
): FbrInvoicePayload {
  const invoiceType = stringValue(invoice.invoiceType, "Sale Invoice");
  const invoiceRefNo = stringValue(invoice.invoiceRefNo);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  if (items.length === 0) {
    throw badRequest("Invoice must contain at least one item.");
  }

  if (isDebitNote(invoiceType) && !invoiceRefNo) {
    throw badRequest("invoiceRefNo is required for Debit Note invoices.");
  }

  const payload: FbrInvoicePayload = {
    invoiceType,
    invoiceDate: stringValue(invoice.invoiceDate, todayDate()),
    sellerNTNCNIC: stringValue(invoice.sellerNTNCNIC),
    sellerBusinessName: stringValue(invoice.sellerBusinessName),
    sellerProvince: stringValue(invoice.sellerProvince),
    sellerAddress: stringValue(invoice.sellerAddress),
    buyerNTNCNIC: stringValue(invoice.buyerNTNCNIC),
    buyerBusinessName: stringValue(invoice.buyerBusinessName),
    buyerProvince: stringValue(invoice.buyerProvince),
    buyerAddress: stringValue(invoice.buyerAddress),
    buyerRegistrationType: stringValue(invoice.buyerRegistrationType, "Registered"),
    invoiceRefNo,
    items: items.map(formatInvoiceItem),
  };

  if (environment === "sandbox") {
    payload.scenarioId = stringValue(invoice.scenarioId, "SN001");
  }

  return payload;
}

export async function validateInvoiceWithFbr(
  companyId: string,
  invoice: FbrInvoiceInput,
  settings: FbrInvoiceSettings = {},
): Promise<FbrOperationResult> {
  const config = await resolveConfig(companyId, settings);
  const payload = formatInvoiceForFbr(invoice, config.environment);

  if (config.useMock) {
    const result = makeMockResult("validate", payload, config);
    await auditIfInvalid(companyId, result);
    return result;
  }

  try {
    const raw = await postToFbr(validatePath(config.environment), payload, config.token);
    const result = normalizeFbrResponse("validate", payload, raw, config.environment);
    await auditIfInvalid(companyId, result);
    return result;
  } catch (error) {
    await auditTransportError(companyId, "validate", payload, error);
    throw error;
  }
}

export async function submitInvoiceToFbr(
  companyId: string,
  invoice: FbrInvoiceInput,
  settings: FbrInvoiceSettings = {},
): Promise<FbrOperationResult> {
  const config = await resolveConfig(companyId, settings);
  const payload = formatInvoiceForFbr(invoice, config.environment);

  if (config.useMock) {
    const result = makeMockResult("submit", payload, config);
    await auditIfInvalid(companyId, result);
    return result;
  }

  try {
    const raw = await postToFbr("/di_data/v1/di/postinvoicedata", payload, config.token);
    const result = normalizeFbrResponse("submit", payload, raw, config.environment);
    await auditIfInvalid(companyId, result);
    return result;
  } catch (error) {
    await auditTransportError(companyId, "submit", payload, error);
    throw error;
  }
}

export async function previewFormattedInvoice(
  companyId: string,
  invoice: FbrInvoiceInput,
  settings: FbrInvoiceSettings = {},
): Promise<FbrOperationResult> {
  const config = await resolveConfig(companyId, settings);
  const payload = formatInvoiceForFbr(invoice, config.environment);

  return {
    environment: config.environment,
    endpoint: "format",
    isValid: true,
    statusCode: "00",
    message: "Invoice formatted successfully.",
    errors: [],
    headerErrors: [],
    invoiceNumber: "",
    dated: "",
    itemResponses: [],
    printData: {
      fbrInvoiceNumber: "",
      dated: "",
      itemInvoiceNumbers: [],
    },
    payload,
    raw: payload,
  };
}

export async function lookupReferenceInvoice(
  companyId: string,
  invoiceRefNo: unknown,
  settings: FbrInvoiceSettings = {},
): Promise<ReferenceInvoiceLookupResult> {
  const config = await resolveConfig(companyId, settings);
  const referenceNo = stringValue(invoiceRefNo);

  if (!referenceNo) {
    throw badRequest("invoiceRefNo is required for reference invoice lookup.");
  }

  if (config.useMock) {
    return {
      environment: config.environment,
      found: true,
      invoiceRefNo: referenceNo,
      source: "mock",
      message: "Mock reference invoice lookup succeeded.",
      raw: { invoiceRefNo: referenceNo },
    };
  }

  const lookupUrl = stringValue(process.env.FBR_REFERENCE_INVOICE_LOOKUP_URL);

  if (!lookupUrl) {
    return {
      environment: config.environment,
      found: false,
      invoiceRefNo: referenceNo,
      source: "not-configured",
      message: "Reference invoice lookup URL is not configured.",
      raw: null,
    };
  }

  const url = new URL(lookupUrl);
  url.searchParams.set("invoiceRefNo", referenceNo);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    const error = new Error("Reference invoice lookup failed.") as Error & { status?: number };
    error.status = response.status === 401 ? 401 : 502;
    throw error;
  }

  const raw = await response.json();

  return {
    environment: config.environment,
    found: true,
    invoiceRefNo: referenceNo,
    source: "configured-url",
    message: "Reference invoice lookup succeeded.",
    raw,
  };
}

async function resolveConfig(companyId: string, settings: FbrInvoiceSettings): Promise<FbrRequestConfig> {
  const runtimeSettings = await getRuntimeFbrSettings(companyId, settings);
  const environment = runtimeSettings.environment;
  const useMock = runtimeSettings.useMock;
  const mockStatus = stringValue(settings.mockStatus, "valid") === "invalid" ? "invalid" : "valid";
  const token = runtimeSettings.activeToken;

  if (!useMock && !token) {
    const error = new Error("FBR token is missing. Update the token in settings before using live mode.") as Error & {
      status?: number;
      code?: string;
      action?: string;
    };
    error.status = 401;
    error.code = "FBR_TOKEN_MISSING";
    error.action = "UPDATE_FBR_TOKEN";
    throw error;
  }

  return {
    environment,
    token,
    useMock,
    mockStatus,
  };
}

async function postToFbr(path: string, payload: FbrInvoicePayload, token: string): Promise<unknown> {
  const response = await fetch(new URL(path, FBR_BASE_URL), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const error = new Error(fbrHttpErrorMessage(response.status)) as Error & {
      status?: number;
      details?: string;
      code?: string;
      action?: string;
      rawResponse?: unknown;
    };
    error.status = response.status === 401 ? 401 : response.status >= 500 ? 502 : response.status;
    error.details = responseText;
    error.code = response.status === 401 ? "FBR_TOKEN_INVALID" : "FBR_REQUEST_FAILED";
    error.action = response.status === 401 ? "UPDATE_FBR_TOKEN" : "RETRY_LATER";
    error.rawResponse = parseResponseBody(responseText);
    throw error;
  }

  return response.json();
}

function normalizeFbrResponse(
  endpoint: "validate" | "submit",
  payload: FbrInvoicePayload,
  raw: unknown,
  environment: FbrEnvironment,
): FbrOperationResult {
  const root = asRecord(raw);
  const validation = asRecord(root.validationResponse);
  const statusCode = stringFrom([validation.statusCode, root.statusCode], "00");
  const headerError = buildHeaderError(root, validation, statusCode);
  const itemResponses = extractItemResponses(root, validation);
  const headerErrors = headerError ? [headerError] : [];
  const itemErrors = itemResponses.flatMap((item) => (item.errorDetail ? [item.errorDetail] : []));
  const errors = [...headerErrors, ...itemErrors];
  const isValid = statusCode === "00" && errors.length === 0 && itemResponses.every((item) => item.isValid);
  const invoiceNumber = stringFrom([
    root.invoiceNumber,
    root.fbrInvoiceNumber,
    root.FBRInvoiceNumber,
    root.fbrInvoiceNo,
    validation.invoiceNumber,
    validation.fbrInvoiceNumber,
  ]);
  const dated = stringFrom([root.dated, root.dateTime, root.invoiceDate, validation.dated]);

  return {
    environment,
    endpoint,
    isValid,
    statusCode,
    message: isValid ? "FBR invoice response is valid." : errors[0]?.message ?? "FBR invoice response contains validation errors.",
    errors,
    headerErrors,
    invoiceNumber,
    dated,
    itemResponses,
    printData: {
      fbrInvoiceNumber: invoiceNumber,
      dated,
      itemInvoiceNumbers: itemResponses.map((item) => item.fbrInvoiceNumber).filter(Boolean),
    },
    payload,
    raw,
  };
}

function makeMockResult(
  endpoint: "validate" | "submit",
  payload: FbrInvoicePayload,
  config: FbrRequestConfig,
): FbrOperationResult {
  const invoiceNumber = endpoint === "submit" ? makeMockInvoiceNumber() : "";
  const invalid = config.mockStatus === "invalid";
  const raw = {
    validationResponse: {
      statusCode: invalid ? "01" : "00",
      status: invalid ? "Invalid" : "Valid",
      errorCode: invalid ? "0052" : "",
      error: invalid ? "Mock validation failed for HS Code or sale type." : "",
      invoiceNumber,
      dated: new Date().toISOString(),
      invoiceStatuses: payload.items.map((_, index) => ({
        itemSNo: index + 1,
        statusCode: invalid && index === 0 ? "01" : "00",
        status: invalid && index === 0 ? "Invalid" : "Valid",
        invoiceNo: invoiceNumber ? `${invoiceNumber}-${String(index + 1).padStart(4, "0")}` : "",
        errorCode: invalid && index === 0 ? "0052" : "",
        error: invalid && index === 0 ? "Mock item-level validation error." : "",
      })),
    },
  };

  return normalizeFbrResponse(endpoint, payload, raw, config.environment);
}

function extractItemResponses(root: RawRecord, validation: RawRecord): FbrItemResponse[] {
  const possibleArrays = [
    root.invoiceStatuses,
    root.itemStatuses,
    root.items,
    validation.invoiceStatuses,
    validation.itemStatuses,
    validation.items,
  ];
  const itemStatuses = possibleArrays.find(Array.isArray) as unknown[] | undefined;

  if (!itemStatuses) {
    return [];
  }

  return itemStatuses.map((item, index) => {
    const raw = asRecord(item);
    const statusCode = stringFrom([raw.statusCode, raw.StatusCode], "00");
    const errorCode = stringFrom([raw.errorCode, raw.ErrorCode]);
    const error = stringFrom([raw.error, raw.errorMessage, raw.message]);
    const errorDetail =
      statusCode === "01" || errorCode || error
        ? normalizeFbrError({
            scope: "item",
            itemIndex: index,
            errorCode,
            fbrMessage: error,
          })
        : undefined;

    return {
      index,
      statusCode,
      isValid: statusCode === "00" && !errorDetail,
      fbrInvoiceNumber: stringFrom([raw.invoiceNo, raw.invoiceNumber, raw.fbrInvoiceNumber]),
      errorCode,
      error,
      errorDetail,
      raw,
    };
  });
}

function buildHeaderError(root: RawRecord, validation: RawRecord, statusCode: string): NormalizedFbrError | undefined {
  const errorCode = stringFrom([validation.errorCode, validation.ErrorCode, root.errorCode, root.ErrorCode]);
  const fbrMessage = stringFrom([validation.error, validation.errorMessage, validation.message, root.error, root.message]);

  if (statusCode !== "01" && !errorCode && !fbrMessage) {
    return undefined;
  }

  return normalizeFbrError({
    scope: "header",
    errorCode,
    fbrMessage,
  });
}

async function auditIfInvalid(companyId: string, result: FbrOperationResult): Promise<void> {
  if (result.errors.length === 0) {
    return;
  }

  await logFbrErrorAudit({
    companyId,
    operation: result.endpoint,
    statusCode: result.statusCode,
    invoiceSnapshot: result.payload,
    errors: result.errors,
    raw: result.raw,
  });
}

async function auditTransportError(companyId: string, operation: string, payload: FbrInvoicePayload, error: unknown): Promise<void> {
  const err = error as Error & { code?: string; details?: string };
  const normalized = normalizeFbrError({
    scope: "header",
    errorCode: err.code ?? "HTTP",
    fbrMessage: err.details ?? err.message,
    category: "general",
  });

  await logFbrErrorAudit({
    companyId,
    operation,
    invoiceSnapshot: payload,
    errors: [normalized],
    raw: {
      message: err.message,
      code: err.code,
      details: err.details,
    },
  });
}

function formatInvoiceItem(item: FbrInvoiceItemInput): Record<string, string | number> {
  return {
    hsCode: stringValue(item.hsCode),
    productDescription: stringValue(item.productDescription),
    rate: rateValue(item.rate),
    uoM: stringValue(item.uoM),
    quantity: numberValue(item.quantity),
    totalValues: numberValue(item.totalValues),
    valueSalesExcludingST: numberValue(item.valueSalesExcludingST),
    fixedNotifiedValueOrRetailPrice: numberValue(item.fixedNotifiedValueOrRetailPrice),
    salesTaxApplicable: numberValue(item.salesTaxApplicable),
    salesTaxWithheldAtSource: numberValue(item.salesTaxWithheldAtSource),
    extraTax: emptyStringOrNumber(item.extraTax),
    furtherTax: numberValue(item.furtherTax),
    sroScheduleNo: stringValue(item.sroScheduleNo),
    fedPayable: numberValue(item.fedPayable),
    discount: numberValue(item.discount),
    saleType: stringValue(item.saleType, "Goods at standard rate (default)"),
    sroItemSerialNo: stringValue(item.sroItemSerialNo),
  };
}

function parseEnvironment(value: unknown): FbrEnvironment {
  return stringValue(value).toLowerCase() === "production" ? "production" : "sandbox";
}

function validatePath(environment: FbrEnvironment): string {
  return environment === "sandbox"
    ? "/di_data/v1/di/validateinvoicedata_sb"
    : "/di_data/v1/di/validateinvoicedata";
}

function stringValue(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function stringFrom(values: unknown[], fallback = ""): string {
  for (const value of values) {
    const parsed = stringValue(value);
    if (parsed) return parsed;
  }
  return fallback;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyStringOrNumber(value: unknown): string | number {
  const text = stringValue(value);
  return text ? numberValue(text) : "";
}

function rateValue(value: unknown): string {
  const text = stringValue(value);
  if (!text) return "0%";
  if (text.includes("%")) return text;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? `${parsed}%` : text;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDebitNote(invoiceType: string): boolean {
  return invoiceType.toLowerCase().includes("debit");
}

function badRequest(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function fbrHttpErrorMessage(status: number): string {
  if (status === 401) {
    return "FBR token is invalid or expired. Update the token in settings.";
  }

  if (status >= 500) {
    return "FBR server returned an error. Invoice data was not lost; retry after the service is available.";
  }

  return "FBR invoice request failed.";
}

function parseResponseBody(responseText: string): unknown {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function makeMockInvoiceNumber(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `000001${dd}${mm}${yy}${hh}${mi}${ss}-0001`;
}
