import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiDownload, FiEdit, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { LuEye } from 'react-icons/lu';
import useBlockBackButton from '../Components/useBlockBackButton';
import { getServices, getService, createService, updateService, deleteService } from '../services/servicesApi';
import './Services.css';

const emptyServiceForm = {
  service_name: '',
  rate: '',
  unit_of_measure: '',
  sales_tax: '',
  description: '',
};

const avatarTones = ['av-p', 'av-b', 'av-g', 'av-o', 'av-s'];

const serviceName = (s) => s.service_name || s.serviceName || '';
const serviceRate = (s) => s.rate ?? '';
const serviceUom = (s) => s.unit_of_measure || s.unitOfMeasure || '';
const serviceTax = (s) => s.sales_tax ?? s.salesTax ?? '';
const serviceDesc = (s) => s.description || '';

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function toneFor(id, name) {
  const seed = String(id || name || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return avatarTones[seed % avatarTones.length];
}

function downloadCsv(rows) {
  if (!rows.length) return;
  const headers = ['Service Name', 'Rate', 'Unit of Measure', 'Sales Tax (%)', 'Description'];
  const lines = [headers.join(',')];
  rows.forEach((s) => {
    const vals = [serviceName(s), serviceRate(s), serviceUom(s), serviceTax(s), serviceDesc(s)];
    lines.push(vals.map((v) => `"${String(v || '').replaceAll('"', '""')}"`).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `services-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const CHIP_FILTERS = ['All', 'Consulting', 'Maintenance', 'Subscription'];

function Services() {
  useBlockBackButton();

  const [services, setServices] = useState([]);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState(emptyServiceForm);
  const [apiError, setApiError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [chipFilter, setChipFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewingService, setViewingService] = useState(null);
  const [loading, setLoading] = useState({
    add: false,
    edit: false,
    delete: false,
    fetch: false,
    fetchSingle: false,
    fetchSingleEdit: false,
  });
  const itemsPerPage = 8;
  const modalRef = useRef();

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchServices = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, fetch: true }));
      const data = await getServices({ limit: 250 });
      setServices(data);
      setApiError('');
      return data;
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setApiError(error.response?.data?.error || 'Failed to fetch services.');
      return [];
    } finally {
      setLoading(prev => ({ ...prev, fetch: false }));
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) return undefined;
    const handleHidden = () => {
      document.body.classList.remove('modal-open');
      Array.from(document.getElementsByClassName('modal-backdrop')).forEach(b => b.remove());
    };
    modalElement.addEventListener('hidden.bs.modal', handleHidden);
    return () => modalElement.removeEventListener('hidden.bs.modal', handleHidden);
  }, []);

  // ─── Modal helpers ────────────────────────────────────────────────────────

  const hideModal = () => {
    try {
      const instance = window.bootstrap?.Modal?.getInstance(modalRef.current);
      if (instance) { instance.hide(); return; }
    } catch (e) {}
    if (modalRef.current) {
      modalRef.current.classList.remove('show');
      modalRef.current.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    Array.from(document.getElementsByClassName('modal-backdrop')).forEach(b => b.remove());
  };

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData(emptyServiceForm);
    setApiError('');
    window.bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
  };

  const handleOpenEdit = async (serviceId) => {
    setApiError('');
    try {
      setLoading(prev => ({ ...prev, fetchSingleEdit: true }));
      const service = await getService(serviceId);
      setEditingService(service);
      setFormData({
        service_name: serviceName(service),
        rate: serviceRate(service),
        unit_of_measure: serviceUom(service),
        sales_tax: serviceTax(service),
        description: serviceDesc(service),
      });
      window.bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
    } catch (error) {
      console.error('Error fetching service:', error);
      setApiError(error.response?.data?.error || 'Error fetching service.');
    } finally {
      setLoading(prev => ({ ...prev, fetchSingleEdit: false }));
    }
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setApiError('');
    setLoading(prev => ({ ...prev, add: true }));
    try {
      const created = await createService(formData);
      hideModal();
      setFormData(emptyServiceForm);
      setEditingService(null);
      setCurrentPage(1);
      const refreshed = await fetchServices();
      setServices([created, ...refreshed.filter(s => s.id !== created.id)]);
    } catch (error) {
      console.error('Error saving service:', error);
      setApiError(error.response?.data?.error || error.message || 'Error saving service.');
    } finally {
      setLoading(prev => ({ ...prev, add: false }));
    }
  };

  const handleUpdate = async () => {
    if (!editingService?.id) return;
    setApiError('');
    setLoading(prev => ({ ...prev, edit: true }));
    try {
      await updateService(editingService.id, formData);
      hideModal();
      fetchServices();
    } catch (error) {
      console.error('Error updating service:', error);
      setApiError(error.response?.data?.error || error.message || 'Error updating service.');
    } finally {
      setLoading(prev => ({ ...prev, edit: false }));
    }
  };

  const handleDelete = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    setLoading(prev => ({ ...prev, delete: true }));
    try {
      await deleteService(serviceId);
      setApiError('');
      if (viewingService?.id === serviceId) setViewingService(null);
      setSelectedIds(prev => prev.filter(id => id !== serviceId));
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      setApiError(error.response?.data?.error || 'Error deleting service.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected service${selectedIds.length > 1 ? 's' : ''}?`)) return;
    setLoading(prev => ({ ...prev, delete: true }));
    try {
      await Promise.all(selectedIds.map(id => deleteService(id)));
      setSelectedIds([]);
      fetchServices();
    } catch (error) {
      console.error('Error deleting services:', error);
      setApiError(error.response?.data?.error || 'Error deleting selected services.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  // ─── Computed ─────────────────────────────────────────────────────────────

  const filteredServices = services.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
      serviceName(s).toLowerCase().includes(term) ||
      serviceUom(s).toLowerCase().includes(term) ||
      serviceDesc(s).toLowerCase().includes(term)
    );
  });

  const sortedServices = [...filteredServices].sort((a, b) => {
    switch (sortBy) {
      case 'Newest': return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      case 'Oldest': return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      case 'A-Z': return serviceName(a).localeCompare(serviceName(b));
      case 'Z-A': return serviceName(b).localeCompare(serviceName(a));
      case 'Rate-High': return parseFloat(serviceRate(b) || 0) - parseFloat(serviceRate(a) || 0);
      case 'Rate-Low': return parseFloat(serviceRate(a) || 0) - parseFloat(serviceRate(b) || 0);
      case 'Tax-High': return parseFloat(serviceTax(b) || 0) - parseFloat(serviceTax(a) || 0);
      case 'Tax-Low': return parseFloat(serviceTax(a) || 0) - parseFloat(serviceTax(b) || 0);
      default: return 0;
    }
  });

  const rates = services.map(s => parseFloat(serviceRate(s))).filter(Number.isFinite);
  const avgRate = rates.length ? Math.round(rates.reduce((t, r) => t + r, 0) / rates.length) : 0;
  const positiveTaxes = services.map(s => parseFloat(serviceTax(s))).filter(n => Number.isFinite(n) && n > 0);
  const avgTax = positiveTaxes.length ? Math.round(positiveTaxes.reduce((t, r) => t + r, 0) / positiveTaxes.length) : 0;
  const activeCount = services.filter(s => serviceName(s) && serviceRate(s) !== '').length;

  const totalPages = Math.ceil(sortedServices.length / itemsPerPage);
  const paginatedServices = sortedServices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const pageIds = paginatedServices.map(s => s.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const Spinner = () => (
    <span className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading...</span>
    </span>
  );

  return (
    <div className="svc-page">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="svc-page-hdr">
        <div className="svc-page-hdr__left">
          <h2>Services</h2>
          <p>Service items used as billable line items on invoices</p>
        </div>
        <div className="svc-page-hdr__right">
          <button className="svc-btn-outline" onClick={() => downloadCsv(sortedServices)}>
            <FiDownload size={13} /> Export CSV
          </button>
          <button className="svc-btn-primary" onClick={handleOpenAdd} disabled={loading.add}>
            {loading.add ? <Spinner /> : (
              <>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Service
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Mini Stats ───────────────────────────────────────────────────── */}
      <div className="svc-mini-stats">
        <div className="svc-mini-card c-p">
          <div className="svc-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div>
            <div className="svc-mini-num">{services.length}</div>
            <div className="svc-mini-lbl">Total Services</div>
          </div>
        </div>
        <div className="svc-mini-card c-b">
          <div className="svc-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div>
            <div className="svc-mini-num">PKR {avgRate.toLocaleString()}</div>
            <div className="svc-mini-lbl">Avg Rate</div>
          </div>
        </div>
        <div className="svc-mini-card c-g">
          <div className="svc-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <div className="svc-mini-num">{activeCount}</div>
            <div className="svc-mini-lbl">Active</div>
          </div>
        </div>
        <div className="svc-mini-card c-o">
          <div className="svc-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div className="svc-mini-num">{avgTax}%</div>
            <div className="svc-mini-lbl">Avg Sales Tax</div>
          </div>
        </div>
      </div>

      {/* ── Table Card ───────────────────────────────────────────────────── */}
      <div className="svc-tbl-card">

        {/* Filter Bar */}
        <div className="svc-filter-bar">
          <div className="svc-chip-row">
            {CHIP_FILTERS.map(f => (
              <span
                key={f}
                className={`svc-chip${chipFilter === f ? ' on' : ''}`}
                onClick={() => setChipFilter(f)}
              >{f}</span>
            ))}
          </div>
          <div className="svc-filter-sep" />
          <label className="svc-search">
            <FiSearch size={13} />
            <input
              type="search"
              placeholder="Search services…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </label>
          <select
            className="svc-sort-select"
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Sort: Name A→Z</option>
            <option value="Z-A">Sort: Name Z→A</option>
            <option value="Rate-High">Sort: Rate High→Low</option>
            <option value="Rate-Low">Sort: Rate Low→High</option>
            <option value="Tax-High">Sort: Tax High→Low</option>
            <option value="Tax-Low">Sort: Tax Low→High</option>
            <option value="Newest">Sort: Newest</option>
            <option value="Oldest">Sort: Oldest</option>
          </select>
          <span className="svc-results-count">
            Showing {paginatedServices.length} of {sortedServices.length}
          </span>
        </div>

        {apiError && <div className="svc-error">{apiError}</div>}

        {/* Table */}
        <div className="svc-tbl-wrap">
          <table className="svc-table">
            <thead>
              <tr>
                <th className="svc-th-check">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    style={{ accentColor: '#f05c44' }}
                  />
                </th>
                <th>
                  <div className="svc-th-inner">
                    Service Name
                    <span className="svc-sort-ico">
                      <svg viewBox="0 0 24 24"><line x1="12" y1="20" x2="12" y2="4"/><polyline points="6 10 12 4 18 10"/></svg>
                    </span>
                  </div>
                </th>
                <th>Rate (PKR)</th>
                <th>Unit</th>
                <th>Sales Tax</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading.fetch ? (
                <tr>
                  <td colSpan="7" className="svc-empty-cell"><Spinner /> Loading services...</td>
                </tr>
              ) : paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="svc-empty-cell">No services found</td>
                </tr>
              ) : (
                paginatedServices.map(service => {
                  const tone = toneFor(service.id, serviceName(service));
                  const initials = initialsOf(serviceName(service));
                  const tax = parseFloat(serviceTax(service) || 0);
                  return (
                    <tr key={service.id}>
                      <td className="svc-th-check">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(service.id)}
                          onChange={() => toggleSelectOne(service.id)}
                          style={{ accentColor: '#f05c44' }}
                        />
                      </td>
                      <td>
                        <div className="svc-name-cell">
                          <div className={`svc-row-avatar ${tone}`}>{initials}</div>
                          <div className="svc-row-name">{serviceName(service) || '-'}</div>
                        </div>
                      </td>
                      <td>
                        <span className="svc-amount">
                          {serviceRate(service) !== '' ? Number(serviceRate(service)).toLocaleString() : '-'}
                        </span>
                      </td>
                      <td>{serviceUom(service) || '-'}</td>
                      <td>
                        <span className={`svc-badge ${tax > 0 ? 'b-info' : 'b-neutral'}`}>
                          {serviceTax(service) !== '' ? `${serviceTax(service)}%` : '0%'}
                        </span>
                      </td>
                      <td className="svc-muted">{serviceDesc(service) || '-'}</td>
                      <td>
                        <div className="svc-acts">
                          <button
                            className="svc-act-btn"
                            title="View"
                            onClick={() => setViewingService(service)}
                          >
                            <LuEye size={12} />
                          </button>
                          <button
                            className="svc-act-btn"
                            title="Edit"
                            onClick={() => handleOpenEdit(service.id)}
                            disabled={loading.fetchSingleEdit}
                          >
                            {loading.fetchSingleEdit ? <Spinner /> : <FiEdit size={12} />}
                          </button>
                          <button
                            className="svc-act-btn danger"
                            title="Delete"
                            onClick={() => handleDelete(service.id)}
                            disabled={loading.delete}
                          >
                            {loading.delete ? <Spinner /> : <FiTrash2 size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="svc-pager">
            <span className="svc-pager-info">
              Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, sortedServices.length)} of {sortedServices.length} services
            </span>
            <div className="svc-pager-btns">
              <button
                className="svc-pg-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >‹</button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  className={`svc-pg-btn${i + 1 === currentPage ? ' on' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >{i + 1}</button>
              ))}
              <button
                className="svc-pg-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Slide-in Panel ────────────────────────────────────────── */}
      <div
        className={`svc-overlay${viewingService ? ' open' : ''}`}
        onClick={() => setViewingService(null)}
      />
      <div className={`svc-panel${viewingService ? ' open' : ''}`}>
        {viewingService && (
          <>
            <div className="svc-dp-hdr">
              <div>
                <div className="svc-dp-title">Service Details</div>
                <div className="svc-dp-sub">Billable item configuration</div>
              </div>
              <button className="svc-dp-close" onClick={() => setViewingService(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="svc-dp-body">
              <div className="svc-dp-avatar-wrap">
                <div className={`svc-dp-avatar ${toneFor(viewingService.id, serviceName(viewingService))}`}>
                  {initialsOf(serviceName(viewingService))}
                </div>
                <div className="svc-dp-av-name">{serviceName(viewingService) || '-'}</div>
                <div className="svc-dp-av-type">
                  <span className="svc-badge b-ok" style={{ fontSize: 11 }}>Active</span>
                </div>
              </div>

              <div className="svc-dp-section">
                <div className="svc-dp-section-title">Pricing</div>
                <div className="svc-dp-row">
                  <span className="svc-dp-row-key">Rate</span>
                  <span className="svc-dp-row-val">
                    PKR {serviceRate(viewingService) !== '' ? Number(serviceRate(viewingService)).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="svc-dp-row">
                  <span className="svc-dp-row-key">Unit of Measure</span>
                  <span className="svc-dp-row-val">{serviceUom(viewingService) || '-'}</span>
                </div>
                <div className="svc-dp-row">
                  <span className="svc-dp-row-key">Sales Tax</span>
                  <span className="svc-dp-row-val">
                    {serviceTax(viewingService) !== '' ? `${serviceTax(viewingService)}%` : '0%'}
                  </span>
                </div>
              </div>

              {serviceDesc(viewingService) && (
                <div className="svc-dp-section">
                  <div className="svc-dp-section-title">Description</div>
                  <div className="svc-dp-row" style={{ justifyContent: 'flex-start' }}>
                    <span className="svc-dp-row-val" style={{ textAlign: 'left' }}>
                      {serviceDesc(viewingService)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="svc-dp-footer">
              <button
                className="svc-dp-btn-edit"
                onClick={() => {
                  const id = viewingService.id;
                  setViewingService(null);
                  handleOpenEdit(id);
                }}
              >Edit Service</button>
              <button
                className="svc-dp-btn-del"
                onClick={() => handleDelete(viewingService.id)}
              >Delete</button>
            </div>
          </>
        )}
      </div>

      {/* ── Bulk Action Bar ──────────────────────────────────────────────── */}
      <div className={`svc-bulk-bar${selectedIds.length ? ' show' : ''}`}>
        <span className="svc-bulk-count">{selectedIds.length} selected</span>
        <div className="svc-bulk-sep" />
        <button
          className="svc-bulk-btn primary"
          onClick={() => downloadCsv(services.filter(s => selectedIds.includes(s.id)))}
        >Export Selected</button>
        <button className="svc-bulk-btn danger" onClick={handleBulkDelete}>Delete</button>
        <button className="svc-bulk-close" onClick={() => setSelectedIds([])}>
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      <div
        className="modal fade svc-modal-shell"
        id="serviceModal"
        tabIndex="-1"
        aria-hidden="true"
        ref={modalRef}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content svc-modal">
            <div className="svc-modal__header">
              <div>
                <span>Service Catalog</span>
                <h2>{editingService ? 'Edit Service' : 'Add Service'}</h2>
              </div>
              <button
                type="button"
                className="svc-modal__close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >&times;</button>
            </div>

            <div className="svc-modal__body">
              {apiError && <div className="svc-error">{apiError}</div>}
              {loading.fetchSingleEdit ? (
                <div className="svc-modal-loading"><Spinner /> Loading service data...</div>
              ) : (
                <div className="svc-form-grid">
                  <label>
                    <span>Service Name</span>
                    <input
                      name="service_name"
                      value={formData.service_name}
                      onChange={handleInputChange}
                      placeholder="e.g. IT Consulting Services"
                    />
                  </label>
                  <label>
                    <span>Rate (Per Unit)</span>
                    <input
                      name="rate"
                      type="number"
                      value={formData.rate}
                      onChange={handleInputChange}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    <span>Unit of Measure</span>
                    <select name="unit_of_measure" value={formData.unit_of_measure} onChange={handleInputChange}>
                      <option value="">Select Unit</option>
                      <option value="Per Hour">Per Hour</option>
                      <option value="Per Visit">Per Visit</option>
                      <option value="Per License">Per License</option>
                      <option value="Per Month">Per Month</option>
                      <option value="Per Session">Per Session</option>
                      <option value="Per Engagement">Per Engagement</option>
                      <option value="Hour">Hour</option>
                      <option value="Kg">Kg</option>
                      <option value="Unit">Unit</option>
                      <option value="Liter">Liter</option>
                    </select>
                  </label>
                  <label>
                    <span>Sales Tax (%)</span>
                    <input
                      name="sales_tax"
                      type="number"
                      value={formData.sales_tax}
                      onChange={handleInputChange}
                      placeholder="0"
                    />
                  </label>
                  <label className="svc-form-grid__wide">
                    <span>Description</span>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Brief description of the service…"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="svc-modal__footer">
              <button type="button" className="svc-btn-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="svc-btn-primary"
                onClick={editingService ? handleUpdate : handleSave}
                disabled={loading.add || loading.edit}
              >
                {loading.add || loading.edit ? <Spinner /> : (editingService ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Services;
