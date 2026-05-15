import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiEdit, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi';
import { FaPlus } from 'react-icons/fa6';
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

const serviceName = (service) => service.service_name || service.serviceName || '';
const serviceRate = (service) => service.rate ?? '';
const serviceUom = (service) => service.unit_of_measure || service.unitOfMeasure || '';
const serviceTax = (service) => service.sales_tax ?? service.salesTax ?? '';
const serviceDescription = (service) => service.description || '';

function Services() {
  useBlockBackButton();

  const [services, setServices] = useState([]);
  const [editingService, setEditingService] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [formData, setFormData] = useState(emptyServiceForm);
  const [apiError, setApiError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState({
    add: false,
    edit: false,
    delete: false,
    fetch: false,
    fetchSingle: false,
    fetchSingleEdit: false,
    fetchSingleView: false,
  });
  const itemsPerPage = 8;
  const modalRef = useRef();

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

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) return undefined;

    const handleHidden = () => {
      document.body.classList.remove('modal-open');
      Array.from(document.getElementsByClassName('modal-backdrop')).forEach(backdrop => backdrop.remove());
    };

    modalElement.addEventListener('hidden.bs.modal', handleHidden);
    return () => modalElement.removeEventListener('hidden.bs.modal', handleHidden);
  }, []);

  const hideModal = () => {
    try {
      const instance = window.bootstrap?.Modal?.getInstance(modalRef.current);
      if (instance) {
        instance.hide();
        return;
      }
    } catch (error) {}

    if (modalRef.current) {
      modalRef.current.classList.remove('show');
      modalRef.current.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    Array.from(document.getElementsByClassName('modal-backdrop')).forEach(backdrop => backdrop.remove());
  };

  const handleShowModal = async (serviceId = null, viewOnly = false) => {
    setApiError('');

    if (serviceId !== null) {
      try {
        setLoading(prev => ({
          ...prev,
          fetchSingle: true,
          fetchSingleView: viewOnly,
          fetchSingleEdit: !viewOnly,
        }));
        const service = await getService(serviceId);
        setEditingService(service);
        setFormData({
          service_name: serviceName(service),
          rate: serviceRate(service),
          unit_of_measure: serviceUom(service),
          sales_tax: serviceTax(service),
          description: serviceDescription(service),
        });
      } catch (error) {
        console.error('Error fetching service:', error);
        setApiError(error.response?.data?.error || 'Error fetching service.');
        return;
      } finally {
        setLoading(prev => ({
          ...prev,
          fetchSingle: false,
          fetchSingleView: false,
          fetchSingleEdit: false,
        }));
      }
    } else {
      setFormData(emptyServiceForm);
      setEditingService(null);
    }

    setIsReadOnly(viewOnly);
    window.bootstrap.Modal.getOrCreateInstance(modalRef.current).show();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setApiError('');
    setLoading(prev => ({ ...prev, add: true }));

    try {
      const createdService = await createService(formData);
      hideModal();
      setFormData(emptyServiceForm);
      setEditingService(null);
      setCurrentPage(1);
      const refreshedServices = await fetchServices();
      setServices([
        createdService,
        ...refreshedServices.filter(service => service.id !== createdService.id),
      ]);
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
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      setApiError(error.response?.data?.error || 'Error deleting service.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const filteredServices = (services || []).filter(service => {
    if (!service) return false;
    const term = searchTerm.toLowerCase();
    return (
      serviceName(service).toLowerCase().includes(term) ||
      serviceUom(service).toLowerCase().includes(term) ||
      serviceDescription(service).toLowerCase().includes(term)
    );
  });

  const sortedServices = [...filteredServices].sort((a, b) => {
    switch (sortBy) {
      case 'Newest':
        return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      case 'Oldest':
        return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      case 'A-Z':
        return serviceName(a).localeCompare(serviceName(b));
      case 'Z-A':
        return serviceName(b).localeCompare(serviceName(a));
      case 'Rate-High':
        return parseFloat(serviceRate(b) || 0) - parseFloat(serviceRate(a) || 0);
      case 'Rate-Low':
        return parseFloat(serviceRate(a) || 0) - parseFloat(serviceRate(b) || 0);
      case 'Tax-High':
        return parseFloat(serviceTax(b) || 0) - parseFloat(serviceTax(a) || 0);
      case 'Tax-Low':
        return parseFloat(serviceTax(a) || 0) - parseFloat(serviceTax(b) || 0);
      default:
        return 0;
    }
  });

  const unitCount = new Set(services.map(service => serviceUom(service)).filter(Boolean)).size;
  const taxableCount = services.filter(service => parseFloat(serviceTax(service) || 0) > 0).length;
  const rates = services.map(service => parseFloat(serviceRate(service))).filter(rate => Number.isFinite(rate));
  const averageRate = rates.length ? Math.round(rates.reduce((total, rate) => total + rate, 0) / rates.length) : 0;
  const totalPages = Math.ceil(sortedServices.length / itemsPerPage);
  const paginatedServices = sortedServices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const Spinner = ({ sm } = {}) => (
    <span className={`spinner-border${sm ? ' spinner-border-sm' : ' spinner-border-sm'}`} role="status">
      <span className="visually-hidden">Loading...</span>
    </span>
  );

  return (
    <div className="services-page">
      <div className="services-header">
        <div>
          <span>Service catalog</span>
          <h1>Services</h1>
          <p>Manage service rates, unit measures, tax, and descriptions used in invoicing workflows.</p>
        </div>

        <div className="services-header__actions">
          <button className="services-secondary-action" onClick={fetchServices} disabled={loading.fetch}>
            <FiRefreshCw size={16} /> Refresh
          </button>
          <button
            className="services-primary-action"
            onClick={() => handleShowModal()}
            disabled={loading.add}
          >
            {loading.add ? <Spinner sm /> : <><FaPlus /> Add Service</>}
          </button>
        </div>
      </div>

      <div className="services-stat-grid">
        <div>
          <span>Total services</span>
          <strong>{services.length}</strong>
        </div>
        <div>
          <span>Taxable</span>
          <strong className="success">{taxableCount}</strong>
        </div>
        <div>
          <span>Unit types</span>
          <strong>{unitCount}</strong>
        </div>
        <div>
          <span>Avg rate</span>
          <strong className="success">Rs {averageRate}</strong>
        </div>
      </div>

      <section className="services-panel">
        <div className="services-panel__top">
          <div>
            <h2>All Services</h2>
            <p>{sortedServices.length} service{sortedServices.length !== 1 ? 's' : ''} match the current view.</p>
          </div>
          <div className="services-toolbar">
            <label className="services-search">
              <FiSearch size={16} />
              <input
                type="search"
                placeholder="Search name, UOM, description..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
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
              <option value="A-Z">Name (A-Z)</option>
              <option value="Z-A">Name (Z-A)</option>
              <option value="Rate-High">Rate (High to Low)</option>
              <option value="Rate-Low">Rate (Low to High)</option>
              <option value="Tax-High">Tax (High to Low)</option>
              <option value="Tax-Low">Tax (Low to High)</option>
            </select>
          </div>
        </div>

        {apiError && <div className="services-error">{apiError}</div>}

        <div className="services-table-wrap">
          <table className="services-table">
            <thead>
              <tr>
                <th>Tracking No</th>
                <th>Service Name</th>
                <th>Rate</th>
                <th>UOM</th>
                <th>Sales Tax</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading.fetch ? (
                <tr>
                  <td colSpan="7" className="services-empty-cell"><Spinner sm /> Loading services...</td>
                </tr>
              ) : paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="services-empty-cell">No services found</td>
                </tr>
              ) : (
                paginatedServices.map((service) => (
                  <tr key={service.id}>
                    <td className="services-ref">#{service.id}</td>
                    <td>
                      <strong>{serviceName(service) || '-'}</strong>
                      <span>{serviceUom(service) || 'No unit set'}</span>
                    </td>
                    <td>{serviceRate(service) !== '' ? `Rs ${serviceRate(service)}` : '-'}</td>
                    <td>{serviceUom(service) || '-'}</td>
                    <td>
                      <span className={`services-status ${parseFloat(serviceTax(service) || 0) > 0 ? 'success' : 'neutral'}`}>
                        {serviceTax(service) !== '' ? `${serviceTax(service)}%` : 'No tax'}
                      </span>
                    </td>
                    <td>{serviceDescription(service) || '-'}</td>
                    <td>
                      <div className="services-row-actions">
                        <button
                          className="services-icon-action success"
                          aria-label="View service"
                          onClick={() => handleShowModal(service.id, true)}
                          disabled={loading.fetchSingleView}
                        >
                          {loading.fetchSingleView ? <Spinner sm /> : <LuEye />}
                        </button>
                        <button
                          className="services-icon-action primary"
                          aria-label="Edit service"
                          onClick={() => handleShowModal(service.id, false)}
                          disabled={loading.fetchSingleEdit}
                        >
                          {loading.fetchSingleEdit ? <Spinner sm /> : <FiEdit />}
                        </button>
                        <button
                          className="services-icon-action danger"
                          aria-label="Delete service"
                          onClick={() => handleDelete(service.id)}
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
          <div className="services-pagination">
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

      <div className="modal fade services-modal-shell" id="serviceModal" tabIndex="-1" aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content services-modal">
            <div className="services-modal__header">
              <div>
                <span>Service Catalog</span>
                <h2>{editingService ? (isReadOnly ? 'View Service' : 'Edit Service') : 'Add Service'}</h2>
              </div>
              <button type="button" className="services-modal__close" data-bs-dismiss="modal" aria-label="Close">&times;</button>
            </div>

            <div className="services-modal__body">
              {apiError && <div className="services-error">{apiError}</div>}
              {loading.fetchSingle && editingService ? (
                <div className="services-modal-loading"><Spinner sm /> Loading service data...</div>
              ) : (
                <div className="services-form-grid">
                  <label>
                    <span>Service Name</span>
                    <input name="service_name" value={formData.service_name} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                  <label>
                    <span>Rate (Per Unit)</span>
                    <input name="rate" value={formData.rate} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                  <label>
                    <span>Unit of Measure</span>
                    <select name="unit_of_measure" value={formData.unit_of_measure} onChange={handleInputChange} disabled={isReadOnly}>
                      <option value="">Select Unit</option>
                      <option value="Hour">Hour</option>
                      <option value="Kg">Kg</option>
                      <option value="Unit">Unit</option>
                      <option value="Liter">Liter</option>
                    </select>
                  </label>
                  <label>
                    <span>Sales Tax (%)</span>
                    <input name="sales_tax" value={formData.sales_tax} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                  <label className="services-form-grid__wide">
                    <span>Description</span>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                </div>
              )}
            </div>

            <div className="services-modal__footer">
              <button type="button" className="services-secondary-action" data-bs-dismiss="modal">Cancel</button>
              {!isReadOnly && (
                <button
                  type="button"
                  className="services-primary-action"
                  onClick={editingService ? handleUpdate : handleSave}
                  disabled={loading.add || loading.edit}
                >
                  {loading.add || loading.edit ? <Spinner sm /> : (editingService ? 'Update' : 'Save')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Services;
