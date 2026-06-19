import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiActivity,
  FiCheck,
  FiClipboard,
  FiCopy,
  FiExternalLink,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { useCompany } from "../contexts/CompanyContext";
import {
  createCompany,
  getCompanyActivity,
  getCompanyInvitations,
  getCompanyMembers,
  getCompanyOnboarding,
  getCurrentCompany,
  inviteCompanyMember,
  removeCompanyMember,
  revokeCompanyInvitation,
  updateCurrentCompany,
  updateCompanyMember,
  updateCompanyOnboarding,
} from "../services/companyApi";
import "./OnboardingWorkspace.css";

const ONBOARDING_STATUSES = [
  "PROFILE_PENDING", "PRODUCT_MAPPING_PENDING", "IRIS_REGISTRATION_PENDING", "IP_WHITELIST_PENDING",
  "SANDBOX_TOKEN_PENDING", "SANDBOX_TESTING", "CLIENT_TESTING", "PRODUCTION_TOKEN_PENDING",
  "READY_FOR_LIVE", "LIVE", "SUSPENDED",
];
const APPROVAL_STATUSES = ["NOT_STARTED", "PENDING", "APPROVED", "REJECTED"];
const TOKEN_STATUSES = ["MISSING", "REQUESTED", "CONFIGURED", "INVALID", "EXPIRED"];
const SANDBOX_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED"];
const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

const emptyOnboarding = {
  status: "PROFILE_PENDING",
  businessNature: "",
  primarySector: "",
  technicalContactName: "",
  technicalContactMobile: "",
  technicalContactEmail: "",
  erpProvider: "Techionik",
  softwareType: "Cloud",
  ipWhitelistStatus: "NOT_STARTED",
  sandboxTokenStatus: "MISSING",
  sandboxStatus: "NOT_STARTED",
  productionTokenStatus: "MISSING",
  irisSubmittedAt: null,
  notes: "",
};

