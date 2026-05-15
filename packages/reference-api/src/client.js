import { MemoryCache } from "./cache.js";
import { mockReferenceData } from "./mock-data.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const endpointDefinitions = {
  provinces: {
    path: "/pdi/v1/provinces",
    mockKey: "provinces",
    normalize: normalizeProvince
  },
  documentTypes: {
    path: "/pdi/v1/doctypecode",
    mockKey: "documentTypes",
    normalize: normalizeDocumentType
  },
  itemDescriptions: {
    path: "/pdi/v1/itemdesccode",
    mockKey: "itemDescriptions",
    normalize: normalizeItemDescription
  },
  sroItemCodes: {
    path: "/pdi/v1/sroitemcode",
    mockKey: "sroItemCodes",
    normalize: normalizeSroItem
  },
  transactionTypes: {
    path: "/pdi/v1/transtypecode",
    mockKey: "transactionTypes",
    normalize: normalizeTransactionType
  },
  uoms: {
    path: "/pdi/v1/uom",
    mockKey: "uoms",
    normalize: normalizeUom
  },
  sroSchedules: {
    path: "/pdi/v1/SroSchedule",
    mockKey: "sroSchedules",
    normalize: normalizeSroSchedule
  },
  saleTypeRates: {
    path: "/pdi/v2/SaleTypeToRate",
    mockKey: "saleTypeRates",
    normalize: normalizeSaleTypeRate
  },
  hsUoms: {
    path: "/pdi/v2/HS_UOM",
    mockKey: "hsUoms",
    normalize: normalizeUom
  },
  sroItems: {
    path: "/pdi/v2/SROItem",
    mockKey: "sroItems",
    normalize: normalizeSroItem
  },
  statl: {
    path: "/dist/v1/statl",
    mockKey: "statl",
    normalize: normalizeStatl,
    collection: false
  },
  registrationType: {
    path: "/dist/v1/Get_Reg_Type",
    mockKey: "registrationType",
    normalize: normalizeRegistrationType,
    collection: false
  }
};

export function createReferenceApiClient({
  token = "",
  baseUrl = "https://gw.fbr.gov.pk",
  cache = new MemoryCache(),
  fetchImpl = globalThis.fetch,
  useMocks = false,
  defaultCacheTtlMs = DAY_IN_MS
} = {}) {
  if (!useMocks && typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required when mocks are disabled.");
  }

  async function requestReferenceData(name, { params = {}, forceRefresh = false, ttlMs } = {}) {
    const definition = endpointDefinitions[name];

    if (!definition) {
      throw new Error(`Unknown FBR reference API endpoint: ${name}`);
    }

    const cacheKey = buildCacheKey(name, params);
    const effectiveTtl = ttlMs ?? defaultCacheTtlMs;

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const rawPayload = useMocks
      ? cloneMockPayload(definition.mockKey)
      : await fetchJson({
          fetchImpl,
          token,
          baseUrl,
          path: definition.path,
          params
        });

    const normalized = definition.collection === false
      ? definition.normalize(rawPayload)
      : rawPayload.map((item) => definition.normalize(item));

    const result = {
      source: useMocks ? "mock" : "live",
      fetchedAt: new Date().toISOString(),
      raw: rawPayload,
      data: normalized
    };

    cache.set(cacheKey, result, effectiveTtl);

    return result;
  }

  return {
    getProvinces(options) {
      return requestReferenceData("provinces", options);
    },

    getDocumentTypes(options) {
      return requestReferenceData("documentTypes", options);
    },

    getItemDescriptions(options) {
      return requestReferenceData("itemDescriptions", options);
    },

    getSroItemCodes(options) {
      return requestReferenceData("sroItemCodes", options);
    },

    getTransactionTypes(options) {
      return requestReferenceData("transactionTypes", options);
    },

    getUoms(options) {
      return requestReferenceData("uoms", options);
    },

    getSroSchedules({ rateId, date, originationSupplierCsv, forceRefresh = false, ttlMs } = {}) {
      requireFields(
        { rateId, date, originationSupplierCsv },
        ["rateId", "date", "originationSupplierCsv"],
        "getSroSchedules"
      );

      return requestReferenceData("sroSchedules", {
        params: {
          rate_id: rateId,
          date,
          origination_supplier_csv: originationSupplierCsv
        },
        forceRefresh,
        ttlMs
      });
    },

    getSaleTypeRates({ date, transactionTypeId, originationSupplier, forceRefresh = false, ttlMs } = {}) {
      requireFields(
        { date, transactionTypeId, originationSupplier },
        ["date", "transactionTypeId", "originationSupplier"],
        "getSaleTypeRates"
      );

      return requestReferenceData("saleTypeRates", {
        params: {
          date,
          transTypeId: transactionTypeId,
          originationSupplier
        },
        forceRefresh,
        ttlMs
      });
    },

    getHsUoms({ hsCode, annexureId, forceRefresh = false, ttlMs } = {}) {
      requireFields({ hsCode, annexureId }, ["hsCode", "annexureId"], "getHsUoms");

      return requestReferenceData("hsUoms", {
        params: {
          hs_code: hsCode,
          annexure_id: annexureId
        },
        forceRefresh,
        ttlMs
      });
    },

    getSroItems({ date, sroId, forceRefresh = false, ttlMs } = {}) {
      requireFields({ date, sroId }, ["date", "sroId"], "getSroItems");

      return requestReferenceData("sroItems", {
        params: {
          date,
          sro_id: sroId
        },
        forceRefresh,
        ttlMs
      });
    },

    getStatl({ regno, date, forceRefresh = false, ttlMs } = {}) {
      requireFields({ regno, date }, ["regno", "date"], "getStatl");

      return requestReferenceData("statl", {
        params: { regno, date },
        forceRefresh,
        ttlMs
      });
    },

    getRegistrationType({ registrationNo, forceRefresh = false, ttlMs } = {}) {
      requireFields({ registrationNo }, ["registrationNo"], "getRegistrationType");

      return requestReferenceData("registrationType", {
        params: {
          Registration_No: registrationNo
        },
        forceRefresh,
        ttlMs
      });
    },

    clearCache() {
      cache.clear();
    }
  };
}

