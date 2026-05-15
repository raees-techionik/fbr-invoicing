import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiMail, FiRefreshCw } from "react-icons/fi";
import { requestPasswordReset, verifyResetCode } from "../services/authApi";
import "./ForgotPassword.css";

const StepTwo = () => {
  const navigate = useNavigate();
  const inputRefs = useRef([]);
  const [code, setCode] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  const email = sessionStorage.getItem("reset_email") || "";

  useEffect(() => {
    if (!email) {
      navigate("/forgot-password");
      return;
    }

    const stored = sessionStorage.getItem("reset_dev_code");
    if (stored) setDevCode(stored);
    inputRefs.current[0]?.focus();
  }, [email, navigate]);

  const handleChange = (event, index) => {
    const val = event.target.value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = val;
    setCode(next);
    setError("");
    if (val && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setCode(pasted.split(""));
      inputRefs.current[3]?.focus();
    }
    event.preventDefault();
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    const fullCode = code.join("");
    if (fullCode.length < 4) {
      setError("Please enter the 4-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await verifyResetCode(email, fullCode);
      sessionStorage.setItem("reset_token", res.resetToken);
      sessionStorage.removeItem("reset_dev_code");
      navigate("/forgot-password/reset-password/new-password");
    } catch (err) {
      setError(err?.response?.data?.error || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");

    try {
      const res = await requestPasswordReset(email);
      if (res.devCode) {
        sessionStorage.setItem("reset_dev_code", res.devCode);
        setDevCode(res.devCode);
      }
      setCode(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="forgot-page">
      <section className="forgot-card" aria-labelledby="verify-title">
        <Link className="forgot-back-link" to="/forgot-password">
          <FiArrowLeft size={16} />
          Change Email
        </Link>

        <div className="forgot-icon">
          <FiMail size={24} />
        </div>

        <div className="forgot-copy">
          <span>Verify code</span>
          <h1 id="verify-title">Check Your Email</h1>
          <p>A 4-digit reset code was sent to <strong>{email}</strong>.</p>
        </div>

        {devCode && (
          <div className="forgot-alert info">
            Dev mode code: <strong>{devCode}</strong>
          </div>
        )}

        <form className="forgot-form" onSubmit={handleVerify}>
          <fieldset className="forgot-code-group" onPaste={handlePaste}>
            <legend>Reset Code</legend>
            <div className="forgot-code-inputs">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  className="forgot-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Code digit ${index + 1}`}
                  maxLength={1}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  value={code[index]}
                  onChange={(event) => handleChange(event, index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  disabled={loading}
                />
              ))}
            </div>
          </fieldset>

          {error && <div className="forgot-alert danger" role="alert">{error}</div>}

          <button className="forgot-primary-action" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Verifying...
              </>
            ) : (
              <>
                Verify Code
                <FiArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <button className="forgot-text-action" type="button" onClick={handleResend} disabled={resending}>
          {resending ? <FiRefreshCw size={15} /> : null}
          {resending ? "Resending..." : "Resend code"}
        </button>
      </section>
    </main>
  );
};

export default StepTwo;
