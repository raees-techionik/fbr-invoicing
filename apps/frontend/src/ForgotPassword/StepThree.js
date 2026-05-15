import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import { resetPassword } from "../services/authApi";
import "./ForgotPassword.css";

const StepThree = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const email = sessionStorage.getItem("reset_email") || "";
  const resetToken = sessionStorage.getItem("reset_token") || "";

  useEffect(() => {
    if (!email || !resetToken) navigate("/forgot-password");
  }, [email, resetToken, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword(email, resetToken, newPassword);
      sessionStorage.removeItem("reset_email");
      sessionStorage.removeItem("reset_token");
      navigate("/", { state: { successMessage: "Password reset successfully. Please log in." } });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="forgot-page">
      <section className="forgot-card" aria-labelledby="new-password-title">
        <Link className="forgot-back-link" to="/forgot-password/reset-password">
          <FiArrowLeft size={16} />
          Back to Code
        </Link>

        <div className="forgot-icon">
          <FiLock size={24} />
        </div>

        <div className="forgot-copy">
          <span>New password</span>
          <h1 id="new-password-title">Set a New Password</h1>
          <p>Create a new password for <strong>{email}</strong>.</p>
        </div>

        <form className="forgot-form" onSubmit={handleSubmit}>
          <label className="forgot-field" htmlFor="new-password">
            <span>New Password</span>
            <div className="forgot-field-control">
              <FiLock size={18} />
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="forgot-password-toggle"
                onClick={() => setShowNew(prev => !prev)}
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                {showNew ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <label className="forgot-field" htmlFor="confirm-password">
            <span>Confirm Password</span>
            <div className="forgot-field-control">
              <FiLock size={18} />
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="forgot-password-toggle"
                onClick={() => setShowConfirm(prev => !prev)}
                aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
              >
                {showConfirm ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          {error && <div className="forgot-alert danger" role="alert">{error}</div>}

          <button className="forgot-primary-action" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                Set New Password
                <FiArrowRight size={17} />
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
};

export default StepThree;
