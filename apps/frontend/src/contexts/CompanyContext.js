import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCompanies, getCurrentUser, setDefaultCompany } from "../services/companyApi";
import { getActiveCompanyId, setActiveCompanyId } from "../services/companySession";

const CompanyContext = createContext(null);

function normalizeCompany(company) {
  if (!company) return null;
  const role = company.role || company.membershipRole || null;
  return { ...company, role, membershipRole: role };
}

export function CompanyProvider({ children }) {
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("token")));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }

    setError("");
    try {
      const profile = await getCurrentUser();
      const allCompanies = await getCompanies(Boolean(profile.isSuperAdmin));
      const normalizedCompanies = allCompanies.map(normalizeCompany);
      const requestedId = getActiveCompanyId();
      const selected = normalizedCompanies.find(company => company.id === requestedId)
        || normalizedCompanies.find(company => company.id === profile.activeCompany?.id)
        || normalizedCompanies.find(company => company.isDefault)
        || normalizedCompanies[0]
        || null;

      if (selected) setActiveCompanyId(selected.id);
      setUser(profile);
      setCompanies(normalizedCompanies);
      setActiveCompany(selected);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to load company access.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const switchCompany = useCallback(async (companyId) => {
    if (!companyId || companyId === activeCompany?.id) return;
    const nextCompany = normalizeCompany(companies.find(company => company.id === companyId));
    if (!nextCompany) return;

    if (nextCompany.role) {
      await setDefaultCompany(companyId);
    }
    setActiveCompanyId(companyId);
    setActiveCompany(nextCompany);
    window.location.reload();
  }, [activeCompany?.id, companies]);

  const value = useMemo(() => ({
    user,
    companies,
    activeCompany,
    loading,
    error,
    isSuperAdmin: Boolean(user?.isSuperAdmin),
    canManageCompany: Boolean(user?.isSuperAdmin || ["OWNER", "ADMIN"].includes(activeCompany?.role || activeCompany?.membershipRole)),
    refresh,
    switchCompany,
  }), [user, companies, activeCompany, loading, error, refresh, switchCompany]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("useCompany must be used within CompanyProvider");
  return context;
}
