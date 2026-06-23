import React, { useCallback, useEffect, useRef, useState } from 'react';
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
const provinceOptions = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'ICT'];

const memberName = (m) => m.member_name || m.memberName || '';
const memberDesignation = (m) => m.designation || '';
const memberCnic = (m) => m.cnic_ntn || m.cnicNtn || '';
const memberPhone = (m) => m.phone_number || m.phoneNumber || '';
const memberEmail = (m) => m.email || '';
const memberProvince = (m) => m.province || '';
const memberAddress = (m) => m.address || '';

const avatarTones = ['av-p', 'av-b', 'av-g', 'av-o', 'av-s'];

function initialsOf(name) {
  const words = String(name || '').trim().split(/[\s—-]+/);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || 'ST';
}

function toneFor(id, name) {
  const key = String(id || '') + String(name || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffff;
  return avatarTones[h % avatarTones.length];
}

function badgeFor(designation) {
  switch ((designation || '').trim().toLowerCase()) {
    case 'manager':    return 'b-info';
    case 'accountant': return 'b-ok';
    case 'hr':         return 'b-warn';
    case 'coo':        return 'b-purple';
    default:           return 'b-neutral';
  }
}

function downloadStaffCsv(rows) {
  if (!rows.length) return;
  const cols = ['Name', 'Designation', 'CNIC/NTN', 'Phone', 'Email', 'Province', 'Address'];
  const lines = [cols.join(',')];
  rows.forEach(m => {
    lines.push([
      `"${memberName(m)}"`, `"${memberDesignation(m)}"`, `"${memberCnic(m)}"`,
      `"${memberPhone(m)}"`, `"${memberEmail(m)}"`, `"${memberProvince(m)}"`, `"${memberAddress(m)}"`,
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'staff.csv'; a.click();
  URL.revokeObjectURL(url);
}

function Staff() {
  useBlockBackButton();

  const [staff, setStaff] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState(emptyStaffForm);
  const [apiError, setApiError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [loading, setLoading] = useState({
    add: false, edit: false, delete: false, fetch: false,
    fetchSingle: false, fetchSingleEdit: false,
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

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const handleHidden = () => {
      document.body.classList.remove('modal-open');
      Array.from(document.getElementsByClassName('modal-backdrop')).forEach(b => b.remove());
    };
    el.addEventListener('hidden.bs.modal', handleHidden);
    return () => el.removeEventListener('hidden.bs.modal', handleHidden);
  }, []);

  const hideModal = () => {
    try {
      const inst = window.bootstrap?.Modal?.getInstance(modalRef.current);
      if (inst) { inst.hide(); return; }
    } catch {}
    if (modalRef.current) { modalRef.current.classList.remove('show'); modalRef.current.style.display = 'none'; }
    document.body.classList.remove('modal-open');
    Array.from(document.getElementsByClassName('modal-backdrop')).forEach(b => b.remove());
  };

  const handleShowModal = async (staffId = null) => {
    setApiError('');
    if (staffId !== null) {
      try {
        setLoading(prev => ({ ...prev, fetchSingle: true, fetchSingleEdit: true }));
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
        setLoading(prev => ({ ...prev, fetchSingle: false, fetchSingleEdit: false }));
      }
    } else {
      setFormData(emptyStaffForm);
      setEditingStaff(null);
    }
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
      const created = await createStaffMember(formData);
      hideModal();
      setFormData(emptyStaffForm);
      setEditingStaff(null);
      setCurrentPage(1);
      const refreshed = await fetchStaff();
      setStaff([created, ...refreshed.filter(m => m.id !== created.id)]);
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
    if (!window.confirm('Delete this staff member?')) return;
    setLoading(prev => ({ ...prev, delete: true }));
    try {
      await deleteStaffMember(staffId);
      setApiError('');
      setViewingStaff(null);
      setSelectedIds(prev => prev.filter(id => id !== staffId));
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      setApiError(error.response?.data?.error || 'Error deleting staff member.');
    } finally {
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} staff member${selectedIds.length > 1 ? 's' : ''}?`)) return;
    for (const id of selectedIds) {
      try { await deleteStaffMember(id); } catch {}
    }
    setSelectedIds([]);
    fetchStaff();
  };

  /* ─── derived ─────────────────────────────────────────────── */
  const filteredStaff = (staff || []).filter(m => {
    if (!m) return false;
    const term = searchTerm.toLowerCase();
    const matchSearch = [memberName(m), memberDesignation(m), memberCnic(m), memberPhone(m), memberEmail(m), memberProvince(m)]
      .some(v => v.toLowerCase().includes(term));
    const matchRole = roleFilter === 'All Roles' || memberDesignation(m) === roleFilter;
    return matchSearch && matchRole;
  });

  const sortedStaff = [...filteredStaff].sort((a, b) => {
    switch (sortBy) {
      case 'Newest': return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
      case 'Oldest': return new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0);
      case 'A-Z':    return memberName(a).localeCompare(memberName(b));
      case 'Z-A':    return memberName(b).localeCompare(memberName(a));
      case 'Role':   return memberDesignation(a).localeCompare(memberDesignation(b));
      default:       return 0;
    }
  });

  const totalPages = Math.ceil(sortedStaff.length / itemsPerPage);
  const paginatedStaff = sortedStaff.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageIds = paginatedStaff.map(m => m.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));

  const managerCount = staff.filter(m => memberDesignation(m) === 'Manager').length;
  const activeCount = staff.filter(m => memberEmail(m) || memberPhone(m)).length;
  const provinceCount = new Set(staff.map(m => memberProvince(m)).filter(Boolean)).size;

  const roleChips = ['All Roles', ...designationOptions];

  const toggleSelectAll = () => {
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    else setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
  };
  const toggleSelectOne = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const formatJoined = (m) => {
    const d = m.created_at || m.createdAt;
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const Spinner = () => (
    <span className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading…</span>
    </span>
  );

  return (
    <div className="stf-page">

      {/* Page header */}
      <div className="stf-page-hdr">
        <div className="stf-page-hdr__left">
          <h1>Staff Members</h1>
          <p>Manage employees who can be assigned to companies and invoicing workflows</p>
        </div>
        <div className="stf-page-hdr__right">
          <button className="stf-btn-outline" onClick={() => downloadStaffCsv(sortedStaff)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button className="stf-btn-primary" onClick={() => handleShowModal()} disabled={loading.add}>
            {loading.add ? <Spinner /> : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Staff
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="stf-mini-stats">
        <div className="stf-mini-card c-p">
          <div className="stf-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <div className="stf-mini-num">{staff.length}</div>
            <div className="stf-mini-lbl">Total Staff</div>
          </div>
        </div>
        <div className="stf-mini-card c-b">
          <div className="stf-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            </svg>
          </div>
          <div>
            <div className="stf-mini-num">{managerCount}</div>
            <div className="stf-mini-lbl">Managers</div>
          </div>
        </div>
        <div className="stf-mini-card c-g">
          <div className="stf-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <div className="stf-mini-num">{activeCount}</div>
            <div className="stf-mini-lbl">Active</div>
          </div>
        </div>
        <div className="stf-mini-card c-o">
          <div className="stf-mini-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"/>
              <path d="M9 22V12h6v10"/>
              <path d="M2 10.6L12 2l10 8.6"/>
            </svg>
          </div>
          <div>
            <div className="stf-mini-num">{provinceCount}</div>
            <div className="stf-mini-lbl">Provinces</div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="stf-tbl-card">
        <div className="stf-filter-bar">
          <div className="stf-chip-row">
            {roleChips.map(role => (
              <span
                key={role}
                className={`stf-chip${roleFilter === role ? ' on' : ''}`}
                onClick={() => { setRoleFilter(role); setCurrentPage(1); }}
              >{role}</span>
            ))}
          </div>
          <div className="stf-filter-sep" />
          <label className="stf-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="search"
              placeholder="Search name or CNIC…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </label>
          <select
            className="stf-sort-select"
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Sort: Name A→Z</option>
            <option value="Newest">Newest first</option>
            <option value="Oldest">Oldest first</option>
            <option value="A-Z">Name A→Z</option>
            <option value="Z-A">Name Z→A</option>
            <option value="Role">Sort: Designation</option>
          </select>
          <span className="stf-results-count">Showing {paginatedStaff.length} of {sortedStaff.length}</span>
        </div>

        {apiError && <div className="stf-api-error">{apiError}</div>}

        <div className="stf-tbl-wrap">
          <table className="stf-table">
            <thead>
              <tr>
                <th className="stf-th-check">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} style={{ accentColor: '#F05C44' }} />
                </th>
                <th>
                  <div className="stf-th-inner">
                    Name
                    <span className="stf-sort-ico">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <polyline points="6 10 12 4 18 10"/>
                      </svg>
                    </span>
                  </div>
                </th>
                <th>Designation</th>
                <th>CNIC / NTN</th>
                <th>Contact</th>
                <th>Province</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading.fetch ? (
                <tr><td colSpan="7" className="stf-empty-cell"><Spinner /> Loading staff…</td></tr>
              ) : paginatedStaff.length === 0 ? (
                <tr><td colSpan="7" className="stf-empty-cell">No staff members found</td></tr>
              ) : (
                paginatedStaff.map(member => {
                  const init = initialsOf(memberName(member));
                  const tone = toneFor(member.id, memberName(member));
                  const isSelected = selectedIds.includes(member.id);
                  return (
                    <tr key={member.id} className={isSelected ? 'stf-row-sel' : ''}>
                      <td className="stf-td-check">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectOne(member.id)} style={{ accentColor: '#F05C44' }} />
                      </td>
                      <td>
                        <div className="stf-name-cell">
                          <div className={`stf-row-avatar ${tone}`}>{init}</div>
                          <div className="stf-row-name">{memberName(member) || '—'}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`stf-badge ${badgeFor(memberDesignation(member))}`}>
                          {memberDesignation(member) || 'Unassigned'}
                        </span>
                      </td>
                      <td><span className="stf-mono">{memberCnic(member) || '—'}</span></td>
                      <td>
                        <div className="stf-contact-phone">{memberPhone(member) || '—'}</div>
                        <div className="stf-contact-email">{memberEmail(member)}</div>
                      </td>
                      <td>{memberProvince(member) || '—'}</td>
                      <td>
                        <div className="stf-acts">
                          <button className="stf-act-btn" title="View" onClick={() => setViewingStaff(member)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                          <button className="stf-act-btn" title="Edit" onClick={() => handleShowModal(member.id)} disabled={loading.fetchSingleEdit}>
                            {loading.fetchSingleEdit ? <Spinner /> : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            )}
                          </button>
                          <button className="stf-act-btn danger" title="Delete" onClick={() => handleDelete(member.id)} disabled={loading.delete}>
                            {loading.delete ? <Spinner /> : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14H6L5 6"/>
                              </svg>
                            )}
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
        <div className="stf-pager">
          <span className="stf-pager-info">
            {sortedStaff.length > 0
              ? `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, sortedStaff.length)} of ${sortedStaff.length} staff`
              : '0 staff'}
          </span>
          {totalPages > 1 && (
            <div className="stf-pager-btns">
              <button className="stf-pg-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
              {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                <button key={i + 1} className={`stf-pg-btn${currentPage === i + 1 ? ' on' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              ))}
              {totalPages > 5 && (
                <>
                  <span style={{ padding: '0 3px', color: '#9CA3AF', fontSize: 12 }}>…</span>
                  <button className={`stf-pg-btn${currentPage === totalPages ? ' on' : ''}`} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                </>
              )}
              <button className="stf-pg-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in detail panel */}
      <div className={`stf-overlay${viewingStaff ? ' open' : ''}`} onClick={() => setViewingStaff(null)} aria-hidden={!viewingStaff} />
      <div className={`stf-panel${viewingStaff ? ' open' : ''}`} aria-hidden={!viewingStaff}>
        <div className="stf-dp-hdr">
          <div>
            <div className="stf-dp-title">Staff Profile</div>
            <div className="stf-dp-sub">Employee details &amp; access</div>
          </div>
          <button className="stf-dp-close" onClick={() => setViewingStaff(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {viewingStaff && (
          <div className="stf-dp-body">
            <div className="stf-dp-avatar-wrap">
              <div className={`stf-dp-avatar ${toneFor(viewingStaff.id, memberName(viewingStaff))}`}>
                {initialsOf(memberName(viewingStaff))}
              </div>
              <div className="stf-dp-av-name">{memberName(viewingStaff)}</div>
              <div className="stf-dp-av-type">
                <span className={`stf-badge ${badgeFor(memberDesignation(viewingStaff))}`} style={{ fontSize: 11 }}>
                  {memberDesignation(viewingStaff) || 'Unassigned'}
                </span>
              </div>
            </div>
            <div className="stf-dp-section">
              <div className="stf-dp-section-title">Identification</div>
              <div className="stf-dp-row">
                <span className="stf-dp-row-key">CNIC / NTN</span>
                <span className="stf-dp-row-val stf-mono">{memberCnic(viewingStaff) || '—'}</span>
              </div>
              <div className="stf-dp-row">
                <span className="stf-dp-row-key">Province</span>
                <span className="stf-dp-row-val">{memberProvince(viewingStaff) || '—'}</span>
              </div>
              <div className="stf-dp-row">
                <span className="stf-dp-row-key">Address</span>
                <span className="stf-dp-row-val" style={{ maxWidth: 200, textAlign: 'right' }}>{memberAddress(viewingStaff) || '—'}</span>
              </div>
            </div>
            <div className="stf-dp-section">
              <div className="stf-dp-section-title">Contact</div>
              <div className="stf-dp-row">
                <span className="stf-dp-row-key">Phone</span>
                <span className="stf-dp-row-val">{memberPhone(viewingStaff) || '—'}</span>
              </div>
              <div className="stf-dp-row">
                <span className="stf-dp-row-key">Email</span>
                <span className="stf-dp-row-val" style={{ color: '#f05c44' }}>{memberEmail(viewingStaff) || '—'}</span>
              </div>
            </div>
            <div className="stf-dp-section">
              <div className="stf-dp-section-title">Access</div>
              <div className="stf-dp-row">
                <span className="stf-dp-row-key">Role</span>
                <span className="stf-dp-row-val">{memberDesignation(viewingStaff) || '—'}</span>
              </div>
              <div className="stf-dp-row">
                <span className="stf-dp-row-key">Joined</span>
                <span className="stf-dp-row-val">{formatJoined(viewingStaff)}</span>
              </div>
            </div>
          </div>
        )}
        <div className="stf-dp-footer">
          <button
            className="stf-dp-btn-edit"
            onClick={() => { const v = viewingStaff; setViewingStaff(null); handleShowModal(v?.id); }}
          >Edit Staff</button>
          <button className="stf-dp-btn-del" onClick={() => viewingStaff && handleDelete(viewingStaff.id)}>Delete</button>
        </div>
      </div>

      {/* Bulk bar */}
      <div className={`stf-bulk-bar${selectedIds.length > 0 ? ' show' : ''}`}>
        <span className="stf-bulk-count">{selectedIds.length} selected</span>
        <div className="stf-bulk-sep" />
        <button className="stf-bulk-btn primary" onClick={() => downloadStaffCsv(staff.filter(m => selectedIds.includes(m.id)))}>Export Selected</button>
        <button className="stf-bulk-btn danger" onClick={handleBulkDelete}>Delete</button>
        <button className="stf-bulk-close" onClick={() => setSelectedIds([])}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Add / Edit Modal */}
      <div className="modal fade stf-modal-shell" id="staffModal" tabIndex="-1" aria-hidden="true" ref={modalRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content stf-modal">
            <div className="stf-modal__header">
              <div>
                <span>Staff Record</span>
                <h2>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              </div>
              <button type="button" className="stf-modal__close" data-bs-dismiss="modal" aria-label="Close">&times;</button>
            </div>
            <div className="stf-modal__body">
              {apiError && <div className="stf-api-error">{apiError}</div>}
              {loading.fetchSingle ? (
                <div className="stf-modal-loading"><Spinner /> Loading…</div>
              ) : (
                <div className="stf-form-grid">
                  <label>
                    <span>Member Name</span>
                    <input name="member_name" value={formData.member_name} onChange={handleInputChange} placeholder="Full name" />
                  </label>
                  <label>
                    <span>Designation</span>
                    <select name="designation" value={formData.designation} onChange={handleInputChange}>
                      <option value="">Select Designation</option>
                      {designationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>CNIC / NTN</span>
                    <input name="cnic_ntn" value={formData.cnic_ntn} onChange={handleInputChange} placeholder="3520112345671" />
                  </label>
                  <label>
                    <span>Phone Number</span>
                    <input name="phone_number" value={formData.phone_number} onChange={handleInputChange} placeholder="+92 300 0000000" />
                  </label>
                  <label>
                    <span>Email</span>
                    <input name="email" value={formData.email} onChange={handleInputChange} placeholder="name@company.com" />
                  </label>
                  <label>
                    <span>Province</span>
                    <select name="province" value={formData.province} onChange={handleInputChange}>
                      <option value="">Select Province</option>
                      {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="stf-form-grid__wide">
                    <span>Address</span>
                    <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Street, City" />
                  </label>
                </div>
              )}
            </div>
            <div className="stf-modal__footer">
              <button type="button" className="stf-btn-outline" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="stf-btn-primary"
                onClick={editingStaff ? handleUpdate : handleSave}
                disabled={loading.add || loading.edit || loading.fetchSingle}
              >
                {loading.add || loading.edit ? <Spinner /> : (editingStaff ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Staff;
