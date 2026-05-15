import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
const api = axios.create({ baseURL: `${API_BASE_URL}/api/company-profile` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getCompanyProfile = () => api.get("/").then(r => r.data.data);
export const updateCompanyProfile = (data) => api.put("/", data).then(r => r.data.data);
