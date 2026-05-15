import React, { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiCloud,
  FiCopy,
  FiCpu,
  FiRefreshCw,
  FiSave,
  FiServer,
  FiShield,
  FiSliders,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import {
  getFbrOutboundIp,
  getFbrSettings,
  getFbrTokenStatus,
  getFbrTokenStatusSummary,
  updateFbrSettings,
} from "../services/fbrSettingsApi";
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
    <span className={`settings-status-badge ${meta.tone}`}>
      <Icon size={14} />
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
    <div className="settings-status-row">
      <div>
        <strong>{title}</strong>
        <span>{status?.message || "Not checked"}</span>
        {status?.checkedAt && <small>Checked {formatDateTime(status.checkedAt)}</small>}
      </div>
      <StatusBadge status={status?.status} />
    </div>
  );
}

function Settings() {
  useBlockBackButton();

  const [settings, setSettings] = useState(null);
  const [outboundIp, setOutboundIp] = useState(null);
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

  const loadSettings = useCallback(async ({ checkLive = false } = {}) => {
    setLoading(true);
    setError("");

    try {
      const [settingsRes, tokenStatusRes, ipRes] = await Promise.all([
        getFbrSettings({ checkLive }),
        getFbrTokenStatusSummary({ checkLive }),
        getFbrOutboundIp(),
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

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <span>FBR control center</span>
          <h1>Settings</h1>
          <p>Manage token storage, submission mode, and readiness signals used by invoice submission.</p>
        </div>
        <div className="settings-header__actions">
          <button className="settings-secondary-action" type="button" onClick={() => loadSettings()} disabled={loading || saving}>
            {loading ? <Spinner /> : <FiRefreshCw size={16} />}
            Refresh
          </button>
          <button className="settings-secondary-action" type="button" onClick={() => refreshTokenStatus()} disabled={refreshingStatus}>
            {refreshingStatus ? <Spinner /> : <FiActivity size={16} />}
            Status
          </button>
        </div>
      </header>

      {message && (
        <div className="settings-alert success">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
            <FiX size={18} />
          </button>
        </div>
      )}

      {error && (
        <div className="settings-alert danger">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <FiX size={18} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="settings-loading">
          <Spinner />
          Loading FBR settings...
        </div>
      ) : (
        <>
          <section className="settings-stat-grid" aria-label="Settings summary">
            <article>
              <span>Active Environment</span>
              <strong>{savedEnvironmentLabel}</strong>
              <small>{settings?.environment === "production" ? "Live FBR submission" : "Sandbox validation"}</small>
            </article>
            <article>
              <span>Connection Mode</span>
              <strong className={settings?.useMock ? "warning" : "success"}>{settings?.useMock ? "Mock" : "Live"}</strong>
              <small>{settings?.useMock ? "Local invoice numbers" : "FBR API enabled"}</small>
            </article>
            <article>
              <span>Selected Token</span>
              <strong>{selectedToken?.configured ? "Configured" : "Missing"}</strong>
              <small>{selectedToken?.masked || `${environmentLabel} token required`}</small>
            </article>
            <article>
              <span>Outbound IP</span>
              <strong>{outboundIp?.publicIp || "Unavailable"}</strong>
              <small>{outboundIp?.source || "Whitelist status unknown"}</small>
            </article>
          </section>

          <section className="settings-workspace">
            <form className="settings-panel settings-config-panel" onSubmit={handleSave}>
              <div className="settings-panel__top">
                <div>
                  <h2>Submission Controls</h2>
                  <p>These values decide how Add Invoice sends FBR payloads.</p>
                </div>
                <StatusBadge status={activeStatus?.status} />
              </div>

              <div className="settings-form-section">
                <div className="settings-section-heading">
                  <FiShield size={18} />
                  <div>
                    <strong>Environment</strong>
                    <span>{formData.environment === "production" ? "Scenario IDs are removed before submission." : "Sandbox scenario IDs remain available."}</span>
                  </div>
                </div>

                <div className="settings-segment" role="group" aria-label="FBR environment">
                  <button
                    type="button"
                    className={formData.environment === "sandbox" ? "active" : ""}
                    onClick={() => setFormData((prev) => ({ ...prev, environment: "sandbox" }))}
                    aria-pressed={formData.environment === "sandbox"}
                  >
                    <FiServer size={16} />
                    Sandbox
                  </button>
                  <button
                    type="button"
                    className={formData.environment === "production" ? "active" : ""}
                    onClick={() => setFormData((prev) => ({ ...prev, environment: "production" }))}
                    aria-pressed={formData.environment === "production"}
                  >
                    <FiCloud size={16} />
                    Production
                  </button>
                </div>
              </div>

              <div className="settings-form-section">
                <div className="settings-section-heading">
                  <FiCpu size={18} />
                  <div>
                    <strong>FBR Connection</strong>
                    <span>{formData.useMock ? "Mock mode is selected." : "Live FBR API calls are selected."}</span>
                  </div>
                </div>

                <label className={`settings-toggle ${formData.useMock ? "mock" : "live"}`}>
                  <input
                    type="checkbox"
                    role="switch"
                    name="useMock"
                    checked={formData.useMock}
                    onChange={handleChange}
                  />
                  <span className="settings-toggle__track">
                    <span />
                  </span>
                  <span className="settings-toggle__copy">
                    <strong>{formData.useMock ? "Mock Mode" : "Live Mode"}</strong>
                    <small>{formData.useMock ? "FBR is bypassed for generated invoice numbers." : "A valid token is required for submissions."}</small>
                  </span>
                </label>
              </div>

              <div className="settings-token-grid">
                <article className="settings-token-card">
                  <div className="settings-token-card__header">
                    <div>
                      <span>Sandbox Token</span>
                      <strong>{settings?.tokens?.sandbox?.configured ? settings.tokens.sandbox.masked : "Not configured"}</strong>
                    </div>
                    <StatusBadge status={sandboxStatus?.status} />
                  </div>

                  <label className="settings-field">
                    <span>Replace sandbox token</span>
                    <input
                      type="password"
                      name="sandboxToken"
                      value={formData.sandboxToken}
                      onChange={handleChange}
                      placeholder={settings?.tokens?.sandbox?.configured ? "Enter a new token" : "Paste sandbox token"}
                      autoComplete="new-password"
                    />
                  </label>

                  {settings?.tokens?.sandbox?.configured && (
                    <label className="settings-clear-check">
                      <input
                        type="checkbox"
                        name="clearSandboxToken"
                        checked={formData.clearSandboxToken}
                        onChange={handleChange}
                      />
                      Remove stored sandbox token
                    </label>
                  )}
                </article>

                <article className="settings-token-card">
                  <div className="settings-token-card__header">
                    <div>
                      <span>Production Token</span>
                      <strong>{settings?.tokens?.production?.configured ? settings.tokens.production.masked : "Not configured"}</strong>
                    </div>
                    <StatusBadge status={productionStatus?.status} />
                  </div>

                  <label className="settings-field">
                    <span>Replace production token</span>
                    <input
                      type="password"
                      name="productionToken"
                      value={formData.productionToken}
                      onChange={handleChange}
                      placeholder={settings?.tokens?.production?.configured ? "Enter a new token" : "Paste production token"}
                      autoComplete="new-password"
                    />
                  </label>

                  {settings?.tokens?.production?.configured && (
                    <label className="settings-clear-check">
                      <input
                        type="checkbox"
                        name="clearProductionToken"
                        checked={formData.clearProductionToken}
                        onChange={handleChange}
                      />
                      Remove stored production token
                    </label>
                  )}
                </article>
              </div>

              <div className="settings-form-actions">
                <button className="settings-primary-action" type="submit" disabled={saving}>
                  {saving ? <Spinner /> : <FiSave size={16} />}
                  Save Settings
                </button>
                <button
                  className="settings-secondary-action"
                  type="button"
                  onClick={handleCheckLive}
                  disabled={checking}
                >
                  {checking ? <Spinner /> : <FiActivity size={16} />}
                  Verify {environmentLabel}
                </button>
              </div>
            </form>

            <aside className="settings-side-column">
              <section className="settings-panel">
                <div className="settings-panel__top compact">
                  <div>
                    <h2>Token Readiness</h2>
                    <p>Status returned by the token endpoints.</p>
                  </div>
                </div>

                <TokenStatusRow title="Active Token" status={activeStatus} />
                <TokenStatusRow title="Sandbox" status={sandboxStatus} />
                <TokenStatusRow title="Production" status={productionStatus} />
              </section>

              <section className="settings-panel">
                <div className="settings-panel__top compact">
                  <div>
                    <h2>Network</h2>
                    <p>Outbound address for FBR and PRAL whitelisting.</p>
                  </div>
                </div>

                <div className="settings-ip-card">
                  <code>{outboundIp?.publicIp || "Unavailable"}</code>
                  {outboundIp?.publicIp && (
                    <button type="button" onClick={copyIp} aria-label="Copy outbound IP">
                      {copied ? <FiCheckCircle size={16} /> : <FiCopy size={16} />}
                    </button>
                  )}
                </div>

                <div className="settings-detail-list">
                  <div>
                    <span>Source</span>
                    <strong>{outboundIp?.source || "N/A"}</strong>
                  </div>
                  <div>
                    <span>Local Addresses</span>
                    <strong>{outboundIp?.localAddresses?.length ? outboundIp.localAddresses.join(", ") : "N/A"}</strong>
                  </div>
                </div>
              </section>

              <section className="settings-panel">
                <div className="settings-panel__top compact">
                  <div>
                    <h2>Current State</h2>
                    <p>Saved configuration currently used by invoice submission.</p>
                  </div>
                </div>

                <div className="settings-detail-list">
                  <div>
                    <span>Environment</span>
                    <strong>{savedEnvironmentLabel}</strong>
                  </div>
                  <div>
                    <span>Mode</span>
                    <strong>{settings?.useMock ? "Mock" : "Live"}</strong>
                  </div>
                  <div>
                    <span>Sandbox token</span>
                    <strong>{settings?.tokens?.sandbox?.configured ? "Configured" : "Missing"}</strong>
                  </div>
                  <div>
                    <span>Production token</span>
                    <strong>{settings?.tokens?.production?.configured ? "Configured" : "Missing"}</strong>
                  </div>
                  <div>
                    <span>Last saved</span>
                    <strong>{settings?.updatedAt ? formatDateTime(settings.updatedAt) : "N/A"}</strong>
                  </div>
                </div>
              </section>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

export default Settings;