async function fetchJson({ fetchImpl, token, baseUrl, path, params }) {
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const details = await safeReadText(response);
    throw new Error(`FBR reference API request failed (${response.status} ${response.statusText}): ${details}`);
  }

  return response.json();
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "Unable to read response body";
  }
}

function buildCacheKey(name, params) {
  const serializedParams = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return serializedParams ? `${name}?${serializedParams}` : name;
}

function cloneMockPayload(mockKey) {
  return structuredClone(mockReferenceData[mockKey]);
}

function requireFields(values, fields, methodName) {
  const missing = fields.filter((field) => values[field] === undefined || values[field] === null || values[field] === "");

  if (missing.length > 0) {
    throw new Error(`${methodName} is missing required fields: ${missing.join(", ")}`);
  }
}

function normalizeProvince(raw) {
  return {
    code: raw.stateProvinceCode,
    description: raw.stateProvinceDesc,
    raw
  };
}

function normalizeDocumentType(raw) {
  return {
    id: raw.docTypeId,
    description: raw.docDescription,
    raw
  };
}

function normalizeItemDescription(raw) {
  return {
    hsCode: raw.hS_CODE,
    description: raw.description,
    raw
  };
}

function normalizeSroItem(raw) {
  return {
    id: raw.srO_ITEM_ID,
    description: raw.srO_ITEM_DESC,
    raw
  };
}

function normalizeTransactionType(raw) {
  return {
    id: raw.transactioN_TYPE_ID,
    description: raw.transactioN_DESC,
    raw
  };
}

function normalizeUom(raw) {
  return {
    id: raw.uoM_ID,
    description: raw.description,
    raw
  };
}

function normalizeSroSchedule(raw) {
  return {
    id: raw.srO_ID,
    description: raw.srO_DESC,
    raw
  };
}

function normalizeSaleTypeRate(raw) {
  return {
    id: raw.ratE_ID,
    description: raw.ratE_DESC,
    value: raw.ratE_VALUE,
    raw
  };
}

function normalizeStatl(raw) {
  return {
    statusCode: raw["status code"],
    status: raw.status,
    isActive: String(raw.status).toLowerCase() === "active",
    raw
  };
}

function normalizeRegistrationType(raw) {
  const registrationType = raw.REGISTRATION_TYPE;

  return {
    statusCode: raw.statuscode,
    registrationNo: raw.REGISTRATION_NO,
    registrationType,
    isRegistered: String(registrationType).toLowerCase() === "registered",
    raw
  };
}
