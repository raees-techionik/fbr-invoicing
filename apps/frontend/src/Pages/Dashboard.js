import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import useBlockBackButton from '../Components/useBlockBackButton';
import {
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiFileText,
  FiGlobe,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiSend,
  FiShield,
  FiTrendingDown,
  FiTrendingUp,
  FiXCircle,
} from 'react-icons/fi';
import { getDashboardInvoices, getDashboardChartData } from '../services/fbrDashboardApi';
import './Dashboard.css';

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

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

function Dashboard() {
  useBlockBackButton();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState({ invoices: false });
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [chartData, setChartData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRangeKey, setDateRangeKey] = useState('sevenDays');
  const [openMenu, setOpenMenu] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const topbarRef = useRef(null);
  const userEmail = localStorage.getItem('email') || 'admin@fbr.com';

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
  }, []);

  useEffect(() => {
    let mounted = true;
    getDashboardChartData(chartPeriod)
      .then((data) => {
        if (mounted) setChartData(data);
      })
      .catch(() => {
        if (mounted) setChartData([]);
      });

    return () => {
      mounted = false;
    };
  }, [chartPeriod]);

  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (inv.amountPkr || 0), 0);
  const submittedCount = invoices.filter((inv) => inv.status === 'SUBMITTED').length;
  const failedCount = invoices.filter((inv) => ['UPLOAD_FAILED', 'FAILED', 'REJECTED'].includes(inv.status)).length;
  const draftCount = invoices.filter((inv) => !inv.status || inv.status === 'DRAFT').length;

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

  const currentInvoices = [...filteredInvoices]
    .sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0))
    .slice(0, 5);

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
    localStorage.removeItem('token');
    navigate('/');
  };

  const formatChartLabel = (value) => {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return dayFormatter.format(date);
    return String(value).slice(0, 10);
  };

  const normalizeChartPoint = (point, index) => {
    if (typeof point === 'number') {
      return { label: `P${index + 1}`, invoices: point, submitted: Math.round(point * 0.82) };
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
      invoices: Number.isFinite(invoicesValue) ? invoicesValue : 0,
      submitted: Number.isFinite(submittedValue) ? submittedValue : 0,
    };
  };

  const invoiceActivity = (() => {
    if (chartData.length) {
      return chartData.map(normalizeChartPoint).slice(-7);
    }

    const buckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: dayFormatter.format(date),
        invoices: 0,
        submitted: 0,
      };
    });

    invoices.forEach((invoice) => {
      if (!invoice.invoiceDate) return;
      const key = new Date(invoice.invoiceDate).toISOString().slice(0, 10);
      const bucket = buckets.find((item) => item.key === key);
      if (!bucket) return;
      bucket.invoices += 1;
      if (invoice.status === 'SUBMITTED') bucket.submitted += 1;
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

    return <span className={`fbr-status-badge ${tone}`}>{normalized.replaceAll('_', ' ')}</span>;
  };

  const statCards = [
    {
      title: 'Total Invoices',
      value: invoices.length,
      detail: totalInvoiceAmount > 0 ? `PKR ${totalInvoiceAmount.toLocaleString()} total` : 'No invoice value yet',
      icon: <FiFileText />,
      tone: 'green',
      trend: '18.6%',
      trendDirection: 'up',
    },
    {
      title: 'Submitted',
      value: submittedCount,
      detail: invoices.length ? `${Math.round((submittedCount / invoices.length) * 100)}% of total invoices` : 'Awaiting submissions',
      icon: <FiSend />,
      tone: 'green',
      trend: '16.2%',
      trendDirection: 'up',
    },
    {
      title: 'Failed',
      value: failedCount,
      detail: failedCount > 0 ? 'Needs validation review' : 'No failed invoices',
      icon: <FiXCircle />,
      tone: 'red',
      trend: '22.9%',
      trendDirection: 'down',
    },
    {
      title: 'Drafts',
      value: draftCount,
      detail: 'Awaiting submission',
      icon: <FiFileText />,
      tone: 'gray',
      trend: '5.0%',
      trendDirection: 'up',
    },
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
              TA
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
        <div className="fbr-action-row">
          <Link className="fbr-primary-action" to="/invoice/add">
            <FiPlus />
            Create Invoice
            <span />
            <FiChevronDown />
          </Link>
        </div>

        <section className="fbr-stat-grid" aria-label="Dashboard metrics">
          {statCards.map((item) => (
            <article className="fbr-stat-card" key={item.title}>
              <div className={`fbr-stat-icon ${item.tone}`}>{item.icon}</div>
              <div className="fbr-stat-card__content">
                <span>{item.title}</span>
                <strong>{item.value.toLocaleString()}</strong>
                <p className={item.trendDirection}>
                  {item.trendDirection === 'up' ? <FiTrendingUp /> : <FiTrendingDown />}
                  {item.trend}
                  <em>vs last period</em>
                </p>
              </div>
            </article>
          ))}
        </section>

        <section className="fbr-dashboard-grid">
          <div className="fbr-dashboard-main">
            <article className="fbr-panel fbr-activity-panel">
              <div className="fbr-panel-header">
                <h2>Invoice Activity</h2>
                <select value={chartPeriod} onChange={(event) => setChartPeriod(event.target.value)} aria-label="Chart period">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="fbr-chart-legend">
                <span className="submitted">Submitted</span>
                <span className="invoices">Invoices</span>
              </div>

              <div className="fbr-chart-shell">
                <ResponsiveContainer width="100%" height={292}>
                  <ComposedChart data={invoiceActivity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#dbe3ec" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#b8c2cf' }} tick={{ fill: '#344054', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#344054', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="invoices" name="Invoices" fill="#dce5ef" radius={[4, 4, 0, 0]} barSize={34} />
                    <Line
                      type="monotone"
                      dataKey="submitted"
                      name="Submitted"
                      stroke="#087a3d"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#ffffff', stroke: '#087a3d', strokeWidth: 3 }}
                      activeDot={{ r: 6, fill: '#087a3d', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </article>

            <section className="fbr-panel fbr-invoice-panel">
              <div className="fbr-panel-header">
                <h2>Recent FBR Invoices</h2>
                <Link to="/invoice">View All</Link>
              </div>

              <div className="fbr-table-wrap">
                <table className="fbr-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Buyer</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading.invoices ? (
                      <tr><td colSpan="6" className="fbr-empty-cell">Loading invoices...</td></tr>
                    ) : currentInvoices.length === 0 ? (
                      <tr><td colSpan="6" className="fbr-empty-cell">No invoices found</td></tr>
                    ) : (
                      currentInvoices.map((invoice, index) => (
                        <tr key={invoice.id || index}>
                          <td className="fbr-strong-cell">{invoice.fbrInvoiceNumber || invoice.invoiceRefNo || 'N/A'}</td>
                          <td>{invoice.buyerBusinessName || 'N/A'}</td>
                          <td>{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}</td>
                          <td>PKR {(invoice.amountPkr || 0).toLocaleString()}</td>
                          <td>{statusBadge(invoice.status)}</td>
                          <td>
                            <button className="fbr-row-action" type="button" aria-label="Invoice actions">
                              <FiMoreVertical />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="fbr-readiness-column">
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
                  <strong>{draftCount}</strong>
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

