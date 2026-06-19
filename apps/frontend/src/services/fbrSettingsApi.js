import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const settingsApi = axios.create({
  baseURL: `${API_BASE_URL}/api/token`,
});

settingsApi.interceptors.request.use(applyAuthContext);

export async function getFbrSettings({ checkLive = false } = {}) {
  const response = await settingsApi.get("/", {
    params: checkLive ? { checkLive: "true" } : undefined,
  });
  return response.data.data;
}

export async function updateFbrSettings(payload) {
  const response = await settingsApi.put("/", payload);
  return response.data.data;
}

export async function getFbrTokenStatusSummary({ checkLive = false } = {}) {
  const response = await settingsApi.get("/status", {
    params: checkLive ? { checkLive: "true" } : undefined,
  });
  return response.data.data;
}

export async function getFbrTokenStatus({ environment, checkLive = false }) {
  const response = await settingsApi.get("/token-status", {
    params: {
      environment,
      ...(checkLive ? { checkLive: "true" } : {}),
    },
  });
  return response.data.data;
}

export async function getFbrOutboundIp() {
  const response = await settingsApi.get("/outbound-ip");
  return response.data.data;
}
