import { useEffect, useRef, useState } from "react";
import { FiBriefcase, FiChevronDown } from "react-icons/fi";
import { useCompany } from "../contexts/CompanyContext";

function CompanySwitcher({ isCollapsed }) {
  const { companies, activeCompany, loading, switchCompany, isSuperAdmin } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef(null);
  const role = activeCompany?.role || activeCompany?.membershipRole;
  const companyType = activeCompany?.kind === "BUSINESS" ? "Business" : "Personal";
  const status = activeCompany?.onboardingStatus?.toLowerCase().replaceAll("_", " ");
  const canSwitch = !loading && companies.length > 0;

  useEffect(() => {
    if (isCollapsed) setIsOpen(false);
  }, [isCollapsed]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!switcherRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (companyId) => {
    setIsOpen(false);
    switchCompany(companyId);
  };

  if (isCollapsed) {
    return (
      <div className="company-switcher company-switcher--collapsed" title={activeCompany?.name || "Company"}>
        <FiBriefcase />
      </div>
    );
  }

  return (
    <div className={`company-switcher ${isOpen ? "is-open" : ""}`} ref={switcherRef}>
      <span className="company-switcher__label">Active company</span>
      <button
        className="company-switcher__control"
        type="button"
        onClick={() => canSwitch && setIsOpen((open) => !open)}
        disabled={!canSwitch}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Active company"
      >
        <FiBriefcase />
        <span className="company-switcher__name">
          {loading ? "Loading companies" : activeCompany?.name || "No companies"}
        </span>
        <FiChevronDown aria-hidden="true" className="company-switcher__chevron" />
      </button>

      {isOpen && (
        <div className="company-switcher__menu" role="listbox" aria-label="Companies">
          {companies.map(company => (
            <button
              className={`company-switcher__option ${company.id === activeCompany?.id ? "active" : ""}`}
              key={company.id}
              type="button"
              role="option"
              aria-selected={company.id === activeCompany?.id}
              onClick={() => handleSelect(company.id)}
            >
              {company.name}
            </button>
          ))}
        </div>
      )}

      {activeCompany && (
        <span className="company-switcher__meta">
          {companyType}
          {role ? ` - ${role.toLowerCase()}` : isSuperAdmin ? " - platform access" : ""}
          {status ? ` - ${status}` : ""}
        </span>
      )}
    </div>
  );
}

export default CompanySwitcher;
