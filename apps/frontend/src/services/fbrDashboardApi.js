import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const dashboardApi = axios.create({
  baseURL: `${API_BASE_URL}/api/dashboard`,
});

dashboardApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function getDashboardInvoices(params = {}) {
  const response = await dashboardApi.get("/invoices", { params });
  return response.data.data || [];
}

export async function getDashboardSummary() {
  const response = await dashboardApi.get("/summary");
  return response.data.data;
}

export async function deleteDashboardInvoice(id) {
  await dashboardApi.delete(`/invoices/${id}`);
}

export async function getDashboardChartData(period = 'monthly') {
  const response = await dashboardApi.get('/charts', { params: { period } });
  return response.data.data?.data ?? [];
}
