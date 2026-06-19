import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const sandboxApi = axios.create({
  baseURL: `${API_BASE_URL}/api/sandbox`,
});

sandboxApi.interceptors.request.use(applyAuthContext);

export async function getSandboxScenarios() {
  const response = await sandboxApi.get("/scenarios");
  return response.data.data;
}

export async function getSandboxStatus() {
  const response = await sandboxApi.get("/status");
  return response.data.data;
}

export async function getSandboxPreflight() {
  const response = await sandboxApi.get("/preflight");
  return response.data.data;
}

export async function runAllScenarios(operation = "submit", settings = {}) {
  const response = await sandboxApi.post("/run", { operation, settings });
  return response.data.data;
}

export async function runScenario(scenarioId, operation = "submit", settings = {}) {
  const response = await sandboxApi.post(`/run/${scenarioId}`, { operation, settings });
  return response.data.data;
}

export async function getSandboxResults() {
  const response = await sandboxApi.get("/results");
  return response.data.data;
}

export async function getSandboxSummary() {
  const response = await sandboxApi.get("/summary");
  return response.data.data;
}

export async function clearSandboxResults() {
  const response = await sandboxApi.delete("/results");
  return response.data.data;
}
