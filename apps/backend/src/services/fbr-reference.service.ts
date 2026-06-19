import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { getRuntimeFbrSettings } from "./fbr-settings.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockHsCodes: Array<{ hS_CODE: string; description: string }> = JSON.parse(
  readFileSync(join(__dirname, "../data/mock-hs-codes.json"), "utf-8"),
);

const DEFAULT_CACHE_TTL_SECONDS = Number(process.env.FBR_REFERENCE_CACHE_TTL_SECONDS ?? 86_400);
const FBR_BASE_URL = process.env.FBR_BASE_URL ?? "https://gw.fbr.gov.pk";
const FBR_REFERENCE_TOKEN =
  process.env.FBR_REFERENCE_API_TOKEN ?? process.env.FBR_API_TOKEN ?? process.env.FBR_SANDBOX_TOKEN ?? "";
const USE_MOCKS = process.env.FBR_REFERENCE_USE_MOCKS === "true";

type CacheableParams = Record<string, string | number | boolean | undefined>;
type ReferenceKey =
  | "provinces"
  | "documentTypes"
  | "itemDescriptions"
  | "uoms"
  | "sroItemCodes"
  | "transactionTypes"
  | "sroSchedules"
  | "saleTypeRates"
  | "hsUoms"
  | "sroItems"
  | "statl"
  | "registrationType";

interface EndpointDefinition {
  path: string;
  mockKey: keyof typeof mockReferenceData;
  normalize: (raw: RawRecord) => unknown;
  collection?: boolean;
}

interface ReferenceResult {
  key: ReferenceKey;
  source: "live" | "mock";
  cacheHit: boolean;
  fetchedAt: string;
  data: unknown;
  raw: unknown;
}

type RawRecord = Record<string, unknown>;

