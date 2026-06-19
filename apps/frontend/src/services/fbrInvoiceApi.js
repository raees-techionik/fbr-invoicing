import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const invoiceApi = axios.create({
  baseURL: `${API_BASE_URL}/api/invoice`,
});
invoiceApi.interceptors.request.use(applyAuthContext);

const invoicesApi = axios.create({
  baseURL: `${API_BASE_URL}/api/invoices`,
});
invoicesApi.interceptors.request.use(applyAuthContext);

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
