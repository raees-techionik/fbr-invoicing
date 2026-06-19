import React, { useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FiArrowRight, FiLock, FiMail, FiShield } from "react-icons/fi";
import logo from "./Images/New Black Logo 1.png";
import icon from "./Images/TechionikIcon.png";
import "./Login.css";
import { setActiveCompanyId } from "./services/companySession";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.successMessage || "";
  const returnTo = typeof location.state?.from === "string" && location.state.from.startsWith("/") && !location.state.from.startsWith("//")
    ? location.state.from
    : "/dashboard";

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password,
      });

      const { accessToken, user, activeCompany } = response.data;

      localStorage.setItem("token", accessToken);
      localStorage.setItem("email", user.email);
      setActiveCompanyId(activeCompany?.id);

      navigate(returnTo, { replace: true });
    } catch (err) {
      console.error("Login failed", err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-auth-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <img src={logo} alt="Techionik Digital Invoicing" />
          <span>FBR Digital Invoicing</span>
        </div>

        <div className="login-copy">
          <span>Secure access</span>
          <h1 id="login-title">Login</h1>
          <p>Access your dashboard, invoices, FBR settings, and sandbox readiness tools.</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <label className="login-field" htmlFor="login-email">
            <span>Email Address</span>
            <div>
              <FiMail size={18} />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="admin@fbr.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label className="login-field" htmlFor="login-password">
            <span>Password</span>
            <div>
              <FiLock size={18} />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <div className="login-form-row">
            <span className="login-secure-note">
              <FiShield size={15} /> JWT protected session
            </span>
            <Link to="/forgot-password">Forgot Password?</Link>
          </div>

          {successMessage && <div className="login-alert success">{successMessage}</div>}
          {error && <div className="login-alert danger" role="alert">{error}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Logging in...
              </>
            ) : (
              <>
                Login Now
                <FiArrowRight size={17} />
              </>
            )}
          </button>

          <p className="login-signup-link">
            Don't have an account? <Link to="/signup" state={{ from: returnTo }}>Sign up</Link>
          </p>
        </form>

        <div className="login-powered">
          <img src={icon} alt="Techionik" />
          <span>
            Powered by <strong>Techionik</strong>
          </span>
        </div>
      </section>

      <section className="login-visual-panel" aria-hidden="true">
        <div className="login-visual-deco login-visual-deco--1" />
        <div className="login-visual-deco login-visual-deco--2" />
        <div className="login-visual-deco login-visual-deco--3" />
        <div className="login-visual-inner">
          <div className="login-visual-eyebrow">
            <span className="login-visual-dot" />
            FBR Certified Platform
          </div>
          <h2 className="login-visual-headline">Pakistan's leading<br />e-invoicing solution</h2>
          <p className="login-visual-sub">Submit invoices directly to FBR in real time — with built-in offline fallback, sandbox testing, and multi-user access control.</p>
          <div className="login-visual-stats">
            <div className="login-stat">
              <span className="login-stat__value">99.9%</span>
              <span className="login-stat__label">Uptime</span>
            </div>
            <div className="login-stat">
              <span className="login-stat__value">&lt;2s</span>
              <span className="login-stat__label">FBR Response</span>
            </div>
            <div className="login-stat">
              <span className="login-stat__value">256-bit</span>
              <span className="login-stat__label">Encryption</span>
            </div>
          </div>
          <ul className="login-visual-features">
            <li><span className="login-feature-check">✓</span>Real-time FBR invoice submission</li>
            <li><span className="login-feature-check">✓</span>Offline queue with auto-retry</li>
            <li><span className="login-feature-check">✓</span>Sandbox testing environment</li>
            <li><span className="login-feature-check">✓</span>Multi-user roles &amp; permissions</li>
          </ul>
        </div>
      </section>
    </main>
  );
};

export default Login;
