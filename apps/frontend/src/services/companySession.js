export const ACTIVE_COMPANY_KEY = "activeCompanyId";

// "Remember me" support: the token lives in localStorage (persists across
// browser restarts) when the user opted in at login, otherwise sessionStorage
// (cleared when the browser/tab closes). Token reads always check both so a
// single helper works regardless of which one a given session used.
export function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export function setToken(token, persist = true) {
  if (persist) {
    localStorage.setItem("token", token);
    sessionStorage.removeItem("token");
  } else {
    sessionStorage.setItem("token", token);
    localStorage.removeItem("token");
  }
}

export function clearToken() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
}

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
  const token = getToken();
  const companyId = getActiveCompanyId();

  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (companyId && !config.skipCompany) config.headers["X-Company-Id"] = companyId;
  return config;
}
