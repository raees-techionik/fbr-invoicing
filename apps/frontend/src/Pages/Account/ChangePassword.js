import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiEye, FiEyeOff, FiKey, FiSave } from 'react-icons/fi';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';

function ChangePassword() {
  useBlockBackButton();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('Password settings saved locally. Connect this form to the account API when it is ready.');
  };

  const renderPasswordField = ({ id, label, show, setShow, autoComplete }) => (
    <div className="account-field-full">
      <label htmlFor={id}>{label}</label>
      <div className="account-input-action">
        <input id={id} type={show ? 'text' : 'password'} placeholder="Enter password" autoComplete={autoComplete} />
        <button
          className="account-icon-button"
          type="button"
          onClick={() => setShow((value) => !value)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <FiEyeOff size={17} /> : <FiEye size={17} />}
        </button>
      </div>
    </div>
  );

  return (
    <AccountPageShell
      title="Change Password"
      subtitle="Update your sign-in password for this workspace account."
      eyebrow="Security"
    >
      <form className="account-card" onSubmit={handleSubmit}>
        <div className="account-card-header">
          <div>
            <h2>Password</h2>
            <p>Use at least 8 characters and avoid reusing old passwords.</p>
          </div>
          <FiKey size={24} color="#007a3d" aria-hidden="true" />
        </div>

        <div className="account-card-body">
          <div className="account-form-grid">
            {renderPasswordField({
              id: 'current-password',
              label: 'Current Password',
              show: showCurrent,
              setShow: setShowCurrent,
              autoComplete: 'current-password',
            })}
            <div className="account-field-full">
              <Link className="account-button-text" to="/forgot-password">
                Forgot your current password?
              </Link>
            </div>
            {renderPasswordField({
              id: 'new-password',
              label: 'New Password',
              show: showNew,
              setShow: setShowNew,
              autoComplete: 'new-password',
            })}
            {renderPasswordField({
              id: 'confirm-password',
              label: 'Confirm Password',
              show: showConfirm,
              setShow: setShowConfirm,
              autoComplete: 'new-password',
            })}
          </div>

          {message && <div className="account-alert success" role="status">{message}</div>}

          <div className="account-button-row">
            <button className="account-button-primary" type="submit">
              <FiSave size={16} />
              Save Password
            </button>
          </div>
        </div>
      </form>
    </AccountPageShell>
  );
}

export default ChangePassword;
