import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
const api = axios.create({ baseURL: `${API_BASE_URL}/api/services` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getServices = (params = {}) => api.get("/", { params }).then(r => r.data.data || []);
export const getService = (id) => api.get(`/${id}`).then(r => r.data.data);
export const createService = (data) => api.post("/", data).then(r => r.data.data);
export const updateService = (id, data) => api.put(`/${id}`, data).then(r => r.data.data);
export const deleteService = (id) => api.delete(`/${id}`).then(r => r.data.data);