const mockReferenceData = {
  provinces: [
    { stateProvinceCode: 1, stateProvinceDesc: "AZAD KASHMIR" },
    { stateProvinceCode: 2, stateProvinceDesc: "BALOCHISTAN" },
    { stateProvinceCode: 3, stateProvinceDesc: "FATA" },
    { stateProvinceCode: 4, stateProvinceDesc: "ISLAMABAD CAPITAL TERRITORY" },
    { stateProvinceCode: 5, stateProvinceDesc: "GILGIT BALTISTAN" },
    { stateProvinceCode: 6, stateProvinceDesc: "KHYBER PAKHTUNKHWA" },
    { stateProvinceCode: 7, stateProvinceDesc: "PUNJAB" },
    { stateProvinceCode: 8, stateProvinceDesc: "SINDH" },
  ],
  documentTypes: [
    { docTypeId: 1, docDescription: "Credit Note" },
    { docTypeId: 4, docDescription: "Sale Invoice" },
    { docTypeId: 9, docDescription: "Debit Note" },
  ],
  itemDescriptions: mockHsCodes,
  uoms: [
    { uoM_ID: 1, description: "Each" },
    { uoM_ID: 2, description: "Dozen" },
    { uoM_ID: 3, description: "Gross" },
    { uoM_ID: 4, description: "Set" },
    { uoM_ID: 5, description: "Pair" },
    { uoM_ID: 6, description: "Box" },
    { uoM_ID: 7, description: "Carton" },
    { uoM_ID: 8, description: "Bundle" },
    { uoM_ID: 9, description: "Roll" },
    { uoM_ID: 10, description: "Metre" },
    { uoM_ID: 11, description: "Yard" },
    { uoM_ID: 12, description: "Foot" },
    { uoM_ID: 13, description: "KG" },
    { uoM_ID: 14, description: "Gram" },
    { uoM_ID: 15, description: "Metric Ton" },
    { uoM_ID: 16, description: "Litre" },
    { uoM_ID: 17, description: "Millilitre" },
    { uoM_ID: 18, description: "Centimetre" },
    { uoM_ID: 19, description: "Kilometre" },
    { uoM_ID: 20, description: "Square Feet" },
    { uoM_ID: 21, description: "Square Yard" },
    { uoM_ID: 22, description: "Cubic Metre" },
    { uoM_ID: 23, description: "Number" },
    { uoM_ID: 24, description: "Bag" },
    { uoM_ID: 25, description: "Sheet" },
    { uoM_ID: 26, description: "Gallon" },
    { uoM_ID: 27, description: "Quintal" },
    { uoM_ID: 28, description: "Troy Ounce" },
    { uoM_ID: 29, description: "Carat" },
    { uoM_ID: 77, description: "Square Metre" },
  ],
  sroItemCodes: [
    { srO_ITEM_ID: 724, srO_ITEM_DESC: "9" },
    { srO_ITEM_ID: 728, srO_ITEM_DESC: "1" },
    { srO_ITEM_ID: 730, srO_ITEM_DESC: "2" },
    { srO_ITEM_ID: 732, srO_ITEM_DESC: "3" },
    { srO_ITEM_ID: 736, srO_ITEM_DESC: "4" },
    { srO_ITEM_ID: 740, srO_ITEM_DESC: "5" },
  ],
  transactionTypes: [
    { transactioN_TYPE_ID: 75, transactioN_DESC: "Goods at standard rate (default)" },
    { transactioN_TYPE_ID: 76, transactioN_DESC: "Services subject to sales tax" },
    { transactioN_TYPE_ID: 77, transactioN_DESC: "FED in ST Mode (Services)" },
    { transactioN_TYPE_ID: 78, transactioN_DESC: "FED in ST Mode (Goods)" },
    { transactioN_TYPE_ID: 79, transactioN_DESC: "Exempt Goods" },
    { transactioN_TYPE_ID: 80, transactioN_DESC: "Goods at Reduced Rate" },
    { transactioN_TYPE_ID: 81, transactioN_DESC: "Zero-Rated Goods" },
    { transactioN_TYPE_ID: 82, transactioN_DESC: "Goods under Third Schedule" },
    { transactioN_TYPE_ID: 83, transactioN_DESC: "Further Tax" },
  ],
  sroSchedules: [
    { srO_ID: 5, srO_DESC: "3rd Schedule (Special goods)" },
    { srO_ID: 6, srO_DESC: "6th Schedule (Exempt goods)" },
    { srO_ID: 7, srO_DESC: "Zero Rated Gas" },
    { srO_ID: 8, srO_DESC: "5th Schedule (Zero-rated goods)" },
    { srO_ID: 9, srO_DESC: "8th Schedule (Reduced rate goods)" },
    { srO_ID: 10, srO_DESC: "9th Schedule" },
    { srO_ID: 11, srO_DESC: "SRO 487(I)/2006" },
    { srO_ID: 12, srO_DESC: "SRO 550(I)/2006" },
  ],
  saleTypeRates: [
    { ratE_ID: 734, ratE_DESC: "18%", ratE_VALUE: 18 },
    { ratE_ID: 735, ratE_DESC: "17%", ratE_VALUE: 17 },
    { ratE_ID: 736, ratE_DESC: "16%", ratE_VALUE: 16 },
    { ratE_ID: 737, ratE_DESC: "15%", ratE_VALUE: 15 },
    { ratE_ID: 738, ratE_DESC: "12%", ratE_VALUE: 12 },
    { ratE_ID: 739, ratE_DESC: "10%", ratE_VALUE: 10 },
    { ratE_ID: 740, ratE_DESC: "8%", ratE_VALUE: 8 },
    { ratE_ID: 741, ratE_DESC: "5%", ratE_VALUE: 5 },
    { ratE_ID: 742, ratE_DESC: "3%", ratE_VALUE: 3 },
    { ratE_ID: 743, ratE_DESC: "2%", ratE_VALUE: 2 },
    { ratE_ID: 744, ratE_DESC: "1.5%", ratE_VALUE: 1.5 },
    { ratE_ID: 745, ratE_DESC: "1%", ratE_VALUE: 1 },
    { ratE_ID: 280, ratE_DESC: "0%", ratE_VALUE: 0 },
  ],
  hsUoms: [
    { uoM_ID: 13, description: "KG" },
    { uoM_ID: 16, description: "Litre" },
    { uoM_ID: 23, description: "Number" },
    { uoM_ID: 77, description: "Square Metre" },
  ],
  sroItems: [
    { srO_ITEM_ID: 17853, srO_ITEM_DESC: "50" },
    { srO_ITEM_ID: 17854, srO_ITEM_DESC: "51" },
    { srO_ITEM_ID: 17855, srO_ITEM_DESC: "52" },
    { srO_ITEM_ID: 17856, srO_ITEM_DESC: "53" },
    { srO_ITEM_ID: 17857, srO_ITEM_DESC: "54" },
  ],
  statl: {
    "status code": "01",
    status: "In-Active",
  },
  registrationType: {
    statuscode: "00",
    REGISTRATION_NO: "0788762",
    REGISTRATION_TYPE: "Registered",
  },
};

