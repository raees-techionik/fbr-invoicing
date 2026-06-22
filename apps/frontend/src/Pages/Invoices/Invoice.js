import React, { useEffect, useMemo, useState } from 'react';
import './Invoice.css';
import { Link } from 'react-router-dom';
import {
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEye,
  FiFileText,
  FiFilter,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUsers,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import useBlockBackButton from '../../Components/useBlockBackButton';
import { toast } from 'react-toastify';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateInvoicePdfFromRecord } from '../../utils/generateInvoicePdf';
import { getDashboardInvoices, deleteDashboardInvoice } from '../../services/fbrDashboardApi';
import { getInvoiceDetail } from '../../services/fbrInvoiceApi';
import { getCustomers } from '../../services/customersApi';

const getInvoiceRef = (invoice) => invoice.invoice_ref_no || invoice.invoiceRefNo || invoice.invoiceRefNumber || `INV-${(invoice.id?.toString() || '').slice(-6)}`;
const getFbrNumber = (invoice) => invoice.fbr_invoice_number || invoice.fbrInvoiceNumber || '-';
const getBuyerName = (invoice) => invoice.buyer_business_name || invoice.buyerBusinessName || 'N/A';
const getInvoiceDate = (invoice) => invoice.invoice_date || invoice.invoiceDate;
const getAmount = (invoice) => Number(invoice.amount_pkr ?? invoice.amountPkr ?? invoice.totalAmount ?? 0);
const getStatus = (invoice) => (invoice.status || 'DRAFT').toUpperCase();

const statusFilters = [
  { key: 'ALL', label: 'All' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'FAILED', label: 'Failed' },
];

