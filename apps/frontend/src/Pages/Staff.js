import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiEdit, FiRefreshCw, FiSearch, FiTrash2, FiUserPlus } from 'react-icons/fi';
import { LuEye } from 'react-icons/lu';
import useBlockBackButton from '../Components/useBlockBackButton';
import { getStaffMembers, getStaffMember, createStaffMember, updateStaffMember, deleteStaffMember } from '../services/staffApi';
import './Staff.css';

const emptyStaffForm = {
  member_name: '',
  designation: '',
  cnic_ntn: '',
  phone_number: '',
  email: '',
  province: '',
  address: '',
};

const designationOptions = ['Manager', 'HR', 'COO', 'Accountant'];
const provinceOptions = ['Punjab', 'Sindh', 'KPK', 'Balochistan'];

const memberName = (member) => member.member_name || member.memberName || '';
const memberDesignation = (member) => member.designation || '';
const memberCnic = (member) => member.cnic_ntn || member.cnicNtn || '';
const memberPhone = (member) => member.phone_number || member.phoneNumber || '';
const memberEmail = (member) => member.email || '';
const memberProvince = (member) => member.province || '';
const memberAddress = (member) => member.address || '';

function Staff() {
  useBlockBackButton();

  const [staff, setStaff] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [formData, setFormData] = useState(emptyStaffForm);
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

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, fetch: true }));
      const data = await getStaffMembers({ limit: 250 });
      setStaff(data);
      setApiError('');
      return data;
    } catch (error) {
      console.error('Failed to fetch staff:', error);
      setApiError(error.response?.data?.error || 'Failed to load staff members.');
      return [];
    } finally {
      setLoading(prev => ({ ...prev, fetch: false }));
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

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
    } catch {}

    if (modalRef.current) {
      modalRef.current.classList.remove('show');
      modalRef.current.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    Array.from(document.getElementsByClassName('modal-backdrop')).forEach(backdrop => backdrop.remove());
  };

  const handleShowModal = async (staffId = null, viewOnly = false) => {
    setApiError('');

    if (staffId !== null) {
      try {
        setLoading(prev => ({
          ...prev,
          fetchSingle: true,
          fetchSingleView: viewOnly,
          fetchSingleEdit: !viewOnly,
        }));
        const member = await getStaffMember(staffId);
        setEditingStaff(member);
        setFormData({
          member_name: memberName(member),
          designation: memberDesignation(member),
          cnic_ntn: memberCnic(member),
          phone_number: memberPhone(member),
          email: memberEmail(member),
          province: memberProvince(member),
          address: memberAddress(member),
        });
      } catch (error) {
        console.error('Error fetching staff member:', error);
        setApiError(error.response?.data?.error || 'Error fetching staff member.');
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
      setFormData(emptyStaffForm);
      setEditingStaff(null);
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
      const createdStaff = await createStaffMember(formData);
      hideModal();
      setFormData(emptyStaffForm);
      setEditingStaff(null);
      setCurrentPage(1);
      const refreshedStaff = await fetchStaff();
      setStaff([
        createdStaff,
        ...refreshedStaff.filter(member => member.id !== createdStaff.id),
      ]);
    } catch (error) {
      console.error('Error saving staff member:', error);
      setApiError(error.response?.data?.error || error.message || 'Error saving staff member.');
    } finally {
      setLoading(prev => ({ ...prev, add: false }));
    }
  };

  const handleUpdate = async () => {
    if (!editingStaff?.id) return;

    setApiError('');
    setLoading(prev => ({ ...prev, edit: true }));

    try {
      await updateStaffMember(editingStaff.id, formData);
      hideModal();
      fetchStaff();
    } catch (error) {
      console.error('Error updating staff member:', error);
      setApiError(error.response?.data?.error || error.message || 'Error updating staff member.');
    } finally {
      setLoading(prev => ({ ...prev, edit: false }));
    }
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;

    setLoading(prev => ({ ...prev, delete: true }));
    try {
      await deleteStaffMember(staffId);
      setApiError('');
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      setApiError(error.response?.data?.error || 'Error deleting staff member.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const filteredStaff = (staff || []).filter(member => {
    if (!member) return false;
    const term = searchTerm.toLowerCase();
    return [
      memberName(member),
      memberDesignation(member),
      memberCnic(member),
      memberPhone(member),
      memberEmail(member),
      memberProvince(member),
      memberAddress(member),
    ].some(value => value.toLowerCase().includes(term));
  });

  const sortedStaff = [...filteredStaff].sort((a, b) => {
    switch (sortBy) {
      case 'Newest':
        return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      case 'Oldest':
        return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      case 'A-Z':
        return memberName(a).localeCompare(memberName(b));
      case 'Z-A':
        return memberName(b).localeCompare(memberName(a));
      case 'Role-A-Z':
        return memberDesignation(a).localeCompare(memberDesignation(b));
      case 'Role-Z-A':
        return memberDesignation(b).localeCompare(memberDesignation(a));
      default:
        return 0;
    }
  });

  const designationCount = new Set(staff.map(member => memberDesignation(member)).filter(Boolean)).size;
  const provinceCount = new Set(staff.map(member => memberProvince(member)).filter(Boolean)).size;
  const contactableCount = staff.filter(member => memberEmail(member) || memberPhone(member)).length;
  const totalPages = Math.ceil(sortedStaff.length / itemsPerPage);
  const paginatedStaff = sortedStaff.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const Spinner = ({ sm } = {}) => (
    <span className={`spinner-border${sm ? ' spinner-border-sm' : ' spinner-border-sm'}`} role="status">
      <span className="visually-hidden">Loading...</span>
    </span>
  );

  return (
    <div className="staff-page">
      <div className="staff-header">
        <div>
          <span>Team directory</span>
          <h1>Staff</h1>
          <p>Manage team members, roles, contact details, and regional assignment records.</p>
        </div>

        <div className="staff-header__actions">
          <button className="staff-secondary-action" onClick={fetchStaff} disabled={loading.fetch}>
            <FiRefreshCw size={16} /> Refresh
          </button>
          <button
            className="staff-primary-action"
            onClick={() => handleShowModal()}
            disabled={loading.add}
          >
            {loading.add ? <Spinner sm /> : <><FiUserPlus size={17} /> Add Staff</>}
          </button>
        </div>
      </div>

      <div className="staff-stat-grid">
        <div>
          <span>Total staff</span>
          <strong>{staff.length}</strong>
        </div>
        <div>
          <span>Contactable</span>
          <strong className="success">{contactableCount}</strong>
        </div>
        <div>
          <span>Roles</span>
          <strong>{designationCount}</strong>
        </div>
        <div>
          <span>Provinces</span>
          <strong>{provinceCount}</strong>
        </div>
      </div>

      <section className="staff-panel">
        <div className="staff-panel__top">
          <div>
            <h2>All Staff</h2>
            <p>{sortedStaff.length} staff member{sortedStaff.length !== 1 ? 's' : ''} match the current view.</p>
          </div>
          <div className="staff-toolbar">
            <label className="staff-search">
              <FiSearch size={16} />
              <input
                type="search"
                placeholder="Search name, role, CNIC, phone, email..."
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
              <option value="Role-A-Z">Role (A-Z)</option>
              <option value="Role-Z-A">Role (Z-A)</option>
            </select>
          </div>
        </div>

        {apiError && <div className="staff-error">{apiError}</div>}

        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Designation</th>
                <th>CNIC/NTN</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Province</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading.fetch ? (
                <tr>
                  <td colSpan="8" className="staff-empty-cell"><Spinner sm /> Loading staff members...</td>
                </tr>
              ) : paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan="8" className="staff-empty-cell">No staff members found</td>
                </tr>
              ) : (
                paginatedStaff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{memberName(member) || '-'}</strong>
                      <span>{memberEmail(member) || 'No email set'}</span>
                    </td>
                    <td>
                      <span className={`staff-status ${memberDesignation(member) ? 'success' : 'neutral'}`}>
                        {memberDesignation(member) || 'Unassigned'}
                      </span>
                    </td>
                    <td className="staff-ref">{memberCnic(member) || '-'}</td>
                    <td>{memberPhone(member) || '-'}</td>
                    <td>{memberEmail(member) || '-'}</td>
                    <td>{memberProvince(member) || '-'}</td>
                    <td className="staff-address">{memberAddress(member) || '-'}</td>
                    <td>
                      <div className="staff-row-actions">
                        <button
                          className="staff-icon-action success"
                          aria-label="View staff member"
                          onClick={() => handleShowModal(member.id, true)}
                          disabled={loading.fetchSingleView}
                        >
                          {loading.fetchSingleView ? <Spinner sm /> : <LuEye />}
                        </button>
                        <button
                          className="staff-icon-action primary"
                          aria-label="Edit staff member"
                          onClick={() => handleShowModal(member.id, false)}
                          disabled={loading.fetchSingleEdit}
                        >
                          {loading.fetchSingleEdit ? <Spinner sm /> : <FiEdit />}
                        </button>
                        <button
                          className="staff-icon-action danger"
                          aria-label="Delete staff member"
                          onClick={() => handleDelete(member.id)}
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
          <div className="staff-pagination">
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

      <div className="modal fade staff-modal-shell" id="staffModal" tabIndex="-1" aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content staff-modal">
            <div className="staff-modal__header">
              <div>
                <span>Staff Record</span>
                <h2>{editingStaff ? (isReadOnly ? 'View Staff Member' : 'Edit Staff Member') : 'Add Staff Member'}</h2>
              </div>
              <button type="button" className="staff-modal__close" data-bs-dismiss="modal" aria-label="Close">&times;</button>
            </div>

            <div className="staff-modal__body">
              {apiError && <div className="staff-error">{apiError}</div>}
              {loading.fetchSingle && editingStaff ? (
                <div className="staff-modal-loading"><Spinner sm /> Loading staff data...</div>
              ) : (
                <div className="staff-form-grid">
                  <label>
                    <span>Member Name</span>
                    <input name="member_name" value={formData.member_name} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                  <label>
                    <span>Designation</span>
                    <select name="designation" value={formData.designation} onChange={handleInputChange} disabled={isReadOnly}>
                      <option value="">Select Designation</option>
                      {designationOptions.map((designation) => (
                        <option key={designation} value={designation}>{designation}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>CNIC/NTN</span>
                    <input name="cnic_ntn" value={formData.cnic_ntn} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                  <label>
                    <span>Phone Number</span>
                    <input name="phone_number" value={formData.phone_number} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                  <label>
                    <span>Email</span>
                    <input name="email" value={formData.email} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                  <label>
                    <span>Province</span>
                    <select name="province" value={formData.province} onChange={handleInputChange} disabled={isReadOnly}>
                      <option value="">Select Province</option>
                      {provinceOptions.map((province) => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                  </label>
                  <label className="staff-form-grid__wide">
                    <span>Address</span>
                    <input name="address" value={formData.address} onChange={handleInputChange} disabled={isReadOnly} />
                  </label>
                </div>
              )}
            </div>

            <div className="staff-modal__footer">
              <button type="button" className="staff-secondary-action" data-bs-dismiss="modal">Cancel</button>
              {!isReadOnly && (
                <button
                  type="button"
                  className="staff-primary-action"
                  onClick={editingStaff ? handleUpdate : handleSave}
                  disabled={loading.add || loading.edit || loading.fetchSingle}
                >
                  {loading.add || loading.edit ? <Spinner sm /> : (editingStaff ? 'Update' : 'Save')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Staff;
