import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiMail, FiShield } from "react-icons/fi";
import { requestPasswordReset } from "../services/authApi";
import "./ForgotPassword.css";

const StepOne = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await requestPasswordReset(email.trim());
      sessionStorage.setItem("reset_email", email.trim());
      if (res.devCode) {
        sessionStorage.setItem("reset_dev_code", res.devCode);
      }
      navigate("/forgot-password/reset-password");
    } catch (err) {
      setError(err?.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="forgot-page">
      <section className="forgot-card" aria-labelledby="forgot-title">
        <Link className="forgot-back-link" to="/">
          <FiArrowLeft size={16} />
          Back to Login
        </Link>

        <div className="forgot-icon">
          <FiShield size={24} />
        </div>

        <div className="forgot-copy">
          <span>Password recovery</span>
          <h1 id="forgot-title">Forgot Password</h1>
          <p>Enter your registered email and we will send a 4-digit reset code for your account.</p>
        </div>

        <form className="forgot-form" onSubmit={handleSubmit}>
          <label className="forgot-field" htmlFor="reset-email">
            <span>Email Address</span>
            <div className="forgot-field-control">
              <FiMail size={18} />
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="admin@fbr.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />
            </div>
          </label>

          {error && <div className="forgot-alert danger" role="alert">{error}</div>}

          <button className="forgot-primary-action" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Sending...
              </>
            ) : (
              <>
                Send Reset Code
                <FiArrowRight size={17} />
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
};

export default StepOne;