const endpoints: Record<ReferenceKey, EndpointDefinition> = {
  provinces: {
    path: "/pdi/v1/provinces",
    mockKey: "provinces",
    normalize: normalizeProvince,
  },
  documentTypes: {
    path: "/pdi/v1/doctypecode",
    mockKey: "documentTypes",
    normalize: normalizeDocumentType,
  },
  itemDescriptions: {
    path: "/pdi/v1/itemdesccode",
    mockKey: "itemDescriptions",
    normalize: normalizeItemDescription,
  },
  uoms: {
    path: "/pdi/v1/uom",
    mockKey: "uoms",
    normalize: normalizeUom,
  },
  sroItemCodes: {
    path: "/pdi/v1/sroitemcode",
    mockKey: "sroItemCodes",
    normalize: normalizeSroItem,
  },
  transactionTypes: {
    path: "/pdi/v1/transtypecode",
    mockKey: "transactionTypes",
    normalize: normalizeTransactionType,
  },
  sroSchedules: {
    path: "/pdi/v1/SroSchedule",
    mockKey: "sroSchedules",
    normalize: normalizeSroSchedule,
  },
  saleTypeRates: {
    path: "/pdi/v2/SaleTypeToRate",
    mockKey: "saleTypeRates",
    normalize: normalizeSaleTypeRate,
  },
  hsUoms: {
    path: "/pdi/v2/HS_UOM",
    mockKey: "hsUoms",
    normalize: normalizeUom,
  },
  sroItems: {
    path: "/pdi/v2/SROItem",
    mockKey: "sroItems",
    normalize: normalizeSroItem,
  },
  statl: {
    path: "/dist/v1/statl",
    mockKey: "statl",
    normalize: normalizeStatl,
    collection: false,
  },
  registrationType: {
    path: "/dist/v1/Get_Reg_Type",
    mockKey: "registrationType",
    normalize: normalizeRegistrationType,
    collection: false,
  },
};

export async function getProvinces(companyId: string, forceRefresh = false): Promise<ReferenceResult> {
  return getReferenceData(companyId, "provinces", {}, forceRefresh);
}

export async function getDocumentTypes(companyId: string, forceRefresh = false): Promise<ReferenceResult> {
  return getReferenceData(companyId, "documentTypes", {}, forceRefresh);
}

export async function getItemDescriptions(companyId: string, forceRefresh = false): Promise<ReferenceResult> {
  return getReferenceData(companyId, "itemDescriptions", {}, forceRefresh);
}

export async function getUoms(companyId: string, forceRefresh = false): Promise<ReferenceResult> {
  return getReferenceData(companyId, "uoms", {}, forceRefresh);
}

export async function getSroItemCodes(companyId: string, forceRefresh = false): Promise<ReferenceResult> {
  return getReferenceData(companyId, "sroItemCodes", {}, forceRefresh);
}

export async function getTransactionTypes(companyId: string, forceRefresh = false): Promise<ReferenceResult> {
  return getReferenceData(companyId, "transactionTypes", {}, forceRefresh);
}

export async function getSroSchedules(companyId: string, params: {
  rateId: string;
  date: string;
  originationSupplier: string;
  forceRefresh?: boolean;
}): Promise<ReferenceResult> {
  return getReferenceData(
    companyId,
    "sroSchedules",
    {
      rate_id: params.rateId,
      date: params.date,
      origination_supplier: params.originationSupplier,
    },
    params.forceRefresh,
  );
}

