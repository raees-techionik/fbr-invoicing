import React, { useState } from 'react';
import { FiAlertTriangle, FiXCircle } from 'react-icons/fi';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';

function Deactive() {
  useBlockBackButton();
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <AccountPageShell
      title="Deactivate Account"
      subtitle="Review the impact before disabling this workspace account."
      eyebrow="Account Manager"
    >
      <form className="account-card" onSubmit={handleSubmit}>
        <div className="account-card-header">
          <div>
            <h2>Delete Account</h2>
            <p>This action is permanent and can affect access to saved workspace data.</p>
          </div>
          <FiAlertTriangle size={24} color="#dc2626" aria-hidden="true" />
        </div>

        <div className="account-card-body">
          <div className="account-alert warning" role="alert">
            Deleting your account will remove associated content and make this user ID unavailable for re-registration.
          </div>

          <div className="account-form-grid">
            <div className="account-field-full">
              <label htmlFor="deactivate-password">Password</label>
              <input
                id="deactivate-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          <div className="account-check">
            <input
              id="deactivate-confirm"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <label htmlFor="deactivate-confirm">I understand this action is irreversible.</label>
          </div>

          <div className="account-button-row">
            <button className="account-button-danger" type="submit" disabled={!password || !confirmed}>
              <FiXCircle size={16} />
              Deactivate Account
            </button>
            <button
              className="account-button-secondary"
              type="button"
              onClick={() => {
                setPassword('');
                setConfirmed(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </AccountPageShell>
  );
}

export default Deactive;
