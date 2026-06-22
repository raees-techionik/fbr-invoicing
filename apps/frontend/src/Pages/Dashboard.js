import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import useBlockBackButton from '../Components/useBlockBackButton';
import {
  FiAlertTriangle,
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiDownload,
  FiEye,
  FiFileText,
  FiGlobe,
  FiPlus,
  FiSearch,
  FiSend,
  FiShield,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiUpload,
  FiXCircle,
} from 'react-icons/fi';
import { getDashboardInvoices, getDashboardChartData } from '../services/fbrDashboardApi';
import { getOfflineQueueSummary } from '../services/fbrOfflineQueueApi';
import { clearToken, clearCompanySession } from '../services/companySession';
import './Dashboard.css';

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const PAGE_SIZE = 8;

const dateRanges = {
  today: { label: 'Today', days: 1 },
  sevenDays: { label: 'Last 7 days', days: 7 },
  thirtyDays: { label: 'Last 30 days', days: 30 },
  ninetyDays: { label: 'Last 90 days', days: 90 },
};

const notifications = [
  {
    title: 'Sandbox token needs live setup',
    body: 'Add the company sandbox token before running live FBR validation.',
    time: 'Now',
  },
  {
    title: '13 sandbox fixtures ready',
    body: 'All required scenario fixtures are available from the backend.',
    time: 'Today',
  },
  {
    title: 'Onboarding status updated',
    body: 'Current company is in sandbox testing.',
    time: 'Today',
  },
];

const statusFilters = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'draft', label: 'Draft' },
  { key: 'failed', label: 'Failed' },
];

// Animates a number from 0 up to `value` whenever `value` changes, mirroring
// the mock's count-up effect (cubic ease-out over ~1.1s).
function useCountUp(value, duration = 1100) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