export async function getSaleTypeRates(companyId: string, params: {
  transTypeId: string;
  date: string;
  originationSupplier: string;
  forceRefresh?: boolean;
}): Promise<ReferenceResult> {
  return getReferenceData(
    companyId,
    "saleTypeRates",
    {
      transTypeId: params.transTypeId,
      date: params.date,
      originationSupplier: params.originationSupplier,
    },
    params.forceRefresh,
  );
}

export async function getHsUoms(companyId: string, params: {
  hsCode: string;
  annexureId: string;
  forceRefresh?: boolean;
}): Promise<ReferenceResult> {
  return getReferenceData(
    companyId,
    "hsUoms",
    {
      hs_code: params.hsCode,
      annexure_id: params.annexureId,
    },
    params.forceRefresh,
  );
}

export async function getSroItems(companyId: string, params: {
  date: string;
  sroId: string;
  forceRefresh?: boolean;
}): Promise<ReferenceResult> {
  return getReferenceData(
    companyId,
    "sroItems",
    {
      date: params.date,
      sro_id: params.sroId,
    },
    params.forceRefresh,
  );
}

export async function getStatl(companyId: string, params: {
  regno: string;
  date: string;
  forceRefresh?: boolean;
}): Promise<ReferenceResult> {
  return getReferenceData(companyId, "statl", { regno: params.regno, date: params.date }, params.forceRefresh);
}

export async function getRegistrationType(companyId: string, params: {
  registrationNo: string;
  forceRefresh?: boolean;
}): Promise<ReferenceResult> {
  return getReferenceData(
    companyId,
    "registrationType",
    { Registration_No: params.registrationNo },
    params.forceRefresh,
  );
}

export async function getReferenceBootstrap(companyId: string, forceRefresh = false): Promise<Record<string, ReferenceResult>> {
  const [
    provinces,
    documentTypes,
    itemDescriptions,
    uoms,
    sroItemCodes,
    transactionTypes,
  ] = await Promise.all([
    getProvinces(companyId, forceRefresh),
    getDocumentTypes(companyId, forceRefresh),
    getItemDescriptions(companyId, forceRefresh),
    getUoms(companyId, forceRefresh),
    getSroItemCodes(companyId, forceRefresh),
    getTransactionTypes(companyId, forceRefresh),
  ]);

  return {
    provinces,
    documentTypes,
    itemDescriptions,
    uoms,
    sroItemCodes,
    transactionTypes,
  };
}

async function getReferenceData(
  companyId: string,
  key: ReferenceKey,
  params: CacheableParams,
  forceRefresh = false,
): Promise<ReferenceResult> {
  const cacheKey = buildCacheKey(key, params);

  if (!forceRefresh) {
    const cached = await readCachedReference(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true };
    }
  }

  const definition = endpoints[key];
  const raw = USE_MOCKS ? cloneMockPayload(definition.mockKey) : await fetchFromFbr(companyId, definition.path, params);
  const normalized = normalizeResponse(raw, definition);

  const result: ReferenceResult = {
    key,
    source: USE_MOCKS ? "mock" : "live",
    cacheHit: false,
    fetchedAt: new Date().toISOString(),
    data: normalized,
    raw,
  };

  await writeCachedReference(cacheKey, result);
  return result;
}

async function readCachedReference(cacheKey: string): Promise<ReferenceResult | undefined> {
  const cached = await prisma.referenceCache.findUnique({
    where: {
      cacheKey,
    },
  });

  if (!cached || cached.expiresAt <= new Date()) {
    return undefined;
  }

  return cached.data as unknown as ReferenceResult;
}

async function writeCachedReference(cacheKey: string, result: ReferenceResult): Promise<void> {
  const fetchedAt = new Date(result.fetchedAt);
  const expiresAt = addSeconds(fetchedAt, DEFAULT_CACHE_TTL_SECONDS);
  const data = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;

  await prisma.referenceCache.upsert({
    where: {
      cacheKey,
    },
    create: {
      cacheKey,
      data,
      fetchedAt,
      expiresAt,
    },
    update: {
      data,
      fetchedAt,
      expiresAt,
    },
  });
}

