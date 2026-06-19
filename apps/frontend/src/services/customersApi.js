import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
const api = axios.create({ baseURL: `${API_BASE_URL}/api/customers` });

api.interceptors.request.use(applyAuthContext);

export const getCustomers = (params = {}) => api.get("/", { params }).then(r => r.data.data || []);
export const getCustomer = (id) => api.get(`/${id}`).then(r => r.data.data);
export const createCustomer = (data) => api.post("/", data).then(r => r.data.data);
export const updateCustomer = (id, data) => api.put(`/${id}`, data).then(r => r.data.data);
export const deleteCustomer = (id) => api.delete(`/${id}`).then(r => r.data.data);