function Invoice() {
  useBlockBackButton();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState({ key: 'date', dir: 'desc' });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await getDashboardInvoices({ limit: 250 });
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await getCustomers({ limit: 250 });
      setCustomers(data || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const filteredInvoices = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const status = getStatus(invoice);
      const matchesStatus = statusFilter === 'ALL'
        || status === statusFilter
        || (statusFilter === 'FAILED' && ['FAILED', 'UPLOAD_FAILED', 'REJECTED'].includes(status));

      if (!matchesStatus) return false;
      if (!lower) return true;

      return [
        getInvoiceRef(invoice),
        getFbrNumber(invoice),
        getBuyerName(invoice),
        getInvoiceDate(invoice),
        invoice.id,
      ].some((field) => String(field || '').toLowerCase().includes(lower));
    });
  }, [invoices, searchTerm, statusFilter]);

  useEffect(() => {
    setPage(1);
    setSelectedInvoices([]);
  }, [searchTerm, statusFilter, sortBy, rowsPerPage]);

  const sortedInvoices = useMemo(() => {
    const comparators = {
      date: (a, b) => new Date(getInvoiceDate(a) || 0) - new Date(getInvoiceDate(b) || 0),
      buyer: (a, b) => getBuyerName(a).localeCompare(getBuyerName(b)),
      ref: (a, b) => getInvoiceRef(a).localeCompare(getInvoiceRef(b)),
      amount: (a, b) => getAmount(a) - getAmount(b),
      status: (a, b) => getStatus(a).localeCompare(getStatus(b)),
    };

    const arr = [...filteredInvoices];
    const cmp = comparators[sortBy.key] || comparators.date;
    arr.sort(cmp);
    if (sortBy.dir === 'desc') arr.reverse();
    return arr;
  }, [filteredInvoices, sortBy]);

  const totalPages = useMemo(() => {
    if (rowsPerPage === 'ALL') return 1;
    return Math.max(1, Math.ceil(sortedInvoices.length / Number(rowsPerPage)));
  }, [sortedInvoices, rowsPerPage]);

  const pageInvoices = useMemo(() => {
    if (rowsPerPage === 'ALL') return sortedInvoices;
    const size = Number(rowsPerPage);
    return sortedInvoices.slice((page - 1) * size, page * size);
  }, [sortedInvoices, rowsPerPage, page]);

  const selectedOnPage = pageInvoices.length > 0 && pageInvoices.every((invoice) => selectedInvoices.includes(invoice.id));

  const counts = useMemo(() => {
    const submitted = invoices.filter((invoice) => getStatus(invoice) === 'SUBMITTED').length;
    const failed = invoices.filter((invoice) => ['FAILED', 'UPLOAD_FAILED', 'REJECTED'].includes(getStatus(invoice))).length;
    const drafts = invoices.filter((invoice) => getStatus(invoice) === 'DRAFT').length;
    const amount = invoices.reduce((sum, invoice) => sum + getAmount(invoice), 0);

    return { submitted, failed, drafts, amount };
  }, [invoices]);

  const handleInvoiceSelect = (invoiceId) => {
    setSelectedInvoices((prev) =>
      prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId]
    );
  };

  const handleSelectPage = () => {
    const pageIds = pageInvoices.map((invoice) => invoice.id);
    if (selectedOnPage) {
      setSelectedInvoices((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedInvoices((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const loadInvoiceDetail = async (invoice) => {
    const detail = await getInvoiceDetail(invoice.id);
    return { ...invoice, ...detail };
  };

  const handleView = async (invoice) => {
    setCurrentInvoice(invoice);
    setShowViewPanel(true);
    try {
      setCurrentInvoice(await loadInvoiceDetail(invoice));
    } catch (error) {
      console.error('Failed to fetch invoice detail:', error);
      toast.error('Failed to load full invoice detail');
    }
  };

  const handleBulkDelete = () => {
    if (selectedInvoices.length === 0) {
      toast.warning('Please select at least one invoice to delete');
      return;
    }
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await Promise.all(selectedInvoices.map((id) => deleteDashboardInvoice(id)));
      toast.success(`${selectedInvoices.length} invoice(s) removed`);
      setSelectedInvoices([]);
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice(s):', error);
      toast.error('Failed to delete invoice(s)');
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const safeFileName = (name, fallback = 'invoice') =>
    (name || fallback).toString().trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);

  const handleDownload = async (idsOverride) => {
    const ids = idsOverride || selectedInvoices;
    if (ids.length === 0) {
      toast.warning('Please select at least one invoice to download');
      return;
    }

    setDownloadLoading(true);
    try {
      const selected = ids.map((id) => invoices.find((inv) => inv.id === id)).filter(Boolean);

      if (selected.length === 1) {
        const inv = await loadInvoiceDetail(selected[0]);
        const blob = await generateInvoicePdfFromRecord(inv);
        saveAs(blob, `${safeFileName(getBuyerName(inv), `invoice_${getInvoiceRef(inv)}`)}.pdf`);
        toast.success('Invoice downloaded');
      } else {
        const zip = new JSZip();
        for (const selectedInvoice of selected) {
          try {
            const inv = await loadInvoiceDetail(selectedInvoice);
            const blob = await generateInvoicePdfFromRecord(inv);
            zip.file(`${safeFileName(getBuyerName(inv), `invoice_${getInvoiceRef(inv)}`)}.pdf`, blob);
          } catch (e) {
            console.error('PDF error for', selectedInvoice?.id, e);
          }
        }
        const zipContent = await zip.generateAsync({ type: 'blob' });
        saveAs(zipContent, `invoices_${selected.length}.zip`);
        toast.success(`${selected.length} invoices downloaded`);
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to generate invoices');
    } finally {
      setDownloadLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatAmount = (amount) => `PKR ${Number(amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

  const statusBadge = (status) => {
    const normalized = (status || 'DRAFT').toUpperCase();
    const tone = normalized === 'SUBMITTED'
      ? 'success'
      : ['FAILED', 'UPLOAD_FAILED', 'REJECTED'].includes(normalized)
        ? 'danger'
        : normalized === 'DRAFT'
          ? 'neutral'
          : 'warning';
    const symbol = tone === 'success' ? '✓' : tone === 'danger' ? '✗' : '◎';

    return <span className={`invoice-status-badge ${tone}`}>{symbol} {normalized.replaceAll('_', ' ')}</span>;
  };

  const Spinner = () => (
    <div className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  );

  return (
    <div className="invoice-page">
      <header className="invoice-page__header">
        <div>
          <p>Invoices</p>
          <h1>Invoice Registry</h1>
          <span>Review FBR submissions, download PDFs, and manage locally stored invoice records.</span>
        </div>

        <div className="invoice-page__header-actions">
          <Link to="/invoice/upload" className="invoice-secondary-action">
            <FiUpload />
            Upload Invoice
          </Link>
          <Link to="/invoice/add" className="invoice-primary-action">
            <FiPlus />
            Create Invoice
          </Link>
        </div>
      </header>

      <section className="invoice-stat-grid" aria-label="Invoice metrics">
        <article className="invoice-stat-card">
          <div className="invoice-stat-icon green"><FiFileText /></div>
          <div>
            <span>Total Invoices</span>
            <strong>{invoices.length.toLocaleString()}</strong>
            <p>{formatAmount(counts.amount)} total value</p>
          </div>
        </article>
        <article className="invoice-stat-card">
          <div className="invoice-stat-icon green"><FiCheckCircle /></div>
          <div>
            <span>Submitted</span>
            <strong>{counts.submitted.toLocaleString()}</strong>
            <p>Accepted by FBR</p>
          </div>
        </article>
        <article className="invoice-stat-card">
          <div className="invoice-stat-icon red"><FiXCircle /></div>
          <div>
            <span>Failed</span>
            <strong>{counts.failed.toLocaleString()}</strong>
            <p>Needs review</p>
          </div>
        </article>
        <article className="invoice-stat-card">
          <div className="invoice-stat-icon gray"><FiUsers /></div>
          <div>
            <span>Customers</span>
            <strong>{customers.length.toLocaleString()}</strong>
            <p>Registered buyers</p>
          </div>
        </article>
      </section>

      <section className="invoice-panel">
        <div className="invoice-panel__top">
          <div>
            <h2>All Invoices</h2>
            <p>{filteredInvoices.length.toLocaleString()} records found</p>
          </div>

          <div className="invoice-status-tabs">
            {statusFilters.map((filter) => (
              <button
                type="button"
                key={filter.key}
                className={statusFilter === filter.key ? 'active' : ''}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="invoice-toolbar">
          <div className="invoice-filters">
            <div className="invoice-search">
              <FiSearch />
              <input
                type="search"
                placeholder="Search invoice, buyer, FBR no..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <label>
              <FiFilter />
              <select
                value={`${sortBy.key}:${sortBy.dir}`}
                onChange={(event) => {
                  const [key, dir] = event.target.value.split(':');
                  setSortBy({ key, dir });
                }}
              >
                <option value="date:desc">Newest</option>
                <option value="date:asc">Oldest</option>
                <option value="buyer:asc">Buyer A-Z</option>
                <option value="buyer:desc">Buyer Z-A</option>
                <option value="amount:desc">Highest Amount</option>
                <option value="amount:asc">Lowest Amount</option>
                <option value="status:asc">Status</option>
              </select>
            </label>
            <label>
              Rows
              <select
                value={rowsPerPage}
                onChange={(event) => {
                  const value = event.target.value === 'ALL' ? 'ALL' : Number(event.target.value);
                  setRowsPerPage(value);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="ALL">All</option>
              </select>
            </label>
          </div>
        </div>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedOnPage}
                    onChange={handleSelectPage}
                    aria-label="Select invoices on this page"
                  />
                </th>
                <th>Invoice No</th>
                <th>FBR Invoice No</th>
                <th>Buyer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="invoice-empty-cell"><Spinner /> Loading invoices...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan="8" className="invoice-empty-cell">No invoices found</td></tr>
              ) : (
                pageInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={() => handleInvoiceSelect(invoice.id)}
                        aria-label={`Select ${getInvoiceRef(invoice)}`}
                      />
                    </td>
                    <td className="invoice-strong-cell">{getInvoiceRef(invoice)}</td>
                    <td className="invoice-mono-cell">{getFbrNumber(invoice)}</td>
                    <td>{getBuyerName(invoice)}</td>
                    <td><FiCalendar /> {formatDate(getInvoiceDate(invoice))}</td>
                    <td>{formatAmount(getAmount(invoice))}</td>
                    <td>{statusBadge(getStatus(invoice))}</td>
                    <td>
                      <div className="invoice-row-actions">
                        <button className="invoice-icon-action" type="button" onClick={() => handleView(invoice)} title="View invoice">
                          <FiEye />
                        </button>
                        <button className="invoice-icon-action" type="button" onClick={() => handleDownload([invoice.id])} title="Download PDF">
                          <FiDownload />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rowsPerPage !== 'ALL' && totalPages > 1 && (
          <div className="invoice-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              <FiChevronLeft />
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
              Next
              <FiChevronRight />
            </button>
          </div>
        )}
      </section>

      {/* Slide-in detail panel */}
      <div className={`invoice-overlay ${showViewPanel ? 'open' : ''}`} onClick={() => setShowViewPanel(false)} />
      <div className={`invoice-detail-panel ${showViewPanel ? 'open' : ''}`}>
        {currentInvoice && (
          <>
            <div className="invoice-detail-panel__hdr">
              <div>
                <div className="invoice-detail-panel__title">{getInvoiceRef(currentInvoice)}</div>
                <div className="invoice-detail-panel__sub">Invoice details</div>
              </div>
              <button type="button" onClick={() => setShowViewPanel(false)} aria-label="Close"><FiX size={15} /></button>
            </div>
            <div className="invoice-detail-panel__body">
              <div className="invoice-detail-badge-wrap">
                {statusBadge(getStatus(currentInvoice))}
              </div>
              <div className="invoice-detail-section">
                <div className="invoice-detail-section__title">FBR Submission</div>
                <div className="invoice-detail-row"><span>FBR Invoice Number</span><strong>{getFbrNumber(currentInvoice)}</strong></div>
                <div className="invoice-detail-row"><span>Invoice Type</span><strong>{currentInvoice.invoice_type || currentInvoice.invoiceType || '-'}</strong></div>
                <div className="invoice-detail-row"><span>Source</span><strong>{currentInvoice.source || '-'}</strong></div>
                <div className="invoice-detail-row"><span>Submitted At</span><strong>{currentInvoice.created_at ? new Date(currentInvoice.created_at).toLocaleString() : '-'}</strong></div>
              </div>
              <div className="invoice-detail-section">
                <div className="invoice-detail-section__title">Buyer</div>
                <div className="invoice-detail-row"><span>Buyer Name</span><strong>{getBuyerName(currentInvoice)}</strong></div>
                <div className="invoice-detail-row"><span>Buyer NTN/CNIC</span><strong>{currentInvoice.buyer_ntn_cnic || currentInvoice.buyerNTNCNIC || '-'}</strong></div>
              </div>
              <div className="invoice-detail-section">
                <div className="invoice-detail-section__title">Amount</div>
                <div className="invoice-detail-row"><span>Invoice Date</span><strong>{formatDate(getInvoiceDate(currentInvoice))}</strong></div>
                <div className="invoice-detail-row"><span>Grand Total</span><strong className="invoice-success-text">{formatAmount(getAmount(currentInvoice))}</strong></div>
              </div>
            </div>
            <div className="invoice-detail-panel__footer">
              <button
                type="button"
                className="invoice-primary-action"
                onClick={async () => {
                  const inv = await loadInvoiceDetail(currentInvoice);
                  const blob = await generateInvoicePdfFromRecord(inv);
                  saveAs(blob, `${safeFileName(getBuyerName(inv), `invoice_${getInvoiceRef(inv)}`)}.pdf`);
                  toast.success('Invoice downloaded');
                }}
              >
                <FiDownload /> Download PDF
              </button>
            </div>
          </>
        )}
      </div>

      {/* Floating bulk action bar */}
      <div className={`invoice-bulk-bar ${selectedInvoices.length ? 'show' : ''}`}>
        <span>{selectedInvoices.length} selected</span>
        <div className="invoice-bulk-bar__sep" />
        <button type="button" onClick={() => handleDownload()} disabled={downloadLoading}>
          {downloadLoading ? <Spinner /> : <FiDownload size={14} />} Download
        </button>
        <button type="button" className="danger" onClick={handleBulkDelete}>
          <FiTrash2 size={14} /> Delete
        </button>
        <button type="button" className="close" onClick={() => setSelectedInvoices([])} aria-label="Clear selection"><FiX size={14} /></button>
      </div>

      {showDeleteModal && (
        <div className="invoice-modal-backdrop">
          <div className="invoice-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-delete-title">
            <div className="invoice-modal__header">
              <div>
                <p>Confirm Delete</p>
                <h2 id="invoice-delete-title">Remove selected invoices?</h2>
              </div>
              <button type="button" onClick={() => setShowDeleteModal(false)} aria-label="Close delete confirmation">×</button>
            </div>
            <p className="invoice-modal-copy">
              Remove {selectedInvoices.length} selected invoice record(s) from the dashboard? FBR submission records are not affected.
            </p>
            <div className="invoice-modal__footer">
              <button type="button" className="invoice-secondary-action" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                Cancel
              </button>
              <button type="button" className="invoice-danger-action" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? <Spinner /> : <FiTrash2 />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoice;
