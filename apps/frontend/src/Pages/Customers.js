import React, { useState, useEffect, useRef } from 'react';
import { FiCalendar, FiDownload, FiEdit, FiEye, FiRefreshCw, FiSearch, FiTrash2, FiUserPlus, FiX } from 'react-icons/fi';
import useBlockBackButton from '../Components/useBlockBackButton';
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from '../services/customersApi';
import './Customers.css';

const emptyCustomerForm = {
  name: '',
  cnic: '',
  phone: '',
  email: '',
  province: '',
  address: '',
  registration_type: '',
};

const provinceOptions = ['Punjab', 'Sindh', 'Balochistan', 'KPK'];
const registrationTypeOptions = ['Registered', 'Unregistered', 'Retail Consumer'];
const typeFilters = ['All', 'Registered', 'Unregistered', 'Retail Consumer'];
const avatarTones = ['av-p', 'av-b', 'av-g', 'av-o', 'av-s'];

const customerName = (customer) => customer.name || '';
const customerCnic = (customer) => customer.cnic || '';
const customerPhone = (customer) => customer.phone || '';
const customerEmail = (customer) => customer.email || '';
const customerProvince = (customer) => customer.province || '';
const customerAddress = (customer) => customer.address || '';
const customerRegistrationType = (customer) => {
  const value = customer.registration_type || customer.registrationType || '';
  if (value === 'registered') return 'Registered';
  if (value === 'unregister' || value === 'unregistered') return 'Unregistered';
  return value;
};

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

