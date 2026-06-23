import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import defaultLogo from '../Images/TechionikIcon.png';
import { FiEdit, FiMail, FiRefreshCw, FiSave, FiUpload, FiX } from 'react-icons/fi';
import useBlockBackButton from '../Components/useBlockBackButton';
import { getCompanyProfile, updateCompanyProfile } from '../services/companyProfileApi';
import './Company.css';

const EMPTY_FORM = {
  company_name: '',
  ntn_or_cnic: '',
  business_type: '',
  province: '',
  address: '',
  phone_number: '',
  email_address: '',
};

const businessTypes = ['Retail', 'Wholesale', 'Manufacturing', 'Service'];
const provinces = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit Baltistan'];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Company() {
  useBlockBackButton();
  const [isEditable, setIsEditable] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [savedLogoBase64, setSavedLogoBase64] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCompanyProfile();
      const profile = data || {};
      setFormData({
        company_name: profile.company_name || '',
        ntn_or_cnic: profile.ntn_or_cnic || '',
        business_type: profile.business_type || '',
        province: profile.province || '',
        address: profile.address || '',
        phone_number: profile.phone_number || '',
        email_address: profile.email_address || '',
      });
      if (profile.logo_base64) {
        setSavedLogoBase64(profile.logo_base64);
        setLogoPreview(profile.logo_base64);
      } else {
        setSavedLogoBase64(null);
        setLogoPreview('');
      }
      setLogoFile(null);
    } catch {
      showNotification('Failed to load company profile', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCancelEdit = () => {
    setIsEditable(false);
    setLogoFile(null);
    loadProfile();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let logo_base64 = savedLogoBase64;
      if (logoFile) {
        logo_base64 = await fileToBase64(logoFile);
      }
      const updated = await updateCompanyProfile({ ...formData, logo_base64 });
      setSavedLogoBase64(updated.logo_base64);
      if (updated.logo_base64) setLogoPreview(updated.logo_base64);
      setLogoFile(null);
      setIsEditable(false);
      showNotification('Profile updated successfully');
    } catch (err) {
      showNotification(`Update failed: ${err.response?.data?.error || err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEmailSave = async () => {
    if (!pendingEmail.trim() || pendingEmail === formData.email_address) {
      setShowEmailModal(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCompanyProfile({ ...formData, email_address: pendingEmail });
      setFormData(prev => ({ ...prev, email_address: updated.email_address }));
      setShowEmailModal(false);
      showNotification('Email updated successfully');
    } catch (err) {
      showNotification(`Email update failed: ${err.response?.data?.error || err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const Spinner = ({ sm } = {}) => (
    <span className={`spinner-border${sm ? ' spinner-border-sm' : ' spinner-border-sm'}`} role="status">
      <span className="visually-hidden">Loading...</span>
    </span>
  );

  const filledFields = Object.values(formData).filter((value) => String(value || '').trim()).length;
  const totalFields = Object.keys(EMPTY_FORM).length;
  const completionPercent = Math.round((filledFields / totalFields) * 100);

  return (
    <div className="company-page">
      <div className="company-header">
        <div>
          <span>Seller profile</span>
          <h1>Company Profile</h1>
          <p>Maintain the seller details that prefill Add Invoice and appear on generated invoices.</p>
        </div>

        <div className="company-header__actions">
          <button className="company-secondary-action" onClick={loadProfile} disabled={loading || saving}>
            <FiRefreshCw size={16} /> Refresh
          </button>
          {isEditable ? (
            <>
              <button className="company-secondary-action" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="company-primary-action" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner sm /> : <><FiSave size={16} /> Save Profile</>}
              </button>
            </>
          ) : (
            <button className="company-primary-action" onClick={() => setIsEditable(true)} disabled={loading}>
              <FiEdit size={16} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {notification.show && (
        <div className={`company-notification ${notification.type === 'error' ? 'danger' : 'success'}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(prev => ({ ...prev, show: false }))} aria-label="Dismiss notification">
            <FiX size={18} />
          </button>
        </div>
      )}

      <section className="company-profile-banner">
        <div className="company-logo-wrap">
          <div className="company-logo-frame">
            <img src={logoPreview || defaultLogo} alt="Company logo" onError={(e) => { e.target.src = defaultLogo; }} />
          </div>
          {isEditable && (
            <label className="company-logo-edit" aria-label="Upload company logo">
              <FiUpload size={14} />
              <input type="file" accept="image/*" onChange={handleLogoChange} />
            </label>
          )}
        </div>
        <div className="company-name-tag">
          <h2>{formData.company_name || 'Company Name'}</h2>
          <p>NTN/CNIC: {formData.ntn_or_cnic || 'Not set'} · {formData.province || 'Province not set'}</p>
          {logoFile && <small>Selected logo: {logoFile.name}</small>}
        </div>
      </section>

      {loading ? (
        <div className="company-loading"><Spinner sm /> Loading company profile...</div>
      ) : (
        <div className="company-form-layout">
          <div className="company-form-stack">
            <section className="company-sec">
              <div className="company-sec-hdr">
                <div className="company-sec-ico"><FiEdit /></div>
                <div>
                  <div className="company-sec-title">Business Information</div>
                  <div className="company-sec-sub">Legal name, registration, and classification</div>
                </div>
              </div>
              <div className="company-sec-body">
                <div className="company-form-row cols-2">
                  <label className="company-field">
                    <span>Company Name <em>*</em></span>
                    <input name="company_name" value={formData.company_name} onChange={handleInputChange} disabled={!isEditable} />
                  </label>
                  <label className="company-field">
                    <span>NTN / CNIC <em>*</em></span>
                    <input className="mono" name="ntn_or_cnic" value={formData.ntn_or_cnic} onChange={handleInputChange} disabled={!isEditable} />
                  </label>
                </div>
                <div className="company-form-row cols-2">
                  <label className="company-field">
                    <span>Business Type</span>
                    <select name="business_type" value={formData.business_type} onChange={handleInputChange} disabled={!isEditable}>
                      <option value="">Select Business Type</option>
                      {businessTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <label className="company-field">
                    <span>Province <em>*</em></span>
                    <select name="province" value={formData.province} onChange={handleInputChange} disabled={!isEditable}>
                      <option value="">Select Province</option>
                      {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
                    </select>
                  </label>
                </div>
                <div className="company-form-row">
                  <label className="company-field">
                    <span>Registered Address <em>*</em></span>
                    <textarea name="address" value={formData.address} onChange={handleInputChange} disabled={!isEditable} />
                  </label>
                </div>
              </div>
            </section>

            <section className="company-sec">
              <div className="company-sec-hdr">
                <div className="company-sec-ico"><FiMail /></div>
                <div>
                  <div className="company-sec-title">Contact Information</div>
                  <div className="company-sec-sub">Primary contact details for FBR correspondence</div>
                </div>
              </div>
              <div className="company-sec-body">
                <div className="company-form-row cols-2">
                  <label className="company-field">
                    <span>Phone Number</span>
                    <input name="phone_number" value={formData.phone_number} onChange={handleInputChange} disabled={!isEditable} />
                  </label>
                  <label className="company-field">
                    <span>Email Address</span>
                    <div className="company-input-action">
                      <input name="email_address" value={formData.email_address} disabled />
                      <button
                        type="button"
                        onClick={() => { setPendingEmail(formData.email_address); setShowEmailModal(true); }}
                        disabled={!isEditable || loading}
                      >
                        Edit
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            </section>

            <section className="company-sec">
              <div className="company-sec-hdr">
                <div className="company-sec-ico"><FiSave /></div>
                <div>
                  <div className="company-sec-title">Tax Registration</div>
                  <div className="company-sec-sub">Sales tax and FBR registration readiness</div>
                </div>
              </div>
              <div className="company-sec-body">
                <div className="company-form-row cols-2">
                  <label className="company-field">
                    <span>Sales Tax Registration No.</span>
                    <input className="mono" value={formData.ntn_or_cnic || ''} disabled />
                  </label>
                  <div className="company-field">
                    <span>STRN Status</span>
                    <div className="company-status-line"><span className="company-badge success">Active & Verified</span></div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="company-summary-col">
            <section className="company-fbr-card">
              <div className="company-card-title"><FiSave /> Profile Completeness</div>
              <div className="company-progress">
                <span style={{ width: `${completionPercent}%` }} />
              </div>
              <div className="company-fbr-row"><span>Completed</span><strong>{filledFields} of {totalFields} fields</strong></div>
              <div className="company-fbr-row"><span>Status</span><strong>{isEditable ? 'Editing' : 'Saved'}</strong></div>
            </section>

            <section className="company-quick-links">
              <div className="company-quick-title">Related</div>
              <Link to="/settings" className="company-quick-link">FBR Token Settings</Link>
              <Link to="/onboarding" className="company-quick-link">Onboarding Status</Link>
              <Link to="/staff" className="company-quick-link">Manage Team Access</Link>
            </section>

            <button className="company-submit-action" type="button" onClick={handleSave} disabled={!isEditable || saving}>
              {saving ? <Spinner sm /> : <><FiSave /> Save Changes</>}
            </button>
          </aside>
        </div>
      )}

      <div className="company-mobile-actions">
        {isEditable ? (
          <>
            <button className="company-secondary-action" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
            <button className="company-primary-action" onClick={handleSave} disabled={saving}>{saving ? <Spinner sm /> : 'Save Profile'}</button>
          </>
        ) : (
          <button className="company-primary-action" onClick={() => setIsEditable(true)} disabled={loading}>Edit Profile</button>
        )}
      </div>

      {showEmailModal && (
        <>
          <div className="company-email-modal" role="dialog" aria-modal="true">
            <div className="company-email-modal__content">
              <div className="company-email-modal__header">
                <div>
                  <span>Company Email</span>
                  <h2>Edit Email Address</h2>
                </div>
                <button onClick={() => setShowEmailModal(false)} aria-label="Close email modal">&times;</button>
              </div>
              <div className="company-email-modal__body">
                <label>
                  <span>Email Address</span>
                  <input
                    type="email"
                    placeholder="Enter new email"
                    value={pendingEmail}
                    onChange={(e) => setPendingEmail(e.target.value)}
                  />
                </label>
              </div>
              <div className="company-email-modal__footer">
                <button className="company-secondary-action" onClick={() => setShowEmailModal(false)} disabled={saving}>Cancel</button>
                <button
                  className="company-primary-action"
                  onClick={handleEmailSave}
                  disabled={saving || !pendingEmail.trim() || pendingEmail === formData.email_address}
                >
                  {saving ? <Spinner sm /> : 'Save Email'}
                </button>
              </div>
            </div>
          </div>
          <div className="company-email-backdrop" />
        </>
      )}
    </div>
  );
}

export default Company;