function label(value) {
  return String(value || "").toLowerCase().split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function statusClass(value) {
  if (["LIVE", "PASSED", "APPROVED", "CONFIGURED", "ACCEPTED", "SENT"].includes(value)) return "success";
  if (["REJECTED", "FAILED", "INVALID", "EXPIRED", "SUSPENDED", "REVOKED"].includes(value)) return "danger";
  if (["PENDING", "REQUESTED", "IN_PROGRESS", "DEV_LOGGED", "NOT_SENT"].includes(value) || String(value || "").includes("PENDING")) return "active";
  return "neutral";
}

function dateToInputValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function inputValueToIso(value) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function readableDate(value) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

function readableDateTime(value) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function invitationNotice(invitation) {
  if (!invitation) return "Owner access was assigned.";
  if (invitation.emailDelivery?.status === "SENT") return `Invitation email sent to ${invitation.email}.`;
  if (invitation.emailDelivery?.status === "FAILED") return `Invitation was created, but email delivery failed for ${invitation.email}.`;
  if (invitation.emailDelivery?.status === "DEV_LOGGED") return `Invitation email logged locally for ${invitation.email}.`;
  return `Invitation created for ${invitation.email}.`;
}

function errorMessage(error) {
  const issue = error.response?.data?.details?.[0]?.message;
  return issue || error.response?.data?.error || error.message || "Something went wrong.";
}

function OnboardingWorkspace() {
  const { activeCompany, companies, isSuperAdmin, canManageCompany, loading: companyLoading, refresh: refreshCompanies, switchCompany } = useCompany();
  const [tab, setTab] = useState("overview");
  const [company, setCompany] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [form, setForm] = useState(emptyOnboarding);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [invite, setInvite] = useState({ email: "", role: "MEMBER" });
  const [createdInvite, setCreatedInvite] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name: "", legalName: "", ntn: "" });
  const [newCompany, setNewCompany] = useState({ name: "", legalName: "", ntn: "", ownerEmail: "", businessNature: "", primarySector: "" });
  const [businessSearch, setBusinessSearch] = useState("");
  const [businessStatus, setBusinessStatus] = useState("ALL");

  const loadWorkspace = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    setNotice(null);
    try {
      const [companyResult, onboardingResult] = await Promise.all([getCurrentCompany(), getCompanyOnboarding()]);
      setCompany(companyResult);
      setCompanyForm({
        name: companyResult.name || "",
        legalName: companyResult.legalName || "",
        ntn: companyResult.ntn || "",
      });
      setOnboarding(onboardingResult);
      setForm({ ...emptyOnboarding, ...onboardingResult });

      if (canManageCompany) {
        const [memberResult, invitationResult, activityResult] = await Promise.all([getCompanyMembers(), getCompanyInvitations(), getCompanyActivity()]);
        setMembers(memberResult);
        setInvitations(invitationResult);
        setActivity(activityResult);
      } else {
        setMembers([]);
        setInvitations([]);
        setActivity([]);
      }
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, canManageCompany]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const milestones = useMemo(() => {
    if (!onboarding) return [];
    return [
      { title: "Business profile", detail: "Business nature, sector, and technical contact", done: Boolean(onboarding.businessNature && onboarding.primarySector && onboarding.technicalContactEmail) },
      { title: "IRIS registration", detail: "Digital invoicing registration submitted", done: Boolean(onboarding.irisSubmittedAt) },
      { title: "IP whitelisting", detail: "Production server IP approved", done: onboarding.ipWhitelistStatus === "APPROVED" },
      { title: "Sandbox token", detail: "Sandbox credentials configured", done: onboarding.sandboxTokenStatus === "CONFIGURED" },
      { title: "Sandbox testing", detail: "Required PRAL scenarios passed", done: onboarding.sandboxStatus === "PASSED" },
      { title: "Production token", detail: "Production credentials configured", done: onboarding.productionTokenStatus === "CONFIGURED" },
      { title: "Go live", detail: "Business enabled for production invoicing", done: onboarding.status === "LIVE" },
    ];
  }, [onboarding]);

  const activeRole = activeCompany?.role || activeCompany?.membershipRole;

  const availableRoles = useMemo(() => (
    !isSuperAdmin && activeRole === "ADMIN" ? ["MEMBER", "VIEWER"] : ROLES
  ), [activeRole, isSuperAdmin]);

  const canManageMember = member => (
    isSuperAdmin || activeRole !== "ADMIN" || !["OWNER", "ADMIN"].includes(member.role)
  );

  const businessCompanies = useMemo(() => (
    companies.filter(item => item.kind === "BUSINESS")
  ), [companies]);

  const filteredBusinessCompanies = useMemo(() => {
    const query = businessSearch.trim().toLowerCase();
    return businessCompanies.filter(item => {
      const matchesSearch = !query || [
        item.name,
        item.legalName,
        item.ntn,
        item.onboardingStatus,
        item.onboardingNextStep,
      ].some(value => String(value || "").toLowerCase().includes(query));
      const matchesStatus = businessStatus === "ALL" || item.onboardingStatus === businessStatus;
      return matchesSearch && matchesStatus;
    });
  }, [businessCompanies, businessSearch, businessStatus]);

  const businessStats = useMemo(() => {
    const live = businessCompanies.filter(item => item.onboardingStatus === "LIVE").length;
    const ready = businessCompanies.filter(item => item.onboardingStatus === "READY_FOR_LIVE").length;
    const inSandbox = businessCompanies.filter(item => item.onboardingStatus === "SANDBOX_TESTING").length;
    const pending = businessCompanies.length - live - ready - inSandbox;
    return { total: businessCompanies.length, live, ready, inSandbox, pending };
  }, [businessCompanies]);

  const setField = (field) => event => setForm(current => ({ ...current, [field]: event.target.value }));

  const saveWorkflow = async event => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        ...form,
        businessNature: form.businessNature || null,
        primarySector: form.primarySector || null,
        technicalContactName: form.technicalContactName || null,
        technicalContactMobile: form.technicalContactMobile || null,
        technicalContactEmail: form.technicalContactEmail || null,
        notes: form.notes || null,
      };
      const result = await updateCompanyOnboarding(payload);
      setOnboarding(result);
      setForm({ ...emptyOnboarding, ...result });
      if (canManageCompany) setActivity(await getCompanyActivity());
      setNotice({ type: "success", text: "FBR onboarding record updated." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyDetails = async event => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        name: companyForm.name.trim(),
        legalName: companyForm.legalName.trim() || null,
        ntn: companyForm.ntn.trim() || null,
      };
      const result = await updateCurrentCompany(payload);
      setCompany(current => ({ ...current, ...result }));
      await refreshCompanies();
      if (canManageCompany) setActivity(await getCompanyActivity());
      setNotice({ type: "success", text: "Company details updated." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const submitInvite = async event => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const result = await inviteCompanyMember(invite);
      setCreatedInvite(result);
      setInvite({ email: "", role: "MEMBER" });
      const [invitationResult, activityResult] = await Promise.all([getCompanyInvitations(), getCompanyActivity()]);
      setInvitations(invitationResult);
      setActivity(activityResult);
      setNotice({ type: result.emailDelivery?.status === "FAILED" ? "error" : "success", text: invitationNotice(result) });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (membershipId, role) => {
    setNotice(null);
    try {
      await updateCompanyMember(membershipId, { role });
      const [memberResult, activityResult] = await Promise.all([getCompanyMembers(), getCompanyActivity()]);
      setMembers(memberResult);
      setActivity(activityResult);
      setNotice({ type: "success", text: "Member role updated." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    }
  };

  const removeMember = async membershipId => {
    if (!window.confirm("Remove this member from the company?")) return;
    try {
      await removeCompanyMember(membershipId);
      const [memberResult, activityResult] = await Promise.all([getCompanyMembers(), getCompanyActivity()]);
      setMembers(memberResult);
      setActivity(activityResult);
      setNotice({ type: "success", text: "Member removed." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    }
  };

  const revokeInvite = async invitationId => {
    try {
      await revokeCompanyInvitation(invitationId);
      const [invitationResult, activityResult] = await Promise.all([getCompanyInvitations(), getCompanyActivity()]);
      setInvitations(invitationResult);
      setActivity(activityResult);
      setNotice({ type: "success", text: "Invitation revoked." });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    }
  };

  const submitCompany = async event => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const payload = Object.fromEntries(Object.entries(newCompany).filter(([, value]) => value.trim()));
      const result = await createCompany(payload);
      setNewCompany({ name: "", legalName: "", ntn: "", ownerEmail: "", businessNature: "", primarySector: "" });
      setCreatedInvite(result.owner?.devInvitationToken ? { ...result.owner, company: result.company } : null);
      await refreshCompanies();
      setNotice({ type: result.owner?.emailDelivery?.status === "FAILED" ? "error" : "success", text: `${result.company.name} created. ${invitationNotice(result.owner)}` });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const copyInvitation = async token => {
    const url = `${window.location.origin}/company-invitation/${token}`;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      window.prompt("Copy invitation link", url);
    }
    setNotice({ type: "success", text: "Invitation link copied." });
  };

  if (companyLoading || (loading && !company)) {
    return <div className="onboarding-loading"><span className="custom-spinner" /> Loading company workspace...</div>;
  }

  if (!activeCompany) {
    return <div className="onboarding-loading">No company is available for this account.</div>;
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <FiClipboard /> },
    { id: "details", label: "Company details", icon: <FiBriefcase /> },
    { id: "workflow", label: "FBR workflow", icon: <FiCheck /> },
    ...(canManageCompany ? [{ id: "team", label: "Team access", icon: <FiUsers /> }] : []),
    ...(canManageCompany ? [{ id: "activity", label: "Activity", icon: <FiActivity /> }] : []),
    ...(isSuperAdmin ? [{ id: "businesses", label: "Businesses", icon: <FiBriefcase /> }] : []),
  ];

  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <div>
          <span className="onboarding-eyebrow">Company onboarding</span>
          <h1>{company?.name || activeCompany.name}</h1>
          <p>{company?.legalName || "FBR digital invoicing readiness and access control"}</p>
        </div>
        <div className="onboarding-header__status">
          <span className={`onboarding-status ${statusClass(onboarding?.status)}`}>{label(onboarding?.status)}</span>
          <button type="button" onClick={loadWorkspace} aria-label="Refresh workspace" title="Refresh workspace"><FiRefreshCw /></button>
        </div>
      </header>

      <nav className="onboarding-tabs" aria-label="Onboarding sections">
        {tabs.map(item => (
          <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>

      {notice && <div className={`onboarding-notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.text}</div>}

      {tab === "overview" && (
        <div className="onboarding-overview">
          <section className="onboarding-summary">
            <div className="onboarding-progress-copy">
              <span>Overall readiness</span>
              <strong>{onboarding?.progress?.percentage || 0}%</strong>
              <p>{onboarding?.progress?.completed || 0} of {onboarding?.progress?.total || 7} milestones complete</p>
            </div>
            <div className="onboarding-progress-track" aria-label={`${onboarding?.progress?.percentage || 0}% complete`}>
              <span style={{ width: `${onboarding?.progress?.percentage || 0}%` }} />
            </div>
            <div className="onboarding-next-step">
              <span>Next required action</span>
              <strong>{onboarding?.nextStep}</strong>
              {canManageCompany && <button type="button" onClick={() => setTab("workflow")}>Update workflow</button>}
            </div>
          </section>

          <section className="onboarding-milestones">
            <div className="onboarding-section-heading"><div><h2>FBR readiness path</h2><p>Milestones are updated from onboarding, token, and sandbox activity.</p></div></div>
            <div className="onboarding-milestone-list">
              {milestones.map((milestone, index) => (
                <div className={`onboarding-milestone ${milestone.done ? "done" : ""}`} key={milestone.title}>
                  <span>{milestone.done ? <FiCheck /> : index + 1}</span>
                  <div><strong>{milestone.title}</strong><p>{milestone.detail}</p></div>
                  <em>{milestone.done ? "Complete" : "Pending"}</em>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "details" && (
        <form className="onboarding-form" onSubmit={saveCompanyDetails}>
          <div className="onboarding-section-heading">
            <div><h2>Company details</h2><p>These fields identify the active business tenant used across FBR records.</p></div>
            {canManageCompany && <button className="onboarding-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save details"}</button>}
          </div>

          <fieldset disabled={!canManageCompany || saving}>
            <legend>Tenant identity</legend>
            <div className="onboarding-form-grid">
              <Field label="Workspace name"><input required value={companyForm.name} onChange={event => setCompanyForm(current => ({ ...current, name: event.target.value }))} /></Field>
              <Field label="Legal name"><input value={companyForm.legalName} onChange={event => setCompanyForm(current => ({ ...current, legalName: event.target.value }))} /></Field>
              <Field label="NTN / CNIC"><input value={companyForm.ntn} onChange={event => setCompanyForm(current => ({ ...current, ntn: event.target.value }))} /></Field>
              <Field label="Workspace type"><input value={label(company?.kind || activeCompany.kind)} disabled readOnly /></Field>
              <Field label="Members"><input value={company?.memberCount ?? 0} disabled readOnly /></Field>
              <Field label="Invitations"><input value={company?.invitationCount ?? 0} disabled readOnly /></Field>
            </div>
          </fieldset>
        </form>
      )}

      {tab === "workflow" && (
        <form className="onboarding-form" onSubmit={saveWorkflow}>
          <div className="onboarding-section-heading">
            <div><h2>FBR onboarding record</h2><p>Maintain the handoff details and approval state for this business.</p></div>
            {canManageCompany && <button className="onboarding-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>}
          </div>

          <fieldset disabled={!canManageCompany || saving}>
            <legend>Business and technical contact</legend>
            <div className="onboarding-form-grid">
              <Field label="Business nature"><input value={form.businessNature || ""} onChange={setField("businessNature")} /></Field>
              <Field label="Primary sector"><input value={form.primarySector || ""} onChange={setField("primarySector")} /></Field>
              <Field label="Technical contact"><input value={form.technicalContactName || ""} onChange={setField("technicalContactName")} /></Field>
              <Field label="Contact mobile"><input value={form.technicalContactMobile || ""} onChange={setField("technicalContactMobile")} /></Field>
              <Field label="Contact email"><input type="email" value={form.technicalContactEmail || ""} onChange={setField("technicalContactEmail")} /></Field>
              <Field label="ERP provider"><input value={form.erpProvider || ""} onChange={setField("erpProvider")} /></Field>
            </div>
          </fieldset>

          <fieldset disabled={!canManageCompany || saving}>
            <legend>Approvals and environments</legend>
            <div className="onboarding-form-grid">
              <Field label="Workflow stage"><Select value={form.status} values={ONBOARDING_STATUSES} onChange={setField("status")} /></Field>
              <Field label="IP whitelist"><Select value={form.ipWhitelistStatus} values={APPROVAL_STATUSES} onChange={setField("ipWhitelistStatus")} /></Field>
              <Field label="Sandbox token"><Select value={form.sandboxTokenStatus} values={TOKEN_STATUSES} onChange={setField("sandboxTokenStatus")} /></Field>
              <Field label="Sandbox testing"><Select value={form.sandboxStatus} values={SANDBOX_STATUSES} onChange={setField("sandboxStatus")} /></Field>
              <Field label="Production token"><Select value={form.productionTokenStatus} values={TOKEN_STATUSES} onChange={setField("productionTokenStatus")} /></Field>
              <Field label="IRIS submission">
                <select value={form.irisSubmittedAt ? "SUBMITTED" : "NOT_SUBMITTED"} onChange={event => setForm(current => ({ ...current, irisSubmittedAt: event.target.value === "SUBMITTED" ? new Date().toISOString() : null }))}>
                  <option value="NOT_SUBMITTED">Not submitted</option><option value="SUBMITTED">Submitted</option>
                </select>
              </Field>
              <Field label="IP approved date"><input type="date" value={dateToInputValue(form.ipWhitelistApprovedAt)} onChange={event => setForm(current => ({ ...current, ipWhitelistApprovedAt: inputValueToIso(event.target.value) }))} /></Field>
              <Field label="Sandbox started"><input type="date" value={dateToInputValue(form.sandboxStartedAt)} onChange={event => setForm(current => ({ ...current, sandboxStartedAt: inputValueToIso(event.target.value) }))} /></Field>
              <Field label="Sandbox completed"><input type="date" value={dateToInputValue(form.sandboxCompletedAt)} onChange={event => setForm(current => ({ ...current, sandboxCompletedAt: inputValueToIso(event.target.value) }))} /></Field>
              <Field label="Production requested"><input type="date" value={dateToInputValue(form.productionRequestedAt)} onChange={event => setForm(current => ({ ...current, productionRequestedAt: inputValueToIso(event.target.value) }))} /></Field>
              <Field label="Go-live date"><input type="date" value={dateToInputValue(form.goLiveAt)} onChange={event => setForm(current => ({ ...current, goLiveAt: inputValueToIso(event.target.value) }))} /></Field>
              <Field label="Internal notes" wide><textarea rows="4" value={form.notes || ""} onChange={setField("notes")} /></Field>
            </div>
          </fieldset>

          <div className="onboarding-date-strip" aria-label="Workflow timeline">
            <span><strong>IRIS</strong>{readableDate(onboarding?.irisSubmittedAt)}</span>
            <span><strong>IP approval</strong>{readableDate(onboarding?.ipWhitelistApprovedAt)}</span>
            <span><strong>Sandbox start</strong>{readableDate(onboarding?.sandboxStartedAt)}</span>
            <span><strong>Sandbox pass</strong>{readableDate(onboarding?.sandboxCompletedAt)}</span>
            <span><strong>Production request</strong>{readableDate(onboarding?.productionRequestedAt)}</span>
            <span><strong>Live</strong>{readableDate(onboarding?.goLiveAt)}</span>
          </div>
        </form>
      )}

      {tab === "team" && canManageCompany && (
        <div className="onboarding-team">
          <section className="onboarding-team__invite">
            <div className="onboarding-section-heading"><div><h2>Invite staff</h2><p>Grant company-scoped access to invoices and FBR operations.</p></div></div>
            <form onSubmit={submitInvite}>
              <Field label="Email address"><input type="email" required value={invite.email} onChange={event => setInvite(current => ({ ...current, email: event.target.value }))} placeholder="staff@business.com" /></Field>
              <Field label="Role"><Select value={invite.role} values={availableRoles} onChange={event => setInvite(current => ({ ...current, role: event.target.value }))} /></Field>
              <button className="onboarding-primary" type="submit" disabled={saving}><FiUserPlus /> Send invitation</button>
            </form>
            {createdInvite?.devInvitationToken && (
              <div className="onboarding-invite-link dev">
                <div><strong>Local invitation link</strong><span>Email is not configured, so the invitation was logged locally for {createdInvite.email}.</span></div>
                <button type="button" onClick={() => copyInvitation(createdInvite.devInvitationToken)}><FiCopy /> Copy link</button>
              </div>
            )}
          </section>

          <section>
            <div className="onboarding-section-heading"><div><h2>Members</h2><p>{members.length} people currently have access.</p></div></div>
            <div className="onboarding-table-wrap"><table className="onboarding-table"><thead><tr><th>Member</th><th>Role</th><th>Default</th><th aria-label="Actions" /></tr></thead><tbody>
              {members.map(member => <tr key={member.id}><td><strong>{member.user.fullName || member.user.email}</strong><span>{member.user.email}</span></td><td><select aria-label={`Role for ${member.user.email}`} value={member.role} disabled={!canManageMember(member)} onChange={event => changeRole(member.id, event.target.value)}>{(canManageMember(member) ? availableRoles : [member.role]).map(role => <option key={role}>{role}</option>)}</select></td><td>{member.isDefault ? "Yes" : "No"}</td><td>{canManageMember(member) && <button className="onboarding-icon-button danger" type="button" onClick={() => removeMember(member.id)} aria-label={`Remove ${member.user.email}`} title="Remove member"><FiTrash2 /></button>}</td></tr>)}
            </tbody></table></div>
          </section>

          <section>
            <div className="onboarding-section-heading"><div><h2>Invitations</h2><p>Pending and historical company invitations.</p></div></div>
            <div className="onboarding-table-wrap"><table className="onboarding-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Email</th><th>Expires</th><th aria-label="Actions" /></tr></thead><tbody>
              {invitations.length === 0 && <tr><td colSpan="6" className="onboarding-empty">No invitations yet.</td></tr>}
              {invitations.map(item => <tr key={item.id}><td><strong>{item.email}</strong>{item.invitedBy && <span>Invited by {item.invitedBy.fullName || item.invitedBy.email}</span>}</td><td>{label(item.role)}</td><td><span className={`onboarding-status ${statusClass(item.status)}`}>{label(item.status)}</span></td><td><span className={`onboarding-status ${statusClass(item.emailStatus)}`}>{label(item.emailStatus)}</span>{item.emailError && <span>{item.emailError}</span>}</td><td>{new Date(item.expiresAt).toLocaleDateString()}</td><td>{item.status === "PENDING" && <button className="onboarding-icon-button danger" type="button" onClick={() => revokeInvite(item.id)} aria-label={`Revoke invitation for ${item.email}`} title="Revoke invitation"><FiTrash2 /></button>}</td></tr>)}
            </tbody></table></div>
          </section>
        </div>
      )}

      {tab === "activity" && canManageCompany && (
        <section className="onboarding-activity">
          <div className="onboarding-section-heading"><div><h2>Activity log</h2><p>Recent company access and FBR onboarding changes.</p></div></div>
          <div className="onboarding-activity-list">
            {activity.length === 0 && <div className="onboarding-empty">No activity recorded yet.</div>}
            {activity.map(item => (
              <article className="onboarding-activity-item" key={item.id}>
                <span className="onboarding-activity-icon"><FiActivity /></span>
                <div>
                  <strong>{item.summary}</strong>
                  <span>{item.actor?.fullName || item.actor?.email || "System"} - {readableDateTime(item.createdAt)}</span>
                </div>
                <em>{label(item.action)}</em>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "businesses" && isSuperAdmin && (
        <div className="onboarding-businesses">
          <section className="onboarding-create-business">
            <div className="onboarding-section-heading"><div><h2>Create business tenant</h2><p>Prepare a company workspace and assign its first owner.</p></div></div>
            <form onSubmit={submitCompany} className="onboarding-form-grid">
              <Field label="Workspace name"><input required value={newCompany.name} onChange={event => setNewCompany(current => ({ ...current, name: event.target.value }))} /></Field>
              <Field label="Legal name"><input value={newCompany.legalName} onChange={event => setNewCompany(current => ({ ...current, legalName: event.target.value }))} /></Field>
              <Field label="NTN / CNIC"><input value={newCompany.ntn} onChange={event => setNewCompany(current => ({ ...current, ntn: event.target.value }))} /></Field>
              <Field label="Owner email"><input type="email" required value={newCompany.ownerEmail} onChange={event => setNewCompany(current => ({ ...current, ownerEmail: event.target.value }))} /></Field>
              <Field label="Business nature"><input value={newCompany.businessNature} onChange={event => setNewCompany(current => ({ ...current, businessNature: event.target.value }))} /></Field>
              <Field label="Primary sector"><input value={newCompany.primarySector} onChange={event => setNewCompany(current => ({ ...current, primarySector: event.target.value }))} /></Field>
              <div className="onboarding-form-actions"><button className="onboarding-primary" type="submit" disabled={saving}><FiPlus /> Create tenant</button></div>
            </form>
            {createdInvite?.devInvitationToken && createdInvite.company && <div className="onboarding-invite-link dev"><div><strong>Local owner invitation link</strong><span>{createdInvite.company.name} - {createdInvite.email}</span></div><button type="button" onClick={() => copyInvitation(createdInvite.devInvitationToken)}><FiCopy /> Copy link</button></div>}
          </section>

          <section>
            <div className="onboarding-section-heading"><div><h2>Tenant portfolio</h2><p>{businessCompanies.length} business workspaces tracked for FBR onboarding.</p></div></div>
            <div className="onboarding-admin-stats" aria-label="Business onboarding summary">
              <div><span>Total</span><strong>{businessStats.total}</strong></div>
              <div><span>Live</span><strong>{businessStats.live}</strong></div>
              <div><span>Ready</span><strong>{businessStats.ready}</strong></div>
              <div><span>Sandbox</span><strong>{businessStats.inSandbox}</strong></div>
              <div><span>Pending</span><strong>{businessStats.pending}</strong></div>
            </div>
            <div className="onboarding-admin-filters">
              <Field label="Search businesses">
                <input value={businessSearch} onChange={event => setBusinessSearch(event.target.value)} placeholder="Name, NTN, stage, next step" />
              </Field>
              <Field label="Workflow stage">
                <select value={businessStatus} onChange={event => setBusinessStatus(event.target.value)}>
                  <option value="ALL">All stages</option>
                  {ONBOARDING_STATUSES.map(status => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </Field>
            </div>
            <div className="onboarding-business-list">
              {filteredBusinessCompanies.length === 0 && <div className="onboarding-empty">No businesses match the selected filters.</div>}
              {filteredBusinessCompanies.map(item => {
                const progress = item.onboardingProgress?.percentage ?? 0;
                return (
                  <div key={item.id} className="onboarding-business-row onboarding-business-row--admin">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.legalName || item.ntn || "Business tenant"}</span>
                    </div>
                    <div className="onboarding-business-progress">
                      <span>{progress}% ready</span>
                      <div><i style={{ width: `${progress}%` }} /></div>
                      <small>{item.onboardingNextStep || "No onboarding record yet."}</small>
                    </div>
                    <span className={`onboarding-status ${statusClass(item.onboardingStatus)}`}>{label(item.onboardingStatus || "PROFILE_PENDING")}</span>
                    <em>{item.memberCount ?? 0} members / {item.invitationCount ?? 0} invites</em>
                    <button className="onboarding-icon-button" type="button" onClick={() => switchCompany(item.id)} aria-label={`Open ${item.name}`} title="Open tenant"><FiExternalLink /></button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label: fieldLabel, wide = false, children }) {
  return <label className={`onboarding-field ${wide ? "wide" : ""}`}><span>{fieldLabel}</span>{children}</label>;
}

function Select({ value, values, onChange }) {
  return <select value={value || values[0]} onChange={onChange}>{values.map(item => <option key={item} value={item}>{label(item)}</option>)}</select>;
}

export default OnboardingWorkspace;
