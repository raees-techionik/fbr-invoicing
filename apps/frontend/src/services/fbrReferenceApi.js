import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const referenceApi = axios.create({
  baseURL: `${API_BASE_URL}/api/ref`,
});

referenceApi.interceptors.request.use(applyAuthContext);

export async function getFbrReferenceBootstrap({ forceRefresh = false } = {}) {
  const response = await referenceApi.get("/bootstrap", {
    params: forceRefresh ? { forceRefresh: "true" } : undefined,
  });

  return response.data.data;
}

export async function getFbrSroSchedules({ rateId, date, originationSupplier, forceRefresh = false }) {
  const response = await referenceApi.get("/sroschedule", {
    params: {
      rate_id: rateId,
      date,
      origination_supplier: originationSupplier,
      ...(forceRefresh ? { forceRefresh: "true" } : {}),
    },
  });

  return response.data;
}

export async function getFbrTaxRates({ transTypeId, date, originationSupplier, forceRefresh = false }) {
  const response = await referenceApi.get("/rates", {
    params: {
      transTypeId,
      date,
      originationSupplier,
      ...(forceRefresh ? { forceRefresh: "true" } : {}),
    },
  });

  return response.data;
}

export async function getFbrHsUoms({ hsCode, annexureId, forceRefresh = false }) {
  const response = await referenceApi.get("/hsuom", {
    params: {
      hs_code: hsCode,
      annexure_id: annexureId,
      ...(forceRefresh ? { forceRefresh: "true" } : {}),
    },
  });

  return response.data;
}

export async function getFbrSroItems({ date, sroId, forceRefresh = false }) {
  const response = await referenceApi.get("/sroitem", {
    params: {
      date,
      sro_id: sroId,
      ...(forceRefresh ? { forceRefresh: "true" } : {}),
    },
  });

  return response.data;
}
