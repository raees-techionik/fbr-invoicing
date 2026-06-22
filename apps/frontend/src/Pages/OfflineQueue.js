import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiClock, FiRefreshCw, FiRotateCw, FiUploadCloud } from 'react-icons/fi';
import { MdOutlineWarningAmber } from 'react-icons/md';
import {
  getOfflineQueue,
  getOfflineQueueSummary,
  processOfflineQueue,
  retryOfflineQueueItem,
} from '../services/fbrOfflineQueueApi';
import './OfflineQueue.css';

const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function normalizeStatus(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'UPLOADED' || value === 'SUBMITTED') return 'SUBMITTED';
  if (value === 'FAILED' || value === 'UPLOAD_FAILED') return 'UPLOAD_FAILED';
  if (value === 'PENDING' || value === 'OFFLINE') return 'OFFLINE';
  return value || 'OFFLINE';
}

function statusBadge(status) {
  switch (normalizeStatus(status)) {
    case 'SUBMITTED':
      return <span className="offline-queue-status success">✓ Synced</span>;
    case 'UPLOAD_FAILED':
      return <span className="offline-queue-status danger">✗ Upload Failed</span>;
    case 'EXPIRED':
      return <span className="offline-queue-status expired">Deadline Passed</span>;
    case 'OFFLINE':
    default:
      return <span className="offline-queue-status neutral">◎ Offline</span>;
  }
}

function queuedTime(item) {
  return item.queuedAt || item.queued_at || item.createdAt || item.created_at;
}

function hoursQueued(item) {
  if (typeof item.hoursQueued === 'number') return item.hoursQueued;
  const ts = queuedTime(item);
  if (!ts) return 0;
  return Math.max(0, (Date.now() - new Date(ts).getTime()) / 3_600_000);
}

function deadlineState(item) {
  const status = normalizeStatus(item.status);
  if (status === 'SUBMITTED') return 'ok';
  if (item.isUploadDeadlineExpired) return 'expired';
  if (item.isUploadDeadlineWarning) return 'warning';

  const ts = queuedTime(item);
  if (!ts) return 'ok';
  const ageMs = Date.now() - new Date(ts).getTime();
  if (ageMs >= TWENTY_FOUR_HOURS_MS) return 'expired';
  if (ageMs >= TWENTY_HOURS_MS) return 'warning';
  return 'ok';
}

function formatAge(item) {
  const hours = hoursQueued(item);
  if (!hours) return '-';
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
}

