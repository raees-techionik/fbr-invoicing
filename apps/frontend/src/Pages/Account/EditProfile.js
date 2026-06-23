import React, { useEffect, useMemo, useState } from 'react';
import { FiMail, FiPlus, FiSave, FiUser } from 'react-icons/fi';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';
import { useCompany } from '../../contexts/CompanyContext';

const emptyProfile = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  address: '',
  phone: '',
  username: '',
};

function splitName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function usernameFromEmail(email = '') {
  const local = String(email).split('@')[0] || 'user';
  return `@${local.replace(/[^a-z0-9._-]/gi, '').toLowerCase()}`;
}

function initialsFor(firstName, lastName, email) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  return initials || String(email || 'U').slice(0, 2).toUpperCase();
}

function EditProfile() {
  useBlockBackButton();
  const { user } = useCompany();
  const [isEditable, setIsEditable] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);

  const userProfile = useMemo(() => {
    const { firstName, lastName } = splitName(user?.fullName);
    return {
      firstName,
      lastName,
      gender: '',
      dateOfBirth: '',
      address: '',
      phone: user?.phone || '',
      username: usernameFromEmail(user?.email),
    };
  }, [user]);

  useEffect(() => {
    if (!isEditable) setProfile(userProfile);
  }, [isEditable, userProfile]);

  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || user?.fullName || 'Current user';
  const primaryEmail = user?.email || localStorage.getItem('email') || 'No email available';
  const avatarInitials = initialsFor(profile.firstName, profile.lastName, primaryEmail);
  const emailList = [{ email: primaryEmail, addedAgo: 'current account' }];

  const updateProfile = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsEditable(false);
  };

  return (
    <AccountPageShell
      title="Edit Profile"
      subtitle="Keep your user identity, contact details, and profile preferences up to date."
      actions={
        <button className="account-button-secondary" type="button" onClick={() => setIsEditable((value) => !value)}>
          {isEditable ? 'Cancel' : 'Edit Profile'}
        </button>
      }
    >
      <form className="account-card" onSubmit={handleSubmit}>
        <div className="account-card-header">
          <div className="account-profile-summary">
            <div className="account-avatar" aria-hidden="true">{avatarInitials}</div>
            <div>
              <strong>{displayName}</strong>
              <span>{primaryEmail}</span>
            </div>
          </div>
          <button className="account-button-primary" type="submit" disabled={!isEditable}>
            <FiSave size={16} />
            Save Changes
          </button>
        </div>

        <div className="account-card-body">
          <div className="account-form-grid">
            <div className="account-field">
              <label htmlFor="profile-first-name">First Name</label>
              <input
                id="profile-first-name"
                type="text"
                value={profile.firstName}
                onChange={(event) => updateProfile('firstName', event.target.value)}
                disabled={!isEditable}
              />
            </div>

            <div className="account-field">
              <label htmlFor="profile-last-name">Last Name</label>
              <input
                id="profile-last-name"
                type="text"
                value={profile.lastName}
                onChange={(event) => updateProfile('lastName', event.target.value)}
                disabled={!isEditable}
              />
            </div>

            <div className="account-field">
              <label htmlFor="profile-gender">Gender</label>
              <select
                id="profile-gender"
                value={profile.gender}
                onChange={(event) => updateProfile('gender', event.target.value)}
                disabled={!isEditable}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="account-field">
              <label htmlFor="profile-date-of-birth">Date of Birth</label>
              <input
                id="profile-date-of-birth"
                type="date"
                value={profile.dateOfBirth}
                onChange={(event) => updateProfile('dateOfBirth', event.target.value)}
                disabled={!isEditable}
              />
            </div>

            <div className="account-field">
              <label htmlFor="profile-address">Address</label>
              <input
                id="profile-address"
                type="text"
                value={profile.address}
                onChange={(event) => updateProfile('address', event.target.value)}
                disabled={!isEditable}
                placeholder="Street, city, country"
              />
            </div>

            <div className="account-field">
              <label htmlFor="profile-phone">Phone Number</label>
              <input
                id="profile-phone"
                type="tel"
                value={profile.phone}
                onChange={(event) => updateProfile('phone', event.target.value)}
                disabled={!isEditable}
                placeholder="+92 300 0000000"
              />
            </div>

            <div className="account-field">
              <label htmlFor="profile-username">Username</label>
              <input id="profile-username" type="text" value={profile.username} disabled readOnly />
            </div>
          </div>
        </div>
      </form>

      <section className="account-card" aria-labelledby="profile-emails-title">
        <div className="account-card-header">
          <div>
            <h2 id="profile-emails-title">Email Addresses</h2>
            <p>Manage the email addresses attached to this account.</p>
          </div>
          <button className="account-button-secondary" type="button">
            <FiPlus size={16} />
            Add Email
          </button>
        </div>
        <div className="account-card-body">
          <ul className="account-email-list">
            {emailList.map((item) => (
              <li className="account-email-item" key={item.email}>
                <FiMail size={18} aria-hidden="true" />
                <div>
                  <strong>{item.email}</strong>
                  <span>{item.addedAgo}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="account-card" aria-labelledby="profile-access-title">
        <div className="account-card-body">
          <ul className="account-info-list">
            <li className="account-info-item">
              <FiUser size={18} aria-hidden="true" />
              <div>
                <strong>Profile visibility</strong>
                <span>Your profile data is used inside this workspace and does not change FBR invoice payload details.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </AccountPageShell>
  );
}

export default EditProfile;
