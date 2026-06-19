export const ACTIVE_COMPANY_KEY = "activeCompanyId";

export function getActiveCompanyId() {
  return localStorage.getItem(ACTIVE_COMPANY_KEY);
}

export function setActiveCompanyId(companyId) {
  if (companyId) localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
  else localStorage.removeItem(ACTIVE_COMPANY_KEY);
}

export function clearCompanySession() {
  localStorage.removeItem(ACTIVE_COMPANY_KEY);
}

export function applyAuthContext(config) {
  const token = localStorage.getItem("token");
  const companyId = getActiveCompanyId();

  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (companyId && !config.skipCompany) config.headers["X-Company-Id"] = companyId;
  return config;
}
