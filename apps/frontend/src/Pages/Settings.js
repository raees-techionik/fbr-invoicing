import React, { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiCloud,
  FiCopy,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiSave,
  FiServer,
  FiShield,
  FiSliders,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import {
  getFbrOutboundIp,
  getFbrSettings,
  getFbrTokenStatus,
  getFbrTokenStatusSummary,
  updateFbrSettings,
} from "../services/fbrSettingsApi";
import { getSandboxPreflight } from "../services/fbrSandboxApi";
import useBlockBackButton from "../Components/useBlockBackButton";
import "./Settings.css";

const STATUS_META = {
  mock: { label: "Mock Mode", tone: "neutral", Icon: FiSliders },
  missing: { label: "Missing", tone: "danger", Icon: FiXCircle },
  configured_unverified: { label: "Saved", tone: "warning", Icon: FiAlertTriangle },
  active: { label: "Active", tone: "success", Icon: FiCheckCircle },
  invalid: { label: "Invalid", tone: "danger", Icon: FiXCircle },
  error: { label: "Error", tone: "danger", Icon: FiAlertTriangle },
};

const Spinner = () => (
  <span className="settings-spinner" role="status" aria-label="Loading" />
);

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || "Unknown", tone: "neutral", Icon: FiAlertTriangle };
  const Icon = meta.Icon;

  return (
    <span className={`settings-badge ${meta.tone}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "Not checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked";
  return date.toLocaleString();
}

function TokenStatusRow({ title, status }) {
  return (
    <div className="settings-row">
      <span className="settings-row__key">{title}</span>
      <div className="settings-row__val-stack">
        <StatusBadge status={status?.status} />
        {status?.checkedAt && <small>{formatDateTime(status.checkedAt)}</small>}
      </div>
    </div>
  );
}

function Settings() {
  useBlockBackButton();

  const [settings, setSettings] = useState(null);
  const [outboundIp, setOutboundIp] = useState(null);
  const [preflight, setPreflight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    environment: "sandbox",
    useMock: true,
    sandboxToken: "",
    productionToken: "",
    clearSandboxToken: false,
    clearProductionToken: false,
  });
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSandboxToken, setShowSandboxToken] = useState(false);
  const [showProductionToken, setShowProductionToken] = useState(false);

  const loadSettings = useCallback(async ({ checkLive = false } = {}) => {
    setLoading(true);
    setError("");

    try {
      const [settingsRes, tokenStatusRes, ipRes, preflightRes] = await Promise.all([
        getFbrSettings({ checkLive }),
        getFbrTokenStatusSummary({ checkLive }),
        getFbrOutboundIp(),
        getSandboxPreflight(),
      ]);

      setSettings({
        ...settingsRes,
        tokenStatus: {
          sandbox: tokenStatusRes.sandbox,
          production: tokenStatusRes.production,
          active: tokenStatusRes.active,
        },
      });
      setOutboundIp(ipRes);
      setPreflight(preflightRes);
      setFormData((prev) => ({
        ...prev,
        environment: settingsRes.environment,
        useMock: settingsRes.useMock,
        sandboxToken: "",
        productionToken: "",
        clearSandboxToken: false,
        clearProductionToken: false,
      }));
    } catch (err) {
      console.error("Failed to load FBR settings:", err);
      setError("Failed to load FBR settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTokenStatus = useCallback(async ({ checkLive = false, showMessage = true } = {}) => {
    setRefreshingStatus(true);
    setError("");

    try {
      const tokenStatusRes = await getFbrTokenStatusSummary({ checkLive });
      setSettings((prev) => ({
        ...prev,
        environment: tokenStatusRes.environment ?? prev?.environment,
        useMock: tokenStatusRes.useMock ?? prev?.useMock,
        tokenStatus: {
          sandbox: tokenStatusRes.sandbox,
          production: tokenStatusRes.production,
          active: tokenStatusRes.active,
        },
      }));

      if (showMessage) {
        setMessage(checkLive ? "Token status refreshed with live check." : "Token status refreshed.");
      }
    } catch (err) {
      console.error("Failed to refresh token status:", err);
      setError("Failed to refresh token status.");
    } finally {
      setRefreshingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        environment: formData.environment,
        useMock: formData.useMock,
        clearSandboxToken: formData.clearSandboxToken,
        clearProductionToken: formData.clearProductionToken,
      };

      if (formData.sandboxToken) payload.sandboxToken = formData.sandboxToken;
      if (formData.productionToken) payload.productionToken = formData.productionToken;

      const updated = await updateFbrSettings(payload);
      setSettings((prev) => ({
        ...prev,
        ...updated,
        tokenStatus: updated.tokenStatus || prev?.tokenStatus,
      }));
      setFormData((prev) => ({
        ...prev,
        sandboxToken: "",
        productionToken: "",
        clearSandboxToken: false,
        clearProductionToken: false,
      }));
      setMessage("Settings saved successfully through /api/token.");
      await refreshTokenStatus({ checkLive: false, showMessage: false });
      setPreflight(await getSandboxPreflight());
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckLive = async () => {
    setChecking(true);
    setMessage("");
    setError("");

    try {
      const status = await getFbrTokenStatus({ environment: formData.environment, checkLive: true });
      setSettings((prev) => ({
        ...prev,
        tokenStatus: {
          ...prev?.tokenStatus,
          [formData.environment]: status,
          active: formData.environment === prev?.environment ? status : prev?.tokenStatus?.active,
        },
      }));
      setMessage(`Token check complete: ${status.message}`);
    } catch (err) {
      console.error("Failed to check token status:", err);
      setError("Failed to check token status.");
    } finally {
      setChecking(false);
    }
  };

  const copyIp = () => {
    if (!outboundIp?.publicIp || !navigator.clipboard) return;

    navigator.clipboard.writeText(outboundIp.publicIp).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const activeStatus = settings?.tokenStatus?.active;
  const sandboxStatus = settings?.tokenStatus?.sandbox;
  const productionStatus = settings?.tokenStatus?.production;
  const selectedToken = formData.environment === "sandbox" ? settings?.tokens?.sandbox : settings?.tokens?.production;
  const environmentLabel = formData.environment === "production" ? "Production" : "Sandbox";
  const savedEnvironmentLabel = settings?.environment === "production" ? "Production" : "Sandbox";
  const liveSandboxReady = Boolean(preflight?.canRunLive);
  const blockingChecks = preflight?.checks?.filter((check) => !check.passed && check.severity === "danger") || [];
  const warningChecks = preflight?.checks?.filter((check) => !check.passed && check.severity === "warning") || [];
  const sandboxTokenConfigured = Boolean(settings?.tokens?.sandbox?.configured);
  const productionTokenConfigured = Boolean(settings?.tokens?.production?.configured);

  const readinessSteps = [
    {
      key: "env",
      ok: settings?.environment === "sandbox",
      title: "1. Use sandbox environment",
      desc: settings?.environment === "sandbox" ? "Sandbox is selected." : "Switch environment to Sandbox.",
    },
    {
      key: "mock",
      ok: !settings?.useMock,
      title: "2. Disable mock mode",
      desc: settings?.useMock ? "Mock mode is still on, so FBR will be bypassed." : "Live FBR calls are enabled.",
    },
    {
      key: "token",
      ok: sandboxTokenConfigured,
      title: "3. Add sandbox token",
      desc: sandboxTokenConfigured ? "Sandbox token is stored for this company." : "Paste the FBR sandbox token below.",
    },
    {
      key: "ip",
      ok: Boolean(preflight?.checks?.find((check) => check.id === "ip-whitelist")?.passed),
      title: "4. Whitelist outbound IP",
      desc: outboundIp?.publicIp ? `Send ${outboundIp.publicIp} to FBR/PRAL.` : "Outbound IP is unavailable.",
    },
  ];

  return (
    <div className="settings-page">
      <div className="settings-page-hdr">
        <div className="settings-page-hdr__text">
          <h2>FBR Settings</h2>
          <p>Manage token storage, submission mode, and readiness signals used by invoice submission.</p>
        </div>
        <div className="settings-page-hdr__actions">
          <button className="settings-btn-outline" type="button" onClick={() => loadSettings()} disabled={loading || saving}>
            {loading ? <Spinner /> : <FiRefreshCw size={14} />}
            Refresh
          </button>
          <button className="settings-btn-outline" type="button" onClick={() => refreshTokenStatus()} disabled={refreshingStatus}>
            {refreshingStatus ? <Spinner /> : <FiActivity size={14} />}
            Check Status
          </button>
        </div>
      </div>

      {message && (
        <div className="settings-alert success">
          <FiCheckCircle size={16} />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message"><FiX size={15} /></button>
        </div>
      )}

      {error && (
        <div className="settings-alert danger">
          <FiAlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><FiX size={15} /></button>
        </div>
      )}

      {loading ? (
        <div className="settings-loading">
          <Spinner />
          Loading FBR settings...
        </div>
      ) : (
        <>
          <section className="settings-mini-stats" aria-label="Settings summary">
            <div className="settings-mini-card">
              <span className="settings-mini-card__label">Active Environment</span>
              <strong>{savedEnvironmentLabel}</strong>
              <small>{settings?.environment === "production" ? "Live FBR submission" : "Sandbox validation"}</small>
            </div>
            <div className="settings-mini-card">
              <span className="settings-mini-card__label">Connection Mode</span>
              <strong className={settings?.useMock ? "tone-warning" : "tone-success"}>{settings?.useMock ? "Mock" : "Live"}</strong>
              <small>{settings?.useMock ? "Local invoice numbers" : "FBR API enabled"}</small>
            </div>
            <div className="settings-mini-card">
              <span className="settings-mini-card__label">Selected Token</span>
              <strong>{selectedToken?.configured ? "Configured" : "Missing"}</strong>
              <small>{selectedToken?.masked || `${environmentLabel} token required`}</small>
            </div>
            <div className="settings-mini-card">
              <span className="settings-mini-card__label">Live Sandbox</span>
              <strong className={liveSandboxReady ? "tone-success" : "tone-danger"}>{liveSandboxReady ? "Ready" : "Blocked"}</strong>
              <small>{preflight ? `${preflight.summary.blockingIssues} blocking issue${preflight.summary.blockingIssues === 1 ? "" : "s"}` : "Preflight pending"}</small>
            </div>
            <div className="settings-mini-card">
              <span className="settings-mini-card__label">Outbound IP</span>
              <strong className="mono">{outboundIp?.publicIp || "Unavailable"}</strong>
              <small>{outboundIp?.source || "Whitelist status unknown"}</small>
            </div>
          </section>

          <section className="settings-env-tabs">
            <button
              type="button"
              className={`settings-env-tab sandbox ${formData.environment === "sandbox" ? "active" : ""}`}
              onClick={() => setFormData((prev) => ({ ...prev, environment: "sandbox" }))}
              aria-pressed={formData.environment === "sandbox"}
            >
              <span className="settings-env-tab__icon"><FiServer size={18} /></span>
              <span className="settings-env-tab__text">
                <strong>Sandbox Environment</strong>
                <small>For testing before going live</small>
              </span>
              <StatusBadge status={sandboxStatus?.status} />
            </button>
            <button
              type="button"
              className={`settings-env-tab production ${formData.environment === "production" ? "active" : ""}`}
              onClick={() => setFormData((prev) => ({ ...prev, environment: "production" }))}
              aria-pressed={formData.environment === "production"}
            >
              <span className="settings-env-tab__icon"><FiCloud size={18} /></span>
              <span className="settings-env-tab__text">
                <strong>Production Environment</strong>
                <small>Live FBR IRIS submissions</small>
              </span>
              <StatusBadge status={productionStatus?.status} />
            </button>
          </section>

          <section className="settings-grid">
            <div className="settings-main">
              <article className={`settings-card settings-readiness ${liveSandboxReady ? "ready" : "blocked"}`}>
                <div className="settings-card__hdr">
                  <div>
                    <h3>Live Sandbox Readiness</h3>
                    <p>
                      {liveSandboxReady
                        ? "This company can attempt live FBR sandbox validation from the Sandbox page."
                        : "Complete the blocking items before trying real FBR sandbox validation."}
                    </p>
                  </div>
                  <span className={`settings-score ${liveSandboxReady ? "success" : "danger"}`}>
                    {preflight ? `${preflight.summary.passedChecks}/${preflight.summary.totalChecks}` : "0/0"} ready
                  </span>
                </div>

                <div className="settings-card__body">
                  <div className="settings-readiness-steps">
                    {readinessSteps.map((step) => (
                      <div className="settings-step" key={step.key}>
                        <span className={`settings-step__icon ${step.ok ? "success" : "danger"}`}>
                          {step.ok ? <FiCheckCircle size={14} /> : <FiXCircle size={14} />}
                        </span>
                        <div>
                          <strong>{step.title}</strong>
                          <span>{step.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(blockingChecks.length > 0 || warningChecks.length > 0) && (
                    <div className="settings-issues">
                      {blockingChecks.map((check) => (
                        <div key={check.id} className="settings-issue danger">
                          <FiXCircle size={14} />
                          <span><strong>{check.label}</strong> {check.action}</span>
                        </div>
                      ))}
                      {warningChecks.map((check) => (
                        <div key={check.id} className="settings-issue warning">
                          <FiAlertTriangle size={14} />
                          <span><strong>{check.label}</strong> {check.action}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              <form className="settings-card" onSubmit={handleSave}>
                <div className="settings-card__hdr">
                  <div>
                    <h3>Submission Controls</h3>
                    <p>These values decide how Add Invoice sends FBR payloads.</p>
                  </div>
                  <StatusBadge status={activeStatus?.status} />
                </div>

                <div className="settings-card__body">
                  <div className="settings-toggle-row">
                    <div>
                      <div className="settings-toggle-row__title">{formData.useMock ? "Mock Mode" : "Live Mode"}</div>
                      <div className="settings-toggle-row__sub">{formData.useMock ? "FBR is bypassed for generated invoice numbers." : "A valid token is required for submissions."}</div>
                    </div>
                    <label className="settings-toggle">
                      <input type="checkbox" name="useMock" checked={formData.useMock} onChange={handleChange} />
                      <span className="settings-toggle__slider" />
                    </label>
                  </div>

                  {formData.useMock && (
                    <div className="settings-warning-strip">
                      <FiAlertTriangle size={15} />
                      <span>Mock mode is safe for demos and local testing, but live sandbox certification requires this to be off.</span>
                    </div>
                  )}

                  <div className="settings-token-grid">
                    <div className="settings-token-card">
                      <div className="settings-token-card__hdr">
                        <span>Sandbox Token</span>
                        <StatusBadge status={sandboxStatus?.status} />
                      </div>
                      <div className="settings-token-current">{settings?.tokens?.sandbox?.configured ? settings.tokens.sandbox.masked : "Not configured"}</div>
                      <span className="settings-field-label">Replace sandbox token</span>
                      <div className="settings-token-field">
                        <input
                          type={showSandboxToken ? "text" : "password"}
                          name="sandboxToken"
                          value={formData.sandboxToken}
                          onChange={handleChange}
                          placeholder={settings?.tokens?.sandbox?.configured ? "Enter a new token" : "Paste sandbox token"}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowSandboxToken((v) => !v)} aria-label="Toggle visibility">
                          {showSandboxToken ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                        </button>
                      </div>
                      {settings?.tokens?.sandbox?.configured && (
                        <label className="settings-clear-check">
                          <input type="checkbox" name="clearSandboxToken" checked={formData.clearSandboxToken} onChange={handleChange} />
                          Remove stored sandbox token
                        </label>
                      )}
                    </div>

                    <div className="settings-token-card">
                      <div className="settings-token-card__hdr">
                        <span>Production Token</span>
                        <StatusBadge status={productionStatus?.status} />
                      </div>
                      <div className="settings-token-current">{settings?.tokens?.production?.configured ? settings.tokens.production.masked : "Not configured"}</div>
                      <span className="settings-field-label">Replace production token</span>
                      <div className="settings-token-field">
                        <input
                          type={showProductionToken ? "text" : "password"}
                          name="productionToken"
                          value={formData.productionToken}
                          onChange={handleChange}
                          placeholder={settings?.tokens?.production?.configured ? "Enter a new token" : "Paste production token"}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowProductionToken((v) => !v)} aria-label="Toggle visibility">
                          {showProductionToken ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                        </button>
                      </div>
                      {settings?.tokens?.production?.configured && (
                        <label className="settings-clear-check">
                          <input type="checkbox" name="clearProductionToken" checked={formData.clearProductionToken} onChange={handleChange} />
                          Remove stored production token
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="settings-form-actions">
                    <button className="settings-btn-primary" type="submit" disabled={saving}>
                      {saving ? <Spinner /> : <FiSave size={14} />}
                      Save Settings
                    </button>
                    <button className="settings-btn-outline" type="button" onClick={handleCheckLive} disabled={checking}>
                      {checking ? <Spinner /> : <FiActivity size={14} />}
                      Verify {environmentLabel}
                    </button>
                    <Link className="settings-btn-outline" to="/sandbox">
                      <FiShield size={14} />
                      Open Sandbox
                    </Link>
                  </div>
                </div>
              </form>
            </div>

            <aside className="settings-aside">
              <article className="settings-card compact">
                <div className="settings-card__hdr">
                  <div>
                    <h3>Token Readiness</h3>
                    <p>Status returned by the token endpoints.</p>
                  </div>
                </div>
                <div className="settings-card__body">
                  <TokenStatusRow title="Active Token" status={activeStatus} />
                  <TokenStatusRow title="Sandbox" status={sandboxStatus} />
                  <TokenStatusRow title="Production" status={productionStatus} />
                </div>
              </article>

              <article className="settings-card compact">
                <div className="settings-card__hdr">
                  <div>
                    <h3>Network</h3>
                    <p>Outbound address for FBR and PRAL whitelisting.</p>
                  </div>
                </div>
                <div className="settings-card__body">
                  <div className="settings-ip-card">
                    <code>{outboundIp?.publicIp || "Unavailable"}</code>
                    {outboundIp?.publicIp && (
                      <button type="button" onClick={copyIp} aria-label="Copy outbound IP">
                        {copied ? <FiCheckCircle size={14} /> : <FiCopy size={14} />}
                      </button>
                    )}
                  </div>
                  <div className="settings-row">
                    <span className="settings-row__key">Source</span>
                    <span className="settings-row__val">{outboundIp?.source || "N/A"}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row__key">Local Addresses</span>
                    <span className="settings-row__val">{outboundIp?.localAddresses?.length ? outboundIp.localAddresses.join(", ") : "N/A"}</span>
                  </div>
                </div>
              </article>

              <article className="settings-card compact">
                <div className="settings-card__hdr">
                  <div>
                    <h3>Current State</h3>
                    <p>Saved configuration currently used by invoice submission.</p>
                  </div>
                </div>
                <div className="settings-card__body">
                  <div className="settings-row"><span className="settings-row__key">Environment</span><span className="settings-row__val">{savedEnvironmentLabel}</span></div>
                  <div className="settings-row"><span className="settings-row__key">Mode</span><span className="settings-row__val">{settings?.useMock ? "Mock" : "Live"}</span></div>
                  <div className="settings-row"><span className="settings-row__key">Sandbox token</span><span className={`settings-row__val ${sandboxTokenConfigured ? "tone-success" : "tone-danger"}`}>{sandboxTokenConfigured ? "Configured" : "Missing"}</span></div>
                  <div className="settings-row"><span className="settings-row__key">Production token</span><span className={`settings-row__val ${productionTokenConfigured ? "tone-success" : "tone-warning"}`}>{productionTokenConfigured ? "Configured" : "Not needed yet"}</span></div>
                  <div className="settings-row"><span className="settings-row__key">Last saved</span><span className="settings-row__val">{settings?.updatedAt ? formatDateTime(settings.updatedAt) : "N/A"}</span></div>
                </div>
              </article>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

export default Settings;
