import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiBell, FiBriefcase, FiCheckCircle, FiFileText, FiUserPlus } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useCompany } from "../contexts/CompanyContext";
import { getCompanyNotifications } from "../services/companyApi";

const iconByType = {
  company: FiBriefcase,
  invitation: FiUserPlus,
  member: FiUserPlus,
  onboarding: FiCheckCircle,
  sandbox: FiAlertCircle,
  invoice: FiFileText,
};

function seenKey(companyId) {
  return `notifications-seen:${companyId}`;
}

function relativeTime(value) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "Just now";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

export default function NotificationMenu({ open, onToggle, onClose }) {
  const { activeCompany } = useCompany();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seenAt, setSeenAt] = useState(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!activeCompany?.id) return;
    if (!quiet) setLoading(true);
    try {
      setNotifications(await getCompanyNotifications());
      setError("");
    } catch {
      setError("Notifications could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    if (!activeCompany?.id) return;
    setSeenAt(Number(localStorage.getItem(seenKey(activeCompany.id))) || 0);
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 60000);
    return () => window.clearInterval(timer);
  }, [activeCompany?.id, load]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => Date.parse(item.createdAt) > seenAt).length,
    [notifications, seenAt],
  );

  const toggle = () => {
    const nextOpen = !open;
    onToggle(nextOpen);
    if (nextOpen) {
      load({ quiet: true });
      const newest = notifications.reduce((latest, item) => Math.max(latest, Date.parse(item.createdAt) || 0), Date.now());
      localStorage.setItem(seenKey(activeCompany?.id), String(newest));
      setSeenAt(newest);
    }
  };

  return (
    <div className="dropdown notification-menu">
      <button
        className="position-relative bell-icon topbar-menu-button"
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <FiBell size={22} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      <div className={`dropdown-menu dropdown-menu-end shadow-sm notification-dropdown ${open ? "show" : ""}`} role="menu">
        <div className="notification-header">
          <div><strong>Notifications</strong><span>{activeCompany?.name || "Active company"}</span></div>
          <button type="button" onClick={() => load()} disabled={loading}>Refresh</button>
        </div>
        <div className="notification-list">
          {loading && notifications.length === 0 && <div className="notification-empty">Loading notifications...</div>}
          {error && <div className="notification-empty notification-error">{error}</div>}
          {!loading && !error && notifications.length === 0 && <div className="notification-empty">No company activity yet.</div>}
          {notifications.map((item) => {
            const Icon = iconByType[item.type] || FiBell;
            const content = (
              <>
                <span className={`notification-icon ${item.severity || "info"}`}><Icon /></span>
                <span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><time>{relativeTime(item.createdAt)}</time></span>
              </>
            );
            return item.href
              ? <Link key={item.id} className="notification-item" to={item.href} onClick={onClose}>{content}</Link>
              : <div key={item.id} className="notification-item">{content}</div>;
          })}
        </div>
        <Link className="notification-footer" to="/onboarding" onClick={onClose}>View company activity</Link>
      </div>
    </div>
  );
}
