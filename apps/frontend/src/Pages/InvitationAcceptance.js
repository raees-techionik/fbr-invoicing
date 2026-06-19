import { useState } from "react";
import { FiArrowRight, FiBriefcase, FiCheck } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { acceptCompanyInvitation } from "../services/companyApi";
import { setActiveCompanyId } from "../services/companySession";
import "./OnboardingWorkspace.css";

function InvitationAcceptance() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(null);

  const accept = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await acceptCompanyInvitation(token, true);
      setActiveCompanyId(result.company.id);
      setAccepted(result);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "This invitation could not be accepted.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invitation-page">
      <section className="invitation-panel">
        <span className={`invitation-icon ${accepted ? "success" : ""}`}>{accepted ? <FiCheck /> : <FiBriefcase />}</span>
        <span className="onboarding-eyebrow">Company invitation</span>
        <h1>{accepted ? `Welcome to ${accepted.company.name}` : "Join a business workspace"}</h1>
        <p>{accepted ? `Your ${accepted.membership.role.toLowerCase()} access is ready.` : "Accept this invitation to access the company's FBR invoicing workspace."}</p>
        {error && <div className="onboarding-notice error" role="alert">{error}</div>}
        {accepted ? (
          <button className="onboarding-primary" type="button" onClick={() => window.location.assign("/onboarding")}>Open workspace <FiArrowRight /></button>
        ) : (
          <div className="invitation-actions">
            <button className="onboarding-primary" type="button" onClick={accept} disabled={loading}>{loading ? "Accepting..." : "Accept invitation"}</button>
            <button className="onboarding-secondary" type="button" onClick={() => navigate("/dashboard")}>Not now</button>
          </div>
        )}
      </section>
    </div>
  );
}

export default InvitationAcceptance;