function formatRemaining(item) {
  const hours = Math.max(0, 24 - hoursQueued(item));
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OfflineQueue() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    offline: 0,
    submitted: 0,
    upload_failed: 0,
    warningCount: 0,
    expiredCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [queueData, summaryData] = await Promise.all([
        getOfflineQueue({ limit: 100 }),
        getOfflineQueueSummary(),
      ]);
      setItems(Array.isArray(queueData) ? queueData : (queueData?.items ?? []));
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load offline queue:', err);
      toast.error('Failed to load offline queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleProcessAll = async () => {
    setProcessing(true);
    try {
      const result = await processOfflineQueue();
      const processed = result?.processed ?? 0;
      const uploaded = result?.uploaded ?? result?.submitted ?? 0;
      const failed = result?.failed ?? 0;
      if (uploaded > 0) toast.success(`${uploaded} invoice${uploaded !== 1 ? 's' : ''} submitted successfully`);
      if (failed > 0) toast.warning(`${failed} invoice${failed !== 1 ? 's' : ''} failed. Check upload failed items.`);
      if (processed === 0) toast.info('No invoices to process');
      await fetchAll();
    } catch (err) {
      toast.error('Failed to process queue');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetry = async (id) => {
    setRetryingId(id);
    try {
      await retryOfflineQueueItem(id);
      toast.success('Retry submitted');
      await fetchAll();
    } catch (err) {
      toast.error('Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const pendingCount = (summary.offline ?? summary.pending ?? 0) + (summary.upload_failed ?? summary.uploadFailed ?? 0);
  const warningCount = summary.warningCount ?? items.filter((item) => deadlineState(item) === 'warning').length;
  const expiredCount = summary.expiredCount ?? items.filter((item) => deadlineState(item) === 'expired').length;

  const activeItems = items.filter((item) => normalizeStatus(item.status) !== 'SUBMITTED');
  const syncedItems = items.filter((item) => normalizeStatus(item.status) === 'SUBMITTED');

  const Spinner = ({ sm } = {}) => (
    <span className={`spinner-border${sm ? ' spinner-border-sm' : ''}`} role="status">
      <span className="visually-hidden">Loading...</span>
    </span>
  );

  return (
    <div className="offline-queue-page">
      <div className="offline-queue-header">
        <div>
          <span>FBR upload safety</span>
          <h1>Offline Queue</h1>
          <p>Monitor queued invoices, retry failed uploads, and keep the 24-hour FBR deadline visible.</p>
        </div>

        <div className="offline-queue-header__actions">
          <Link to="/invoice" className="offline-queue-secondary-action">Back to invoices</Link>
          <button className="offline-queue-secondary-action" onClick={fetchAll} disabled={loading}>
            <FiRefreshCw size={15} /> Refresh
          </button>
          <button
            className="offline-queue-primary-action"
            onClick={handleProcessAll}
            disabled={processing || pendingCount === 0}
          >
            {processing ? <><Spinner sm /> Processing...</> : <><FiUploadCloud size={16} /> Upload All Pending ({pendingCount})</>}
          </button>
        </div>
      </div>

      <div className="offline-queue-stat-grid">
        {[
          { label: 'Pending Upload', value: summary.offline ?? summary.pending ?? 0, tone: 'neutral' },
          { label: 'Upload Failed', value: summary.upload_failed ?? summary.uploadFailed ?? 0, tone: 'danger' },
          { label: 'Submitted', value: summary.submitted ?? summary.uploaded ?? 0, tone: 'success' },
          { label: '20h Warnings', value: warningCount, tone: 'warning' },
          { label: '24h Deadlines', value: expiredCount, tone: 'danger' },
        ].map(({ label, value, tone }) => (
          <div className="offline-queue-stat-card" key={label}>
            <span>{label}</span>
            <strong className={tone}>{value}</strong>
          </div>
        ))}
      </div>

      {(warningCount > 0 || expiredCount > 0) && (
        <div className={`offline-queue-alert ${expiredCount > 0 ? 'danger' : 'warning'}`} role="alert">
          <MdOutlineWarningAmber size={20} />
          <div>
            <strong>{expiredCount > 0 ? 'Deadline attention required' : 'Deadline warning'}</strong>
            <p>
              {expiredCount > 0
                ? `${expiredCount} offline invoice${expiredCount !== 1 ? 's have' : ' has'} passed the 24-hour upload deadline.`
                : `${warningCount} offline invoice${warningCount !== 1 ? 's are' : ' is'} past 20 hours and close to the 24-hour upload deadline.`}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="offline-queue-empty"><Spinner /> Loading queue...</div>
      ) : activeItems.length === 0 ? (
        <div className="offline-queue-empty">No invoices currently in the offline queue.</div>
      ) : (
        activeItems.map((item) => {
          const invoice = item.invoice || {};
          const ref = item.invoice_ref_no || item.invoiceRefNo || invoice.invoiceRefNo || item.id;
          const buyer = item.buyer_business_name || item.buyerBusinessName || invoice.buyerBusinessName || '-';
          const amount = item.amount_pkr ?? item.amountPkr ?? invoice.amountPkr ?? 0;
          const status = normalizeStatus(item.status);
          const state = deadlineState(item);
          const canRetry = status === 'UPLOAD_FAILED' || (status === 'OFFLINE' && state === 'expired');
          const pct = Math.min(100, (hoursQueued(item) / 24) * 100);

          return (
            <article className={`offline-queue-card ${state}`} key={item.id}>
              <div className="offline-queue-card__top">
                <div className={`offline-queue-card__icon ${state}`}>
                  {status === 'UPLOAD_FAILED' ? <MdOutlineWarningAmber size={18} /> : <FiClock size={18} />}
                </div>
                <div className="offline-queue-card__title">
                  <strong>{ref} · {buyer}</strong>
                  <span>Queued {formatAge(item)} {status === 'UPLOAD_FAILED' ? '· Upload failed' : '· Waiting for sync'}</span>
                </div>
                <div className="offline-queue-card__amount">
                  <strong>PKR {Number(amount || 0).toLocaleString()}</strong>
                  <span>{statusBadge(item.status)}</span>
                </div>
              </div>

              <div className="offline-queue-card__deadline">
                <div className="offline-queue-card__bar"><div className={`offline-queue-card__bar-fill ${state}`} style={{ width: `${pct}%` }} /></div>
                <span className={`offline-queue-card__remaining ${state}`}>
                  {state === 'expired' ? '24h deadline passed' : formatRemaining(item)}
                </span>
              </div>

              <div className="offline-queue-card__footer">
                {canRetry && (
                  <button
                    className="offline-queue-retry-action"
                    onClick={() => handleRetry(item.id)}
                    disabled={retryingId === item.id}
                  >
                    {retryingId === item.id ? <Spinner sm /> : <><FiRotateCw size={13} /> Retry Now</>}
                  </button>
                )}
                <span className="offline-queue-card__attempts">Attempts: {item.attempt_count ?? item.attemptCount ?? item.retryCount ?? 0}</span>
                <span className="offline-queue-card__due">Due: {formatDateTime(item.uploadDeadlineAt || item.upload_deadline_at)}</span>
              </div>
            </article>
          );
        })
      )}

      {syncedItems.length > 0 && (
        <section className="offline-queue-panel">
          <div className="offline-queue-panel__top">
            <div>
              <h2>Recently Synced</h2>
              <p>Invoices that have already been submitted to FBR from the offline queue.</p>
            </div>
          </div>

          <div className="offline-queue-table-wrap">
            <table className="offline-queue-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Buyer</th>
                  <th>Queued For</th>
                  <th>Synced At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {syncedItems.map((item) => {
                  const invoice = item.invoice || {};
                  const ref = item.invoice_ref_no || item.invoiceRefNo || invoice.invoiceRefNo || item.id;
                  const buyer = item.buyer_business_name || item.buyerBusinessName || invoice.buyerBusinessName || '-';
                  return (
                    <tr key={item.id}>
                      <td className="offline-queue-ref">{ref}</td>
                      <td className="offline-queue-buyer">{buyer}</td>
                      <td>{formatAge(item)}</td>
                      <td>{formatDateTime(item.updatedAt || item.updated_at)}</td>
                      <td>{statusBadge(item.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
