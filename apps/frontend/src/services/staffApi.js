import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
const api = axios.create({ baseURL: `${API_BASE_URL}/api/staff-members` });

api.interceptors.request.use(applyAuthContext);

export const getStaffMembers = (params = {}) => api.get("/", { params }).then(r => r.data.data || []);
export const getStaffMember = (id) => api.get(`/${id}`).then(r => r.data.data);
export const createStaffMember = (data) => api.post("/", data).then(r => r.data.data);
export const updateStaffMember = (id, data) => api.put(`/${id}`, data).then(r => r.data.data);
export const deleteStaffMember = (id) => api.delete(`/${id}`).then(r => r.data.data);
