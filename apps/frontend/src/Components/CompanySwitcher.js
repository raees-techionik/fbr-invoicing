import { FiBriefcase, FiChevronDown } from "react-icons/fi";
import { useCompany } from "../contexts/CompanyContext";

function CompanySwitcher({ isCollapsed }) {
  const { companies, activeCompany, loading, switchCompany, isSuperAdmin } = useCompany();
  const role = activeCompany?.role || activeCompany?.membershipRole;
  const companyType = activeCompany?.kind === "BUSINESS" ? "Business" : "Personal";
  const status = activeCompany?.onboardingStatus?.toLowerCase().replaceAll("_", " ");

  if (isCollapsed) {
    return (
      <div className="company-switcher company-switcher--collapsed" title={activeCompany?.name || "Company"}>
        <FiBriefcase />
      </div>
    );
  }

  return (
    <label className="company-switcher">
      <span className="company-switcher__label">Active company</span>
      <span className="company-switcher__control">
        <FiBriefcase />
        <select
          aria-label="Active company"
          value={activeCompany?.id || ""}
          onChange={event => switchCompany(event.target.value)}
          disabled={loading || companies.length === 0}
        >
          {companies.length === 0 && <option value="">No companies</option>}
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
        <FiChevronDown aria-hidden="true" />
      </span>
      {activeCompany && (
        <span className="company-switcher__meta">
          {companyType}
          {role ? ` - ${role.toLowerCase()}` : isSuperAdmin ? " - platform access" : ""}
          {status ? ` - ${status}` : ""}
        </span>
      )}
    </label>
  );
}

export default CompanySwitcher;