function StatCard({ item }) {
  const displayValue = useCountUp(item.value);
  const cardRef = useRef(null);

  const handleMouseMove = (event) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `translateY(-4px) scale(1.015) perspective(600px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
    card.style.transition = 'none';
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = '';
    card.style.transition = 'transform .4s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease';
  };

  return (
    <article
      className="fbr-stat-card"
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`fbr-stat-icon ${item.tone}`}>{item.icon}</div>
      <div className="fbr-stat-card__content">
        <span>{item.title}</span>
        <strong>{displayValue.toLocaleString()}</strong>
        <p className={item.trendDirection}>
          {item.trendDirection === 'up' ? <FiTrendingUp /> : <FiTrendingDown />}
          {item.trend}
          <em>vs last period</em>
        </p>
        <div className="fbr-stat-progress">
          <div className={`fbr-stat-progress__fill ${item.tone}`} style={{ width: `${item.percent}%` }} />
        </div>
      </div>
    </article>
  );
}

function Dashboard() {
  useBlockBackButton();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState({ invoices: false });
  const [chartData, setChartData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRangeKey, setDateRangeKey] = useState('sevenDays');
  const [openMenu, setOpenMenu] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const topbarRef = useRef(null);
  const userEmail = localStorage.getItem('email') || 'admin@fbr.com';

  const displayName = (() => {
    const local = userEmail.split('@')[0] || 'there';
    const cleaned = local.replace(/[._-]+/g, ' ').trim();
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'there';
  })();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!topbarRef.current?.contains(event.target)) setOpenMenu(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading((prev) => ({ ...prev, invoices: true }));
      const data = await getDashboardInvoices({ limit: 100 });
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading((prev) => ({ ...prev, invoices: false }));
    }
  };

  useEffect(() => {
    fetchInvoices();
    getOfflineQueueSummary()
      .then((summary) => setOfflineQueueCount(summary?.offline || 0))
      .catch(() => setOfflineQueueCount(0));
  }, []);

  useEffect(() => {
    let mounted = true;
    getDashboardChartData('daily')
      .then((data) => {
        if (mounted) setChartData(data);
      })
      .catch(() => {
        if (mounted) setChartData([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm]);

  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (inv.amountPkr || 0), 0);
  const submittedCount = invoices.filter((inv) => inv.status === 'SUBMITTED').length;
  const failedCount = invoices.filter((inv) => ['UPLOAD_FAILED', 'FAILED', 'REJECTED'].includes(inv.status)).length;
  const draftCount = invoices.filter((inv) => !inv.status || inv.status === 'DRAFT').length;

  const heroSubtitle = offlineQueueCount > 0
    ? `${offlineQueueCount} invoice${offlineQueueCount > 1 ? 's' : ''} in the offline queue · ${draftCount} FBR submission${draftCount === 1 ? '' : 's'} pending today`
    : draftCount > 0
      ? `${draftCount} draft invoice${draftCount > 1 ? 's' : ''} awaiting submission${failedCount > 0 ? ` · ${failedCount} need review` : ''}`
      : invoices.length === 0
        ? 'Create your first invoice to get started with FBR digital invoicing.'
        : 'All invoices are up to date — nice work!';

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return invoices;

    return invoices.filter((invoice) => {
      const fields = [
        invoice.fbrInvoiceNumber,
        invoice.invoiceRefNo,
        invoice.invoiceType,
        invoice.buyerBusinessName,
        invoice.status,
      ];
      return fields.some((field) => String(field || '').toLowerCase().includes(term));
    });
  }, [invoices, searchTerm]);

  const filteredByStatus = useMemo(() => {
    if (statusFilter === 'all') return filteredInvoices;
    if (statusFilter === 'submitted') return filteredInvoices.filter((inv) => inv.status === 'SUBMITTED');
    if (statusFilter === 'draft') return filteredInvoices.filter((inv) => !inv.status || inv.status === 'DRAFT');
    if (statusFilter === 'failed') return filteredInvoices.filter((inv) => ['UPLOAD_FAILED', 'FAILED', 'REJECTED'].includes(inv.status));
    return filteredInvoices;
  }, [filteredInvoices, statusFilter]);

  const sortedInvoices = useMemo(
    () => [...filteredByStatus].sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0)),
    [filteredByStatus]
  );

  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageInvoices = sortedInvoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allOnPageSelected = pageInvoices.length > 0 && pageInvoices.every((inv) => selectedIds.includes(inv.id));

  const toggleSelectAll = () => {
    const pageIds = pageInvoices.map((inv) => inv.id);
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const formatDateRange = (rangeKey = dateRangeKey) => {
    const days = dateRanges[rangeKey]?.days || dateRanges.sevenDays.days;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return `${dayFormatter.format(start)} - ${dayFormatter.format(end)}, ${end.getFullYear()}`;
  };

  const toggleMenu = (menu) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const selectDateRange = (key) => {
    setDateRangeKey(key);
    setOpenMenu(null);
  };

  const logout = () => {
    localStorage.removeItem('email');
    clearToken();
    clearCompanySession();
    navigate('/');
  };

  const formatChartLabel = (value) => {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return dayFormatter.format(date);
    return String(value).slice(0, 10);
  };

  const normalizeChartPoint = (point, index) => {
    if (typeof point === 'number') {
      const submitted = Math.round(point * 0.82);
      return { label: `P${index + 1}`, submitted, draft: Math.max(point - submitted, 0) };
    }

    const label = point?.label || point?.period || point?.month || point?.date || `P${index + 1}`;
    const invoicesValue = Number(
      point?.invoices ??
      point?.invoiceCount ??
      point?.count ??
      point?.total ??
      point?.value ??
      0
    );
    const submittedValue = Number(point?.submitted ?? point?.submittedCount ?? Math.round(invoicesValue * 0.82));

    return {
      label: formatChartLabel(label),
      submitted: Number.isFinite(submittedValue) ? submittedValue : 0,
      draft: Number.isFinite(invoicesValue) ? Math.max(invoicesValue - submittedValue, 0) : 0,
    };
  };

  const invoiceActivity = (() => {
    if (chartData.length) {
      return chartData.map(normalizeChartPoint).slice(-10);
    }

    const buckets = Array.from({ length: 10 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (9 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: dayFormatter.format(date),
        submitted: 0,
        draft: 0,
      };
    });

    invoices.forEach((invoice) => {
      if (!invoice.invoiceDate) return;
      const key = new Date(invoice.invoiceDate).toISOString().slice(0, 10);
      const bucket = buckets.find((item) => item.key === key);
      if (!bucket) return;
      if (invoice.status === 'SUBMITTED') bucket.submitted += 1;
      else bucket.draft += 1;
    });

    return buckets;
  })();

  const statusBadge = (status) => {
    const normalized = status || 'DRAFT';
    const tone = normalized === 'SUBMITTED'
      ? 'success'
      : ['UPLOAD_FAILED', 'FAILED', 'REJECTED'].includes(normalized)
        ? 'danger'
        : normalized === 'DRAFT'
          ? 'neutral'
          : 'warning';
    const symbol = tone === 'success' ? '✓' : tone === 'danger' ? '✗' : '◎';

    return <span className={`fbr-status-badge ${tone}`}>{symbol} {normalized.replaceAll('_', ' ')}</span>;
  };

  const pct = (value) => (invoices.length ? Math.round((value / invoices.length) * 100) : 0);

  const statCards = [
    {
      title: 'Total Invoices',
      value: invoices.length,
      detail: totalInvoiceAmount > 0 ? `PKR ${totalInvoiceAmount.toLocaleString()} total` : 'No invoice value yet',
      icon: <FiFileText />,
      tone: 'green',
      trend: '18.6%',
      trendDirection: 'up',
      percent: invoices.length ? 100 : 0,
    },
    {
      title: 'Submitted',
      value: submittedCount,
      detail: invoices.length ? `${pct(submittedCount)}% of total invoices` : 'Awaiting submissions',
      icon: <FiSend />,
      tone: 'green',
      trend: '16.2%',
      trendDirection: 'up',
      percent: pct(submittedCount),
    },
    {
      title: 'Failed',
      value: failedCount,
      detail: failedCount > 0 ? 'Needs validation review' : 'No failed invoices',
      icon: <FiXCircle />,
      tone: 'red',
      trend: '22.9%',
      trendDirection: 'down',
      percent: pct(failedCount),
    },
    {
      title: 'Drafts',
      value: draftCount,
      detail: 'Awaiting submission',
      icon: <FiFileText />,
      tone: 'gray',
      trend: '5.0%',
      trendDirection: 'up',
      percent: pct(draftCount),
    },
  ];

  const totalForDonut = submittedCount + draftCount + failedCount + offlineQueueCount;
  const donutPct = (value) => (totalForDonut ? Math.round((value / totalForDonut) * 100) : 0);
  const donutData = [
    { key: 'submitted', name: 'Submitted', value: submittedCount, color: '#22c55e' },
    { key: 'draft', name: 'Draft', value: draftCount, color: '#f59e0b' },
    { key: 'failed', name: 'Failed', value: failedCount, color: '#ef4444' },
    { key: 'queue', name: 'In Queue', value: offlineQueueCount, color: '#f05c44' },
  ];

  const validationChecks = [
    'Schema Validation',
    'Business Rules',
    'FBR Connectivity',
    'Digital Signature',
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="fbr-chart-tooltip">
        <strong>{label}</strong>
        {payload.map((item) => (
          <span key={item.dataKey}>
            {item.name}: {Number(item.value || 0).toLocaleString()}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="fbr-dashboard" id="dashboard-wrapper">
      <header className="fbr-topbar">
        <h1>Dashboard</h1>
        <div className="fbr-topbar__actions" ref={topbarRef}>
          <div className="fbr-menu-wrap">
            <button
              className="fbr-date-filter"
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'date'}
              onClick={() => toggleMenu('date')}
            >
              <FiCalendar />
              {formatDateRange()}
              <FiChevronDown />
            </button>
            {openMenu === 'date' && (
              <div className="fbr-dropdown fbr-date-menu" role="menu" aria-label="Date range">
                {Object.entries(dateRanges).map(([key, range]) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={dateRangeKey === key}
                    className={dateRangeKey === key ? 'active' : ''}
                    onClick={() => selectDateRange(key)}
                  >
                    <span>{range.label}</span>
                    <small>{formatDateRange(key)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="fbr-search">
            <FiSearch />
            <input
              type="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <span>Ctrl K</span>
          </div>
          <div className="fbr-menu-wrap">
            <button
              className="fbr-bell"
              type="button"
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'notifications'}
              onClick={() => toggleMenu('notifications')}
            >
              <FiBell />
              <span>{notifications.length}</span>
            </button>
            {openMenu === 'notifications' && (
              <div className="fbr-dropdown fbr-notification-menu" role="menu" aria-label="Notifications">
                <div className="fbr-dropdown__header">
                  <strong>Notifications</strong>
                  <span>{notifications.length} new</span>
                </div>
                {notifications.map((notification) => (
                  <button key={notification.title} type="button" role="menuitem" onClick={() => setOpenMenu(null)}>
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
                    <small>{notification.time}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="fbr-menu-wrap fbr-account-wrap">
            <button
              className="fbr-avatar"
              type="button"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'account'}
              onClick={() => toggleMenu('account')}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </button>
            <button
              className="fbr-plain-icon"
              type="button"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'account'}
              onClick={() => toggleMenu('account')}
            >
              <FiChevronDown />
            </button>
            {openMenu === 'account' && (
              <div className="fbr-dropdown fbr-account-menu" role="menu" aria-label="Account">
                <div className="fbr-dropdown__header">
                  <strong>Welcome</strong>
                  <span>{userEmail}</span>
                </div>
                <Link to="/account/edit-profile" role="menuitem" onClick={() => setOpenMenu(null)}>Account</Link>
                <Link to="/support" role="menuitem" onClick={() => setOpenMenu(null)}>Help</Link>
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowLogoutConfirm(true);
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="fbr-dashboard__body">
        <section className="fbr-hero">
          <div className="fbr-hero__blob fbr-hero__blob--1" />
          <div className="fbr-hero__blob fbr-hero__blob--2" />
          <div className="fbr-hero__blob fbr-hero__blob--3" />
          <div className="fbr-hero__text">
            <h2>{greeting}, {displayName} 👋</h2>
            <p>{heroSubtitle}</p>
          </div>
          <div className="fbr-hero__actions">
            <Link className="fbr-btn-ghost" to="/invoice/upload">
              <FiUpload />
              Upload CSV
            </Link>
            <Link className="fbr-primary-action" to="/invoice/add">
              <FiPlus />
              New Invoice
            </Link>
          </div>
        </section>

        {offlineQueueCount > 0 ? (
          <div className="fbr-alert-strip">
            <FiAlertTriangle />
            <div className="fbr-alert-strip__text">
              <strong>{offlineQueueCount} invoice{offlineQueueCount > 1 ? 's' : ''}</strong> are queued for FBR submission — they will be sent automatically when the connection is restored.
            </div>
            <Link to="/invoice/offline-queue" className="fbr-alert-strip__link">View Queue →</Link>
          </div>
        ) : failedCount > 0 ? (
          <div className="fbr-alert-strip">
            <FiAlertTriangle />
            <div className="fbr-alert-strip__text">
              <strong>{failedCount} invoice{failedCount > 1 ? 's' : ''}</strong> failed FBR validation and need review.
            </div>
            <Link to="/invoice" className="fbr-alert-strip__link">Review Failed →</Link>
          </div>
        ) : null}

        <section className="fbr-stat-grid" aria-label="Dashboard metrics">
          {statCards.map((item) => <StatCard item={item} key={item.title} />)}
        </section>

        <section className="fbr-dashboard-grid">
          <div className="fbr-dashboard-main">
            <article className="fbr-panel fbr-activity-panel">
              <div className="fbr-panel-header">
                <h2>Invoice Activity</h2>
              </div>

              <div className="fbr-chart-legend">
                <span className="submitted">Submitted</span>
                <span className="invoices">Draft</span>
              </div>

              <div className="fbr-chart-shell">
                <ResponsiveContainer width="100%" height={292}>
                  <AreaChart data={invoiceActivity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fbrSubmittedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f05c44" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#f05c44" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fbrDraftFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#51555d" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#51555d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eef0f4" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#b8c2cf' }} tick={{ fill: '#344054', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#344054', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="draft"
                      name="Draft"
                      stroke="#ddd"
                      strokeWidth={2}
                      fill="url(#fbrDraftFill)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="submitted"
                      name="Submitted"
                      stroke="#f05c44"
                      strokeWidth={2.5}
                      fill="url(#fbrSubmittedFill)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#f05c44', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <aside className="fbr-readiness-column">
            <article className="fbr-panel fbr-donut-panel">
              <div className="fbr-panel-header">
                <h2>Status Split</h2>
              </div>
              {totalForDonut === 0 ? (
                <div className="fbr-donut-empty">No invoice data yet</div>
              ) : (
                <>
                  <div className="fbr-donut-wrap">
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                          {donutData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="fbr-status-list">
                    {donutData.map((d) => (
                      <div className="fbr-status-row" key={d.key}>
                        <span className="fbr-status-dot" style={{ background: d.color }} />
                        <span className="fbr-status-name">{d.name}</span>
                        <span className="fbr-status-count">{d.value}</span>
                        <span className="fbr-status-pct">{donutPct(d.value)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>

            <article className="fbr-panel fbr-readiness-panel">
              <h2>FBR Readiness</h2>

              <section className="fbr-readiness-card">
                <div className="fbr-readiness-card__header">
                  <strong>Sandbox Token</strong>
                  <span className="fbr-pill success">Active</span>
                </div>
                <div className="fbr-token">
                  <code>c3f8...b7e9</code>
                  <button type="button" aria-label="Copy sandbox token">
                    <FiCopy />
                  </button>
                </div>
                <div className="fbr-readiness-meta">
                  <span>Expires: Jun 12, 2026 11:59 PM</span>
                  <button type="button">Renew</button>
                </div>
              </section>

              <section className="fbr-readiness-card">
                <div className="fbr-readiness-card__header">
                  <strong>Queue Status</strong>
                  <span className="fbr-pill success">Live</span>
                </div>
                <div className="fbr-readiness-row">
                  <span><FiGlobe /> Production</span>
                  <strong>Connected</strong>
                </div>
                <div className="fbr-readiness-row">
                  <span><FiTrendingUp /> Queue Length</span>
                  <strong>{offlineQueueCount}</strong>
                </div>
              </section>

              <section className="fbr-readiness-card">
                <div className="fbr-readiness-card__header">
                  <strong>Validation Health</strong>
                  <span className={`fbr-pill ${failedCount > 0 ? 'danger' : 'success'}`}>
                    {failedCount > 0 ? 'Review' : 'Healthy'}
                  </span>
                </div>
                {validationChecks.map((check) => (
                  <div className="fbr-validation-row" key={check}>
                    <span><FiCheckCircle /> {check}</span>
                    <strong>{failedCount > 0 && check === 'Business Rules' ? 'Review' : 'Pass'}</strong>
                  </div>
                ))}
              </section>

              <Link className="fbr-compliance-link" to="/sandbox">
                <span><FiShield /> View Compliance</span>
                <FiChevronRight />
              </Link>
            </article>
          </aside>
        </section>

        <section className="fbr-panel fbr-invoice-panel">
          <div className="fbr-panel-header">
            <h2>Recent Invoices</h2>
            <div className="fbr-filter-chips">
              {statusFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`fbr-chip ${statusFilter === filter.key ? 'active' : ''}`}
                  onClick={() => setStatusFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <Link to="/invoice" className="fbr-view-all">
              View All <FiChevronRight />
            </Link>
          </div>

          <div className="fbr-table-wrap">
            <table className="fbr-table">
              <thead>
                <tr>
                  <th className="fbr-checkbox-cell">
                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                  </th>
                  <th>Invoice #</th>
                  <th>FBR Ref</th>
                  <th>Buyer</th>
                  <th>Date</th>
                  <th>Amount (PKR)</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {loading.invoices ? (
                  <tr><td colSpan="8" className="fbr-empty-cell">Loading invoices...</td></tr>
                ) : pageInvoices.length === 0 ? (
                  <tr><td colSpan="8" className="fbr-empty-cell">No invoices found</td></tr>
                ) : (
                  pageInvoices.map((invoice, index) => (
                    <tr key={invoice.id || index}>
                      <td className="fbr-checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(invoice.id)}
                          onChange={() => toggleSelectOne(invoice.id)}
                        />
                      </td>
                      <td className="fbr-strong-cell">{invoice.invoiceRefNo || 'N/A'}</td>
                      <td className="fbr-muted-cell">{invoice.fbrInvoiceNumber || '—'}</td>
                      <td>{invoice.buyerBusinessName || 'N/A'}</td>
                      <td>{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}</td>
                      <td className="fbr-amount-cell">{(invoice.amountPkr || 0).toLocaleString()}</td>
                      <td>{statusBadge(invoice.status)}</td>
                      <td>
                        <div className="fbr-row-actions">
                          <button className="fbr-row-action" type="button" aria-label="View invoice" onClick={() => navigate('/invoice')}>
                            <FiEye />
                          </button>
                          <button className="fbr-row-action" type="button" aria-label="Download invoice">
                            <FiDownload />
                          </button>
                          <button className="fbr-row-action danger" type="button" aria-label="Delete invoice">
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {sortedInvoices.length > 0 && (
            <div className="fbr-pager">
              <span className="fbr-pager-info">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedInvoices.length)} of {sortedInvoices.length} invoices
              </span>
              <div className="fbr-pager-btns">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n === safePage ? 'on' : ''}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">›</button>
              </div>
            </div>
          )}
        </section>
      </main>
      {showLogoutConfirm && (
        <div className="logout-overlay">
          <div className="logout-popup">
            <h5>Are you sure you want to logout?</h5>
            <div className="mt-3 d-flex justify-content-center gap-3">
              <button className="btn buttonsave p-2 px-4" type="button" onClick={logout}>Yes</button>
              <button className="btn btn-secondary px-4" type="button" onClick={() => setShowLogoutConfirm(false)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
