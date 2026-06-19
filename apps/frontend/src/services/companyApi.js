import axios from "axios";
import { applyAuthContext } from "./companySession";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
const api = axios.create({ baseURL: `${API_BASE_URL}/api` });

api.interceptors.request.use(applyAuthContext);

const data = (response) => response.data.data;

export const getCurrentUser = () => api.get("/auth/me", { skipCompany: true }).then(response => response.data);
export const getCompanies = (includeAll = false) => api.get("/companies", { params: includeAll ? { all: "true" } : undefined }).then(data);
export const getCurrentCompany = () => api.get("/companies/current").then(data);
export const createCompany = (payload) => api.post("/companies", payload).then(data);
export const updateCurrentCompany = (payload) => api.patch("/companies/current", payload).then(data);
export const setDefaultCompany = (companyId) => api.patch(`/companies/${companyId}/default`).then(data);

export const getCompanyMembers = () => api.get("/companies/current/members").then(data);
export const updateCompanyMember = (membershipId, payload) => api.patch(`/companies/current/members/${membershipId}`, payload).then(data);
export const removeCompanyMember = (membershipId) => api.delete(`/companies/current/members/${membershipId}`).then(data);

export const getCompanyInvitations = () => api.get("/companies/current/invitations").then(data);
export const inviteCompanyMember = (payload) => api.post("/companies/current/invitations", payload).then(data);
export const revokeCompanyInvitation = (invitationId) => api.delete(`/companies/current/invitations/${invitationId}`).then(data);
export const acceptCompanyInvitation = (token, makeDefault = true) => api.post(`/companies/invitations/${token}/accept`, { makeDefault }).then(data);

export const getCompanyOnboarding = () => api.get("/companies/current/onboarding").then(data);
export const updateCompanyOnboarding = (payload) => api.patch("/companies/current/onboarding", payload).then(data);
export const getCompanyActivity = (limit = 50) => api.get("/companies/current/activity", { params: { limit } }).then(data);
