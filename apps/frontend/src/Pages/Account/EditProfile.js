import React, { useState } from 'react';
import { FiMail, FiPlus, FiSave, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';

const initialProfile = {
  firstName: 'Hamza',
  lastName: 'Razaq',
  gender: '',
  dateOfBirth: '',
  address: '',
  phone: '',
  username: '@hamzarrazaq-01',
  password: 'password123',
};

function EditProfile() {
  useBlockBackButton();
  const [isEditable, setIsEditable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [emailList] = useState([
    { email: 'hamzarrazaq@gmail.com', addedAgo: '1 month ago' },
  ]);

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
            <div className="account-avatar" aria-hidden="true">HR</div>
            <div>
              <strong>Hamza Razaq</strong>
              <span>hamzarrazaq@gmail.com</span>
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

            <div className="account-field">
              <label htmlFor="profile-password">Password</label>
              <div className="account-input-action">
                <input
                  id="profile-password"
                  type={showPassword ? 'text' : 'password'}
                  value={profile.password}
                  disabled={!isEditable}
                  readOnly
                />
                {isEditable && (
                  <button
                    className="account-icon-button"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide profile password' : 'Show profile password'}
                  >
                    {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                  </button>
                )}
              </div>
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
                  <span>Added {item.addedAgo}</span>
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
