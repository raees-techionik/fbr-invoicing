import React, { useRef, useState } from 'react';
import { FiArrowRight, FiMail, FiRefreshCw, FiShield, FiSmartphone } from 'react-icons/fi';
import AccountPageShell from './AccountPageShell';
import useBlockBackButton from '../../Components/useBlockBackButton';

function TwoFactor() {
  useBlockBackButton();
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [message, setMessage] = useState('');
  const inputRefs = useRef([]);

  const handleOtpChange = (event, index) => {
    const value = event.target.value.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      setOtp(pasted.split(''));
      inputRefs.current[3]?.focus();
    }
    event.preventDefault();
  };

  const handleVerify = (event) => {
    event.preventDefault();
    setMessage('Two-factor setup verified locally. Connect this action to the account API when available.');
  };

  return (
    <AccountPageShell
      title="Two-Factor Authentication"
      subtitle="Add another verification step before users can access this workspace."
      eyebrow="Privacy & Settings"
    >
      <section className="account-card" aria-labelledby="two-factor-title">
        <div className="account-card-header">
          <div>
            <h2 id="two-factor-title">Two-step verification</h2>
            <p>Use email or an authenticator flow to protect new sign-ins.</p>
          </div>
          <span className="account-alert success">Recommended</span>
        </div>

        <div className="account-card-body">
          {step === 1 && (
            <>
              <ul className="account-info-list">
                <li className="account-info-item">
                  <FiShield size={20} aria-hidden="true" />
                  <div>
                    <strong>Extra sign-in protection</strong>
                    <span>Verification codes reduce the risk of unauthorized access from new devices.</span>
                  </div>
                </li>
                <li className="account-info-item">
                  <FiSmartphone size={20} aria-hidden="true" />
                  <div>
                    <strong>Email or authenticator setup</strong>
                    <span>Start with email verification now, then extend this screen to authenticator apps later.</span>
                  </div>
                </li>
              </ul>

              <div className="account-button-row">
                <button className="account-button-primary" type="button" onClick={() => setStep(2)}>
                  Set Up
                  <FiArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <form onSubmit={handleVerify}>
              <ul className="account-info-list">
                <li className="account-info-item">
                  <FiMail size={20} aria-hidden="true" />
                  <div>
                    <strong>Email setup</strong>
                    <span>A verification code was sent to hamza@techionikltd@gmail.com. The code is valid for 15 minutes.</span>
                  </div>
                </li>
              </ul>

              <fieldset className="account-field-full" onPaste={handlePaste}>
                <label>Verification Code</label>
                <div className="account-otp-row">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Verification code digit ${index + 1}`}
                      maxLength={1}
                      value={digit}
                      ref={(element) => { inputRefs.current[index] = element; }}
                      onChange={(event) => handleOtpChange(event, index)}
                    />
                  ))}
                </div>
              </fieldset>

              {message && <div className="account-alert success" role="status">{message}</div>}

              <div className="account-button-row">
                <button className="account-button-primary" type="submit" disabled={otp.some((digit) => !digit)}>
                  Verify Code
                </button>
                <button className="account-button-secondary" type="button" onClick={() => setOtp(['', '', '', ''])}>
                  <FiRefreshCw size={16} />
                  Resend Code
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </AccountPageShell>
  );
}

export default TwoFactor;
