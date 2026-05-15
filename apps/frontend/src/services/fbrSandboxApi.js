import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const sandboxApi = axios.create({
  baseURL: `${API_BASE_URL}/api/sandbox`,
});

sandboxApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function getSandboxScenarios() {
  const response = await sandboxApi.get("/scenarios");
  return response.data.data;
}

export async function getSandboxStatus() {
  const response = await sandboxApi.get("/status");
  return response.data.data;
}

export async function runAllScenarios(operation = "submit") {
  const response = await sandboxApi.post("/run", { operation });
  return response.data.data;
}

export async function runScenario(scenarioId, operation = "submit") {
  const response = await sandboxApi.post(`/run/${scenarioId}`, { operation });
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
