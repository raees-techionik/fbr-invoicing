import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiPlay,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiXCircle,
} from 'react-icons/fi';
import {
  getSandboxStatus,
  getSandboxPreflight,
  runAllScenarios,
  runScenario,
  clearSandboxResults,
} from '../services/fbrSandboxApi';
import './Sandbox.css';

const STATUS_META = {
  passed: { label: 'Passed', tone: 'success', Icon: FiCheckCircle },
  failed: { label: 'Failed', tone: 'danger', Icon: FiXCircle },
  not_run: { label: 'Not Run', tone: 'warning', Icon: FiClock },
  placeholder: { label: 'Placeholder', tone: 'neutral', Icon: FiAlertTriangle },
};

const Spinner = () => (
  <span className="sandbox-spinner" role="status" aria-label="Loading" />
);

function StatusBadge({ status, isPlaceholder }) {
  const key = isPlaceholder ? 'placeholder' : status;
  const meta = STATUS_META[key] || { label: status || 'Unknown', tone: 'neutral', Icon: FiAlertTriangle };
  const Icon = meta.Icon;

  return (
    <span className={`sandbox-status-badge ${meta.tone}`}>
      <Icon size={14} />
      {meta.label}
    </span>
  );
}

function formatAge(dateStr) {
  if (!dateStr) return '-';

  const runDate = new Date(dateStr);
  const diff = Date.now() - runDate.getTime();
  if (Number.isNaN(diff)) return '-';

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return runDate.toLocaleDateString();
}

function formatError(error) {
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unable to render error details';
  }
}

function formatJson(value) {
  if (value == null) return 'No data returned';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Unable to render response data';
  }
}

