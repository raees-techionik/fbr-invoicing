import React, { useState, useEffect, useRef } from 'react';
import { FiCalendar, FiEdit, FiRefreshCw, FiSearch, FiTrash2, FiUserPlus } from 'react-icons/fi';
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

function Customers() {
  useBlockBackButton();
  const [customers, setCustomers] = useState([]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(emptyCustomerForm);
  const [apiError, setApiError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
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
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      setApiError(error.response?.data?.error || 'Error deleting customer.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
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

    const createdAt = customer.created_at || customer.createdAt;
    const customerDate = createdAt ? new Date(createdAt) : null;
    const fromDate = dateFilter.from ? new Date(dateFilter.from) : null;
    const toDate = dateFilter.to ? new Date(new Date(dateFilter.to).setHours(23, 59, 59, 999)) : null;
    const matchesDate =
      (!fromDate || (customerDate && customerDate >= fromDate)) &&
      (!toDate || (customerDate && customerDate <= toDate));

    return matchesSearch && matchesDate;
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
  const provinceCount = new Set(customers.map(customer => customerProvince(customer)).filter(Boolean)).size;
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const paginatedCustomers = sortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
          <button className="customers-secondary-action" onClick={fetchCustomers} disabled={loading.fetch}>
            <FiRefreshCw size={16} /> Refresh
          </button>
          <button className="customers-primary-action" onClick={handleShowAddModal} disabled={loading.add}>
            {loading.add ? <Spinner sm /> : <><FiUserPlus size={17} /> Add Customer</>}
          </button>
        </div>
      </div>

      <div className="customers-stat-grid">
        <div>
          <span>Total customers</span>
          <strong>{customers.length}</strong>
        </div>
        <div>
          <span>Registered</span>
          <strong className="success">{registeredCount}</strong>
        </div>
        <div>
          <span>Unregistered</span>
          <strong>{unregisteredCount}</strong>
        </div>
        <div>
          <span>Provinces</span>
          <strong>{provinceCount}</strong>
        </div>
      </div>

      <section className="customers-panel">
        <div className="customers-panel__top">
          <div>
            <h2>All Customers</h2>
            <p>{sortedCustomers.length} customer{sortedCustomers.length !== 1 ? 's' : ''} match the current view.</p>
          </div>
          <div className="customers-toolbar">
            <label className="customers-search">
              <FiSearch size={16} />
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
              <FiCalendar size={15} />
              <input type="date" name="from" value={dateFilter.from} onChange={handleDateFilterChange} />
            </label>
            <label className="customers-date-filter">
              <FiCalendar size={15} />
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

        {apiError && <div className="customers-error">{apiError}</div>}

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>CNIC/NTN</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Province</th>
                <th>Registration</th>
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
                    <td>
                      <strong>{customerName(customer) || '-'}</strong>
                      <span>{customerRegistrationType(customer) || 'No registration type'}</span>
                    </td>
                    <td className="customers-ref">{customerCnic(customer) || '-'}</td>
                    <td>{customerPhone(customer) || '-'}</td>
                    <td>{customerEmail(customer) || '-'}</td>
                    <td>{customerProvince(customer) || '-'}</td>
                    <td>
                      <span className={`customers-status ${customerRegistrationType(customer) === 'Registered' ? 'success' : 'neutral'}`}>
                        {customerRegistrationType(customer) || '-'}
                      </span>
                    </td>
                    <td className="customers-address">{customerAddress(customer) || '-'}</td>
                    <td>
                      <div className="customers-row-actions">
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
