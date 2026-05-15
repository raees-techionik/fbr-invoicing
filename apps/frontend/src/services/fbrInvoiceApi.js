import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const authInterceptor = (config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};

const invoiceApi = axios.create({
  baseURL: `${API_BASE_URL}/api/invoice`,
});
invoiceApi.interceptors.request.use(authInterceptor);

const invoicesApi = axios.create({
  baseURL: `${API_BASE_URL}/api/invoices`,
});
invoicesApi.interceptors.request.use(authInterceptor);

export async function submitInvoice(invoicePayload) {
  const response = await invoiceApi.post("/submit", invoicePayload);
  return response.data.data;
}

export async function validateInvoice(invoicePayload) {
  const response = await invoiceApi.post("/validate", invoicePayload);
  return response.data.data;
}

export async function getInvoiceDetail(id) {
  const response = await invoicesApi.get(`/${id}`);
  return response.data.data;
}