export default function Sandbox() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [operation, setOperation] = useState('submit');
  const [runMode, setRunMode] = useState('mock');
  const [preflight, setPreflight] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [resultModeFilter, setResultModeFilter] = useState('all');

  const fetchStatus = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);

    try {
      const [data, preflightData] = await Promise.all([
        getSandboxStatus(),
        getSandboxPreflight(),
      ]);
      setStatus(data);
      setPreflight(preflightData);
    } catch {
      toast.error('Failed to load sandbox status');
    } finally {
      setLoading(false);
    }
  }, []);

  const runSettings = useMemo(() => ({
    environment: 'sandbox',
    useMock: runMode !== 'live',
  }), [runMode]);

  const liveRunBlocked = runMode === 'live' && !preflight?.canRunLive;

  useEffect(() => {
    fetchStatus({ showLoader: true });
  }, [fetchStatus]);

  const handleRunAll = async () => {
    if (liveRunBlocked) {
      toast.error('Live sandbox is not ready. Complete the preflight checklist first.');
      return;
    }

    setRunningAll(true);

    try {
      const result = await runAllScenarios(operation, runSettings);
      toast.success(`${result.passed} passed, ${result.failed} failed`);
      await fetchStatus();
    } catch {
      toast.error('Failed to run scenarios');
    } finally {
      setRunningAll(false);
    }
  };

  const handleRunOne = async (scenarioId) => {
    if (liveRunBlocked) {
      toast.error('Live sandbox is not ready. Complete the preflight checklist first.');
      return;
    }

    setRunningId(scenarioId);

    try {
      const result = await runScenario(scenarioId, operation, runSettings);
      if (result.passed) {
        toast.success(`${scenarioId} passed`);
      } else {
        toast.error(`${scenarioId} failed - ${result.errors?.[0] || 'see details'}`);
      }
      await fetchStatus();
    } catch {
      toast.error(`Failed to run ${scenarioId}`);
    } finally {
      setRunningId(null);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear all sandbox results? This cannot be undone.')) return;

    setClearing(true);

    try {
      await clearSandboxResults();
      toast.info('Results cleared');
      setExpandedId(null);
      await fetchStatus();
    } catch {
      toast.error('Failed to clear results');
    } finally {
      setClearing(false);
    }
  };

  const scenarios = useMemo(() => status?.scenarios ?? [], [status]);
  const filteredScenarios = useMemo(() => scenarios.filter((scenario) => {
    const scenarioStatus = scenario.isPlaceholder ? 'not_run' : scenario.overallStatus;
    const matchesStatus = statusFilter === 'all' || scenarioStatus === statusFilter;
    const matchesMode = resultModeFilter === 'all' || scenario.lastResult?.runMode === resultModeFilter;
    return matchesStatus && matchesMode;
  }), [scenarios, statusFilter, resultModeFilter]);
  const isBusy = runningAll || clearing || Boolean(runningId);
  const readyCount = Number(status?.ready || 0);
  const passedCount = Number(status?.passed || 0);
  const failedCount = Number(status?.failed || 0);
  const progressPercent = readyCount > 0 ? Math.min(100, Math.round((passedCount / readyCount) * 100)) : 0;
  const canRunSelectedMode = runMode === 'live' ? Boolean(preflight?.canRunLive) : readyCount > 0;

  const stats = useMemo(() => ([
    { label: 'Total Scenarios', value: status?.total ?? 0, tone: 'neutral' },
    { label: 'Ready', value: status?.ready ?? 0, tone: 'primary' },
    { label: 'Passed', value: status?.passed ?? 0, tone: 'success' },
    { label: 'Failed', value: status?.failed ?? 0, tone: 'danger' },
    { label: 'Not Run', value: status?.notRun ?? 0, tone: 'warning' },
    { label: 'Placeholder', value: status?.placeholder ?? 0, tone: 'neutral' },
  ]), [status]);

  return (
    <div className="sandbox-page">
      <header className="sandbox-header">
        <div>
          <span>FBR testing</span>
          <h1>Sandbox Testing</h1>
          <p>Run scenario checks, inspect FBR responses, and track production-token readiness.</p>
        </div>

        <div className="sandbox-header__actions">
          <button
            className="sandbox-secondary-action"
            type="button"
            onClick={() => fetchStatus({ showLoader: true })}
            disabled={isBusy || loading}
          >
            {loading ? <Spinner /> : <FiRefreshCw size={16} />}
            Refresh
          </button>
          <button
            className="sandbox-primary-action"
            type="button"
            onClick={handleRunAll}
            disabled={isBusy || !canRunSelectedMode}
          >
            {runningAll ? <Spinner /> : <FiPlay size={16} />}
            Run {runMode === 'live' ? 'Live' : 'Mock'} Scenarios
          </button>
        </div>
      </header>

      {loading ? (
        <div className="sandbox-loading">
          <Spinner />
          Loading sandbox status...
        </div>
      ) : (
        <>
          <section className="sandbox-stat-grid" aria-label="Sandbox summary">
            {stats.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong className={item.tone}>{item.value}</strong>
              </article>
            ))}
          </section>

          {preflight && (
            <section className={`sandbox-panel sandbox-preflight-panel ${preflight.readyForLive ? 'ready' : 'blocked'}`}>
              <div className="sandbox-panel__top">
                <div>
                  <h2>Live Sandbox Preflight</h2>
                  <p>
                    {preflight.readyForLive
                      ? 'This company is ready to attempt live FBR sandbox validation.'
                      : 'Complete the blocking items before running scenarios against real FBR sandbox.'}
                  </p>
                </div>
                <span className={`sandbox-preflight-score ${preflight.readyForLive ? 'success' : 'danger'}`}>
                  {preflight.summary.passedChecks}/{preflight.summary.totalChecks} ready
                </span>
              </div>

              <div className="sandbox-preflight-summary">
                <div>
                  <span>Mode</span>
                  <strong>{preflight.useMock ? 'Mock enabled' : 'Live enabled'}</strong>
                </div>
                <div>
                  <span>Environment</span>
                  <strong>{preflight.environment}</strong>
                </div>
                <div>
                  <span>Outbound IP</span>
                  <strong>{preflight.outboundIp?.publicIp || 'Unavailable'}</strong>
                </div>
                <div>
                  <span>Blocking</span>
                  <strong>{preflight.summary.blockingIssues}</strong>
                </div>
              </div>

              <div className="sandbox-preflight-grid">
                {preflight.checks.map((check) => (
                  <article key={check.id} className={check.passed ? 'success' : check.severity}>
                    <div>
                      {check.passed ? <FiCheckCircle size={18} /> : check.severity === 'warning' ? <FiAlertTriangle size={18} /> : <FiXCircle size={18} />}
                      <strong>{check.label}</strong>
                    </div>
                    <p>{check.message}</p>
                    {!check.passed && <small>{check.action}</small>}
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="sandbox-workspace">
            <div className="sandbox-main-column">
              <section className="sandbox-panel sandbox-progress-panel">
                <div className="sandbox-panel__top">
                  <div>
                    <h2>PRAL Certification Progress</h2>
                    <p>{status?.pralProgress || `${passedCount}/${readyCount} ready scenarios passed`}</p>
                  </div>
                  <StatusBadge status={failedCount > 0 ? 'failed' : status?.eligibleForProduction ? 'passed' : 'not_run'} />
                </div>

                <div className="sandbox-progress-track" aria-label="Certification progress">
                  <span style={{ width: `${progressPercent}%` }} className={failedCount > 0 ? 'danger' : 'success'} />
                </div>

                <div className="sandbox-progress-meta">
                  <strong>{progressPercent}% complete</strong>
                  <span>{passedCount} of {readyCount} ready scenarios passed</span>
                </div>

                {status?.eligibleForProduction && (
                  <div className="sandbox-eligibility success">
                    <FiShield size={18} />
                    <span>All ready scenarios passed. You are eligible to request a PRAL production token.</span>
                  </div>
                )}

                {!status?.eligibleForProduction && (
                  <div className={`sandbox-eligibility ${failedCount > 0 ? 'danger' : 'neutral'}`}>
                    {failedCount > 0 ? <FiAlertTriangle size={18} /> : <FiActivity size={18} />}
                    <span>{failedCount > 0 ? 'Resolve failed scenarios before requesting production access.' : 'Run all ready scenarios to complete certification checks.'}</span>
                  </div>
                )}
              </section>

              <section className="sandbox-panel">
                <div className="sandbox-panel__top">
                  <div>
                    <h2>Scenario Results</h2>
                    <p>Inspect masked requests, raw FBR responses, mapped errors, and suggested fixes.</p>
                  </div>
                </div>

                <div className="sandbox-result-filters" aria-label="Scenario result filters">
                  <label>
                    <span>Status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">All statuses</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="not_run">Not Run</option>
                    </select>
                  </label>
                  <label>
                    <span>Result source</span>
                    <select value={resultModeFilter} onChange={(event) => setResultModeFilter(event.target.value)}>
                      <option value="all">Mock and live</option>
                      <option value="mock">Mock only</option>
                      <option value="live">Live FBR only</option>
                    </select>
                  </label>
                  <strong>{filteredScenarios.length} of {scenarios.length} scenarios</strong>
                </div>

                <div className="sandbox-table-wrap">
                  <table className="sandbox-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Scenario</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Source</th>
                        <th>FBR Invoice No</th>
                        <th>Last Run</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScenarios.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="sandbox-empty-cell">No scenarios match these filters</td>
                        </tr>
                      ) : filteredScenarios.map((scenario) => {
                        const isExpanded = expandedId === scenario.scenarioId;
                        const hasResult = Boolean(scenario.lastResult);
                        const hasErrors = scenario.lastResult?.errors?.length > 0;
                        const mappedErrors = scenario.lastResult?.mappedErrors ?? [];

                        return (
                          <React.Fragment key={scenario.scenarioId}>
                            <tr className={scenario.overallStatus === 'failed' ? 'danger' : ''}>
                              <td>
                                <code>{scenario.scenarioId}</code>
                              </td>
                              <td>
                                <strong>{scenario.scenarioName}</strong>
                                <span>{scenario.description}</span>
                              </td>
                              <td>
                                <span className={`sandbox-category ${scenario.category === 'general' ? 'primary' : 'info'}`}>
                                  {scenario.category || 'N/A'}
                                </span>
                              </td>
                              <td>
                                <StatusBadge status={scenario.overallStatus} isPlaceholder={scenario.isPlaceholder} />
                              </td>
                              <td>
                                {hasResult ? (
                                  <span className={`sandbox-mode-badge ${scenario.lastResult.runMode || 'unknown'}`}>
                                    {scenario.lastResult.runMode === 'live' ? 'Live FBR' : scenario.lastResult.runMode === 'mock' ? 'Mock' : 'Unknown'}
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                <code>{scenario.lastResult?.invoiceNumber || '-'}</code>
                              </td>
                              <td>{formatAge(scenario.lastResult?.runAt)}</td>
                              <td>
                                <div className="sandbox-row-actions">
                                  <button
                                    className="sandbox-icon-action primary"
                                    type="button"
                                    onClick={() => handleRunOne(scenario.scenarioId)}
                                    disabled={scenario.isPlaceholder || isBusy || runningId === scenario.scenarioId || !canRunSelectedMode}
                                    title={scenario.isPlaceholder ? 'Scenario not yet implemented' : scenario.overallStatus === 'failed' ? `Retry ${scenario.scenarioId}` : `Run ${scenario.scenarioId}`}
                                    aria-label={scenario.overallStatus === 'failed' ? `Retry ${scenario.scenarioId}` : `Run ${scenario.scenarioId}`}
                                  >
                                    {runningId === scenario.scenarioId ? <Spinner /> : <FiPlay size={16} />}
                                  </button>
                                  {hasResult && (
                                    <button
                                      className="sandbox-icon-action neutral"
                                      type="button"
                                      onClick={() => setExpandedId(isExpanded ? null : scenario.scenarioId)}
                                      aria-label={isExpanded ? 'Hide details' : 'Show details'}
                                    >
                                      {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {isExpanded && scenario.lastResult && (
                              <tr className="sandbox-detail-row">
                                <td colSpan="8">
                                  <div className="sandbox-result-grid">
                                    <div>
                                      <span>Operation</span>
                                      <strong>{scenario.lastResult.operationType || '-'}</strong>
                                    </div>
                                    <div>
                                      <span>Status Code</span>
                                      <strong>{scenario.lastResult.statusCode || '-'}</strong>
                                    </div>
                                    <div>
                                      <span>Duration</span>
                                      <strong>{scenario.lastResult.durationMs ? `${scenario.lastResult.durationMs}ms` : '-'}</strong>
                                    </div>
                                    <div>
                                      <span>Run Time</span>
                                      <strong>{scenario.lastResult.runAt ? new Date(scenario.lastResult.runAt).toLocaleString() : '-'}</strong>
                                    </div>
                                  </div>

                                  {mappedErrors.length > 0 ? (
                                    <div className="sandbox-diagnostics">
                                      <div className="sandbox-detail-heading">
                                        <div>
                                          <strong>FBR diagnostics</strong>
                                          <span>Mapped error details and the next corrective action.</span>
                                        </div>
                                        <button
                                          className="sandbox-secondary-action"
                                          type="button"
                                          onClick={() => handleRunOne(scenario.scenarioId)}
                                          disabled={isBusy || !canRunSelectedMode}
                                        >
                                          {runningId === scenario.scenarioId ? <Spinner /> : <FiRefreshCw size={16} />}
                                          Retry {runMode === 'live' ? 'Live' : 'Mock'}
                                        </button>
                                      </div>
                                      <div className="sandbox-diagnostic-grid">
                                        {mappedErrors.map((error, index) => (
                                          <article key={`${scenario.scenarioId}-mapped-error-${index}`}>
                                            <div className="sandbox-diagnostic-meta">
                                              <code>{error.code || 'UNKNOWN'}</code>
                                              <span>{error.field || 'invoice'}{Number.isInteger(error.itemIndex) ? ` - item ${error.itemIndex + 1}` : ''}</span>
                                            </div>
                                            <p>{error.fbrMessage}</p>
                                            <strong>Suggested fix</strong>
                                            <p>{error.fixHint}</p>
                                          </article>
                                        ))}
                                      </div>
                                    </div>
                                  ) : hasErrors ? (
                                    <div className="sandbox-error-list">
                                      <span>Unmapped errors</span>
                                      {scenario.lastResult.errors.map((error, index) => (
                                        <code key={`${scenario.scenarioId}-error-${index}`}>{formatError(error)}</code>
                                      ))}
                                    </div>
                                  ) : null}

                                  <div className="sandbox-json-grid">
                                    <section className="sandbox-json-panel">
                                      <div>
                                        <strong>Payload sent</strong>
                                        <span>Sensitive identifiers are masked.</span>
                                      </div>
                                      <pre>{formatJson(scenario.lastResult.payload)}</pre>
                                    </section>
                                    <section className="sandbox-json-panel">
                                      <div>
                                        <strong>Raw FBR response</strong>
                                        <span>{scenario.lastResult.runMode === 'live' ? 'Response returned by FBR sandbox.' : 'Mock response generated locally.'}</span>
                                      </div>
                                      <pre>{formatJson(scenario.lastResult.raw)}</pre>
                                    </section>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="sandbox-side-column">
              <section className="sandbox-panel">
                <div className="sandbox-panel__top compact">
                  <div>
                    <h2>Run Controls</h2>
                    <p>Choose how the sandbox fixtures should be sent.</p>
                  </div>
                </div>

                <div className="sandbox-segment" role="group" aria-label="Sandbox operation">
                  <button
                    type="button"
                    className={operation === 'submit' ? 'active' : ''}
                    onClick={() => setOperation('submit')}
                    disabled={isBusy}
                    aria-pressed={operation === 'submit'}
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    className={operation === 'validate' ? 'active' : ''}
                    onClick={() => setOperation('validate')}
                    disabled={isBusy}
                    aria-pressed={operation === 'validate'}
                  >
                    Validate
                  </button>
                </div>

                <div className="sandbox-control-label">Run mode</div>
                <div className="sandbox-segment" role="group" aria-label="Sandbox run mode">
                  <button
                    type="button"
                    className={runMode === 'mock' ? 'active' : ''}
                    onClick={() => setRunMode('mock')}
                    disabled={isBusy}
                    aria-pressed={runMode === 'mock'}
                  >
                    Mock
                  </button>
                  <button
                    type="button"
                    className={runMode === 'live' ? 'active' : ''}
                    onClick={() => setRunMode('live')}
                    disabled={isBusy}
                    aria-pressed={runMode === 'live'}
                  >
                    Live FBR
                  </button>
                </div>

                {runMode === 'live' && !preflight?.canRunLive && (
                  <div className="sandbox-eligibility danger">
                    <FiAlertTriangle size={18} />
                    <span>Live FBR runs are disabled until the preflight checklist has no blocking issues.</span>
                  </div>
                )}

                <div className="sandbox-action-stack">
                  <button
                    className="sandbox-primary-action"
                    type="button"
                    onClick={handleRunAll}
                    disabled={isBusy || !canRunSelectedMode}
                  >
                    {runningAll ? <Spinner /> : <FiPlay size={16} />}
                    Run All {runMode === 'live' ? 'Live' : 'Mock'}
                  </button>
                  <button
                    className="sandbox-secondary-action"
                    type="button"
                    onClick={() => fetchStatus()}
                    disabled={isBusy}
                  >
                    <FiRefreshCw size={16} />
                    Refresh Results
                  </button>
                  <button
                    className="sandbox-danger-action"
                    type="button"
                    onClick={handleClear}
                    disabled={isBusy}
                  >
                    {clearing ? <Spinner /> : <FiTrash2 size={16} />}
                    Clear Results
                  </button>
                </div>
              </section>

              <section className="sandbox-panel">
                <div className="sandbox-panel__top compact">
                  <div>
                    <h2>Readiness</h2>
                    <p>Current sandbox gate before production access.</p>
                  </div>
                </div>

                <div className="sandbox-detail-list">
                  <div>
                    <span>Ready scenarios</span>
                    <strong>{readyCount}</strong>
                  </div>
                  <div>
                    <span>Passed</span>
                    <strong>{passedCount}</strong>
                  </div>
                  <div>
                    <span>Failed</span>
                    <strong>{failedCount}</strong>
                  </div>
                  <div>
                    <span>Production eligible</span>
                    <strong>{status?.eligibleForProduction ? 'Yes' : 'No'}</strong>
                  </div>
                </div>
              </section>

              <section className="sandbox-panel sandbox-note-panel">
                <FiShield size={20} />
                <div>
                  <h2>Certification Note</h2>
                  <p>Run all FBR sandbox scenarios before requesting a production token from PRAL. Placeholder scenarios require additional FBR-provided test data.</p>
                </div>
              </section>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