async function fetchFromFbr(companyId: string, path: string, params: CacheableParams): Promise<unknown> {
  const url = new URL(path, FBR_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const runtimeSettings = await getRuntimeFbrSettings(companyId);
  const token = runtimeSettings.activeToken || FBR_REFERENCE_TOKEN;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const error = new Error(
      `FBR reference API failed for ${path}: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ""}`,
    ) as Error & { status?: number };
    error.status = response.status === 401 ? 401 : 502;
    throw error;
  }

  return response.json();
}

function normalizeResponse(raw: unknown, definition: EndpointDefinition): unknown {
  if (definition.collection === false) {
    return definition.normalize(asRecord(raw));
  }

  const items = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw).data)
      ? (asRecord(raw).data as unknown[])
      : [];

  return items.map((item) => definition.normalize(asRecord(item)));
}

function buildCacheKey(key: ReferenceKey, params: CacheableParams): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([paramKey, value]) => `${paramKey}=${String(value)}`)
    .join("&");

  return query ? `fbr:reference:${key}?${query}` : `fbr:reference:${key}`;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function cloneMockPayload(mockKey: keyof typeof mockReferenceData): unknown {
  return JSON.parse(JSON.stringify(mockReferenceData[mockKey])) as unknown;
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function stringValue(raw: RawRecord, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
}

function normalizeProvince(raw: RawRecord) {
  return {
    code: stringValue(raw, ["stateProvinceCode", "StateProvinceCode", "code"]),
    description: stringValue(raw, ["stateProvinceDesc", "StateProvinceDesc", "description"]),
    raw,
  };
}

function normalizeDocumentType(raw: RawRecord) {
  return {
    id: stringValue(raw, ["docTypeId", "DocTypeId", "id"]),
    description: stringValue(raw, ["docDescription", "DocDescription", "description"]),
    raw,
  };
}

function normalizeItemDescription(raw: RawRecord) {
  return {
    hsCode: stringValue(raw, ["hS_CODE", "HS_CODE", "hsCode", "code"]),
    description: stringValue(raw, ["description", "Description"]),
    raw,
  };
}

function normalizeUom(raw: RawRecord) {
  return {
    id: stringValue(raw, ["uoM_ID", "UOM_ID", "id"]),
    description: stringValue(raw, ["description", "Description"]),
    raw,
  };
}

function normalizeSroItem(raw: RawRecord) {
  return {
    id: stringValue(raw, ["srO_ITEM_ID", "SRO_ITEM_ID", "id"]),
    description: stringValue(raw, ["srO_ITEM_DESC", "SRO_ITEM_DESC", "description"]),
    raw,
  };
}

function normalizeTransactionType(raw: RawRecord) {
  return {
    id: stringValue(raw, ["transactioN_TYPE_ID", "TRANSACTION_TYPE_ID", "id"]),
    description: stringValue(raw, ["transactioN_DESC", "TRANSACTION_DESC", "description"]),
    raw,
  };
}

function normalizeSroSchedule(raw: RawRecord) {
  return {
    id: stringValue(raw, ["srO_ID", "SRO_ID", "id"]),
    description: stringValue(raw, ["srO_DESC", "SRO_DESC", "description"]),
    raw,
  };
}

function normalizeSaleTypeRate(raw: RawRecord) {
  return {
    id: stringValue(raw, ["ratE_ID", "RATE_ID", "id"]),
    description: stringValue(raw, ["ratE_DESC", "RATE_DESC", "description"]),
    value: stringValue(raw, ["ratE_VALUE", "RATE_VALUE", "value"]),
    raw,
  };
}

function normalizeStatl(raw: RawRecord) {
  const status = stringValue(raw, ["status", "Status"]);

  return {
    statusCode: stringValue(raw, ["status code", "statusCode", "StatusCode"]),
    status,
    isActive: status.toLowerCase() === "active",
    raw,
  };
}

function normalizeRegistrationType(raw: RawRecord) {
  const registrationType = stringValue(raw, ["REGISTRATION_TYPE", "registrationType"]);

  return {
    statusCode: stringValue(raw, ["statuscode", "statusCode", "StatusCode"]),
    registrationNo: stringValue(raw, ["REGISTRATION_NO", "registrationNo"]),
    registrationType,
    isRegistered: registrationType.toLowerCase() === "registered",
    raw,
  };
}
