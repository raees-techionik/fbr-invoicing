import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const productMappingsApi = axios.create({
  baseURL: `${API_BASE_URL}/api/products`,
});

productMappingsApi.interceptors.request.use(applyAuthContext);

export async function getProductMappings({ search = "", status = "", limit = 250 } = {}) {
  const response = await productMappingsApi.get("/", {
    params: {
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      limit,
    },
  });

  return response.data.data;
}

export async function getProductMapping(id) {
  const response = await productMappingsApi.get(`/${id}`);
  return response.data.data;
}

export async function createProductMapping(payload) {
  const response = await productMappingsApi.post("/", payload);
  return response.data.data;
}

export async function updateProductMapping(id, payload) {
  const response = await productMappingsApi.put(`/${id}`, payload);
  return response.data.data;
}

export async function deleteProductMapping(id) {
  const response = await productMappingsApi.delete(`/${id}`);
  return response.data.data;
}

export async function resolveHsInvoiceFields({ hsCode, saleType, invoiceDate, originationSupplier, annexureId }) {
  const response = await productMappingsApi.get("/resolve", {
    params: {
      hsCode,
      ...(saleType ? { saleType } : {}),
      ...(invoiceDate ? { invoiceDate } : {}),
      ...(originationSupplier ? { originationSupplier } : {}),
      ...(annexureId ? { annexureId } : {}),
    },
  });

  return response.data.data;
}