function downloadCsv(rows, filename) {
  if (!rows.length) return;
  const headers = ['Name', 'CNIC/NTN', 'Phone', 'Email', 'Province', 'Registration Type', 'Address'];
  const lines = [headers.join(',')];
  rows.forEach((c) => {
    const vals = [customerName(c), customerCnic(c), customerPhone(c), customerEmail(c), customerProvince(c), customerRegistrationType(c), customerAddress(c)];
    lines.push(vals.map((v) => `"${String(v || '').replaceAll('"', '""')}"`).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function Customers() {
  useBlockBackButton();
  const [customers, setCustomers] = useState([]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(emptyCustomerForm);
  const [apiError, setApiError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [loading, setLoading] = useState({
    add: false,
    edit: false,
    delete: false,
    fetch: false,
    fetchSingle: false,
  });
  const itemsPerPage = 8;
  const modalRef = useRef();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(prev => ({ ...prev, fetch: true }));
      const data = await getCustomers({ limit: 250 });
      setCustomers(data);
      setApiError('');
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setApiError(error.response?.data?.error || 'Failed to fetch customers.');
    } finally {
      setLoading(prev => ({ ...prev, fetch: false }));
    }
  };

  const showModal = () => {
    window.bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
  };

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
    Array.from(document.getElementsByClassName('modal-backdrop')).forEach(backdrop => backdrop.remove());
  };

  const handleShowAddModal = () => {
    setEditingCustomer(null);
    setFormData(emptyCustomerForm);
    setApiError('');
    showModal();
  };

  const handleShowEditModal = async (customerId) => {
    setApiError('');
    try {
      setLoading(prev => ({ ...prev, fetchSingle: true }));
      const data = await getCustomer(customerId);
      setEditingCustomer({
        ...data,
        registration_type: customerRegistrationType(data),
      });
      showModal();
    } catch (error) {
      console.error('Error fetching customer:', error);
      setApiError(error.response?.data?.error || 'Error fetching customer.');
    } finally {
      setLoading(prev => ({ ...prev, fetchSingle: false }));
    }
  };

  const activeForm = editingCustomer || formData;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (editingCustomer) {
      setEditingCustomer(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDateFilterChange = (e) => {
    const { name, value } = e.target;
    setDateFilter(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleSave = async () => {
    setApiError('');
    setLoading(prev => ({ ...prev, add: true }));
    try {
      await createCustomer(formData);
      hideModal();
      setFormData(emptyCustomerForm);
      setCurrentPage(1);
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      setApiError(error.response?.data?.error || error.message || 'Error saving customer.');
    } finally {
      setLoading(prev => ({ ...prev, add: false }));
    }
  };

  const handleUpdate = async () => {
    if (!editingCustomer) return;
    setApiError('');
    setLoading(prev => ({ ...prev, edit: true }));
    try {
      await updateCustomer(editingCustomer.id, editingCustomer);
      hideModal();
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error updating customer:', error);
      setApiError(error.response?.data?.error || error.message || 'Error updating customer.');
    } finally {
      setLoading(prev => ({ ...prev, edit: false }));
    }
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    setLoading(prev => ({ ...prev, delete: true }));
    try {
      await deleteCustomer(customerId);
      setSelectedIds((prev) => prev.filter((id) => id !== customerId));
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      setApiError(error.response?.data?.error || 'Error deleting customer.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected customer${selectedIds.length > 1 ? 's' : ''}?`)) return;
    setLoading(prev => ({ ...prev, delete: true }));
    try {
      await Promise.all(selectedIds.map((id) => deleteCustomer(id)));
      setSelectedIds([]);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customers:', error);
      setApiError(error.response?.data?.error || 'Error deleting selected customers.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const handleExportSelected = () => {
    const rows = customers.filter((c) => selectedIds.includes(c.id));
    downloadCsv(rows, `customers-selected-${Date.now()}.csv`);
  };

  const handleExportAll = () => {
    downloadCsv(sortedCustomers, `customers-${Date.now()}.csv`);
  };

  const filteredCustomers = customers.filter(customer => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = [
      customerName(customer),
      customerCnic(customer),
      customerPhone(customer),
      customerEmail(customer),
      customerProvince(customer),
      customerAddress(customer),
      customerRegistrationType(customer),
    ].some(value => value.toLowerCase().includes(term));

    const matchesType = typeFilter === 'All' || customerRegistrationType(customer) === typeFilter;

    const createdAt = customer.created_at || customer.createdAt;
    const customerDate = createdAt ? new Date(createdAt) : null;
    const fromDate = dateFilter.from ? new Date(dateFilter.from) : null;
    const toDate = dateFilter.to ? new Date(new Date(dateFilter.to).setHours(23, 59, 59, 999)) : null;
    const matchesDate =
      (!fromDate || (customerDate && customerDate >= fromDate)) &&
      (!toDate || (customerDate && customerDate <= toDate));

    return matchesSearch && matchesType && matchesDate;
  });

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    switch (sortBy) {
      case 'Newest':
        return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      case 'Oldest':
        return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      case 'A-Z':
        return customerName(a).localeCompare(customerName(b));
      case 'Z-A':
        return customerName(b).localeCompare(customerName(a));
      default:
        return 0;
    }
  });

  const registeredCount = customers.filter(customer => customerRegistrationType(customer) === 'Registered').length;
  const unregisteredCount = customers.filter(customer => customerRegistrationType(customer) === 'Unregistered').length;
  const retailCount = customers.filter(customer => customerRegistrationType(customer) === 'Retail Consumer').length;
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const paginatedCustomers = sortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const pageIds = paginatedCustomers.map((c) => c.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const Spinner = ({ sm } = {}) => (
    <span className={`spinner-border${sm ? ' spinner-border-sm' : ' spinner-border-sm'}`} role="status">
      <span className="visually-hidden">Loading...</span>
    </span>
  );

  return (
    <div className="customers-page">
      <div className="customers-header">
        <div>
          <span>Buyer directory</span>
          <h1>Customers</h1>
          <p>Manage buyer records used by Add Invoice autocomplete and FBR buyer details.</p>
        </div>

        <div className="customers-header__actions">
          <button className="customers-secondary-action" onClick={handleExportAll}>
            <FiDownload size={15} /> Export CSV
          </button>
          <button className="customers-secondary-action" onClick={fetchCustomers} disabled={loading.fetch}>
            <FiRefreshCw size={15} /> Refresh
          </button>
          <button className="customers-primary-action" onClick={handleShowAddModal} disabled={loading.add}>
            {loading.add ? <Spinner sm /> : <><FiUserPlus size={15} /> Add Customer</>}
          </button>
        </div>
      </div>

      <div className="customers-stat-grid">
        <div>
          <span>Total Customers</span>
          <strong>{customers.length}</strong>
        </div>
        <div>
          <span>Registered</span>
          <strong className="success">{registeredCount}</strong>
        </div>
        <div>
          <span>Unregistered</span>
          <strong className="warning">{unregisteredCount}</strong>
        </div>
        <div>
          <span>Retail Consumers</span>
          <strong className="info">{retailCount}</strong>
        </div>
      </div>

      <section className="customers-panel">
        <div className="customers-filter-bar">
          <div className="customers-chip-row">
            {typeFilters.map((type) => (
              <button
                key={type}
                type="button"
                className={`customers-chip ${typeFilter === type ? 'active' : ''}`}
                onClick={() => { setTypeFilter(type); setCurrentPage(1); }}
              >
                {type === 'All' ? 'All Types' : type}
              </button>
            ))}
          </div>

          <div className="customers-toolbar">
            <label className="customers-search">
              <FiSearch size={14} />
              <input
                type="search"
                placeholder="Search name, CNIC, email, province..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </label>
            <label className="customers-date-filter">
              <FiCalendar size={13} />
              <input type="date" name="from" value={dateFilter.from} onChange={handleDateFilterChange} />
            </label>
            <label className="customers-date-filter">
              <FiCalendar size={13} />
              <input type="date" name="to" value={dateFilter.to} onChange={handleDateFilterChange} />
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Sort by</option>
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
              <option value="A-Z">A-Z</option>
              <option value="Z-A">Z-A</option>
            </select>
          </div>
        </div>

        <div className="customers-results-count">{sortedCustomers.length} customer{sortedCustomers.length !== 1 ? 's' : ''} match the current view.</div>

        {apiError && <div className="customers-error">{apiError}</div>}

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th className="customers-checkbox-cell">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                </th>
                <th>Customer</th>
                <th>CNIC/NTN</th>
                <th>Contact</th>
                <th>Province</th>
                <th>Type</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading.fetch ? (
                <tr><td colSpan="8" className="customers-empty-cell"><Spinner sm /> Loading customers...</td></tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr><td colSpan="8" className="customers-empty-cell">No customers found</td></tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="customers-checkbox-cell">
                      <input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleSelectOne(customer.id)} />
                    </td>
                    <td>
                      <div className="customers-name-cell">
                        <div className={`customers-avatar ${toneFor(customer.id, customerName(customer))}`}>{initialsOf(customerName(customer))}</div>
                        <div>
                          <strong>{customerName(customer) || '-'}</strong>
                          <span>{customerRegistrationType(customer) || 'No registration type'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="customers-ref">{customerCnic(customer) || '-'}</td>
                    <td>
                      <div className="customers-contact-cell">
                        <span>{customerPhone(customer) || '-'}</span>
                        <small>{customerEmail(customer) || '-'}</small>
                      </div>
                    </td>
                    <td>{customerProvince(customer) || '-'}</td>
                    <td>
                      <span className={`customers-status ${customerRegistrationType(customer) === 'Registered' ? 'success' : customerRegistrationType(customer) === 'Retail Consumer' ? 'info' : 'neutral'}`}>
                        {customerRegistrationType(customer) || '-'}
                      </span>
                    </td>
                    <td className="customers-address">{customerAddress(customer) || '-'}</td>
                    <td>
                      <div className="customers-row-actions">
                        <button className="customers-icon-action" aria-label="View customer" onClick={() => setViewCustomer(customer)}>
                          <FiEye />
                        </button>
                        <button
                          className="customers-icon-action primary"
                          aria-label="Edit customer"
                          onClick={() => handleShowEditModal(customer.id)}
                          disabled={loading.fetchSingle}
                        >
                          {loading.fetchSingle ? <Spinner sm /> : <FiEdit />}
                        </button>
                        <button
                          className="customers-icon-action danger"
                          aria-label="Delete customer"
                          onClick={() => handleDelete(customer.id)}
                          disabled={loading.delete}
                        >
                          {loading.delete ? <Spinner sm /> : <FiTrash2 />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="customers-pagination">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                className={i + 1 === currentPage ? 'active' : ''}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Slide-in detail panel */}
      <div className={`customers-overlay ${viewCustomer ? 'open' : ''}`} onClick={() => setViewCustomer(null)} aria-hidden={!viewCustomer} />
      <div className={`customers-detail-panel ${viewCustomer ? 'open' : ''}`} aria-hidden={!viewCustomer}>
        {viewCustomer && (
          <>
            <div className="customers-detail-panel__hdr">
              <div>
                <div className="customers-detail-panel__title">Customer Profile</div>
                <div className="customers-detail-panel__sub">View buyer details</div>
              </div>
              <button type="button" onClick={() => setViewCustomer(null)} aria-label="Close"><FiX size={15} /></button>
            </div>
            <div className="customers-detail-panel__body">
              <div className="customers-detail-avatar-wrap">
                <div className={`customers-avatar lg ${toneFor(viewCustomer.id, customerName(viewCustomer))}`}>{initialsOf(customerName(viewCustomer))}</div>
                <div className="customers-detail-avatar-name">{customerName(viewCustomer) || '-'}</div>
                <span className={`customers-status ${customerRegistrationType(viewCustomer) === 'Registered' ? 'success' : customerRegistrationType(viewCustomer) === 'Retail Consumer' ? 'info' : 'neutral'}`}>
                  {customerRegistrationType(viewCustomer) || '-'}
                </span>
              </div>

              <div className="customers-detail-section">
                <div className="customers-detail-section__title">Business Details</div>
                <div className="customers-detail-row"><span>CNIC / NTN</span><strong>{customerCnic(viewCustomer) || '-'}</strong></div>
                <div className="customers-detail-row"><span>Province</span><strong>{customerProvince(viewCustomer) || '-'}</strong></div>
                <div className="customers-detail-row"><span>Address</span><strong>{customerAddress(viewCustomer) || '-'}</strong></div>
              </div>

              <div className="customers-detail-section">
                <div className="customers-detail-section__title">Contact</div>
                <div className="customers-detail-row"><span>Phone</span><strong>{customerPhone(viewCustomer) || '-'}</strong></div>
                <div className="customers-detail-row"><span>Email</span><strong>{customerEmail(viewCustomer) || '-'}</strong></div>
              </div>

              {(viewCustomer.created_at || viewCustomer.createdAt) && (
                <div className="customers-detail-section">
                  <div className="customers-detail-section__title">Record</div>
                  <div className="customers-detail-row"><span>Added</span><strong>{new Date(viewCustomer.created_at || viewCustomer.createdAt).toLocaleDateString()}</strong></div>
                </div>
              )}
            </div>
            <div className="customers-detail-panel__footer">
              <button className="customers-primary-action" type="button" onClick={() => { const id = viewCustomer.id; setViewCustomer(null); handleShowEditModal(id); }}>Edit Customer</button>
              <button className="customers-danger-action" type="button" onClick={() => { handleDelete(viewCustomer.id); setViewCustomer(null); }}>Delete</button>
            </div>
          </>
        )}
      </div>

      {/* Bulk action bar */}
      <div className={`customers-bulk-bar ${selectedIds.length ? 'show' : ''}`}>
        <span>{selectedIds.length} selected</span>
        <div className="customers-bulk-bar__sep" />
        <button type="button" onClick={handleExportSelected}>Export Selected</button>
        <button type="button" className="danger" onClick={handleBulkDelete}>Delete</button>
        <button type="button" className="close" onClick={() => setSelectedIds([])} aria-label="Clear selection"><FiX size={14} /></button>
      </div>

      <div className="modal fade customers-modal-shell" id="customerModal" tabIndex="-1" aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content customers-modal">
            <div className="customers-modal__header">
              <div>
                <span>Buyer Record</span>
                <h2>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
              </div>
              <button type="button" className="customers-modal__close" data-bs-dismiss="modal" aria-label="Close">&times;</button>
            </div>

            <div className="customers-modal__body">
              {apiError && <div className="customers-error">{apiError}</div>}
              {loading.fetchSingle && editingCustomer ? (
                <div className="customers-modal-loading"><Spinner sm /> Loading customer data...</div>
              ) : (
                <div className="customers-form-grid">
                  <label>
                    <span>Customer Name</span>
                    <input name="name" value={activeForm.name || ''} onChange={handleInputChange} />
                  </label>
                  <label>
                    <span>CNIC/NTN</span>
                    <input name="cnic" value={activeForm.cnic || ''} onChange={handleInputChange} />
                  </label>
                  <label>
                    <span>Phone Number</span>
                    <input name="phone" value={activeForm.phone || ''} onChange={handleInputChange} />
                  </label>
                  <label>
                    <span>Email</span>
                    <input name="email" value={activeForm.email || ''} onChange={handleInputChange} />
                  </label>
                  <label>
                    <span>Province</span>
                    <select name="province" value={activeForm.province || ''} onChange={handleInputChange}>
                      <option value="">Select Province</option>
                      {provinceOptions.map((province) => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Registration Type</span>
                    <select name="registration_type" value={activeForm.registration_type || ''} onChange={handleInputChange}>
                      <option value="">Select Registration Type</option>
                      {registrationTypeOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="customers-form-grid__wide">
                    <span>Address</span>
                    <input name="address" value={activeForm.address || ''} onChange={handleInputChange} />
                  </label>
                </div>
              )}
            </div>

            <div className="customers-modal__footer">
              <button type="button" className="customers-secondary-action" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="customers-primary-action"
                onClick={editingCustomer ? handleUpdate : handleSave}
                disabled={loading.add || loading.edit || loading.fetchSingle}
              >
                {loading.add || loading.edit ? <Spinner sm /> : (editingCustomer ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Customers;
