import React, { useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FiArrowRight, FiBriefcase, FiLock, FiMail, FiPhone, FiUser } from "react-icons/fi";
import logo from "./Images/New Black Logo 1.png";
import icon from "./Images/TechionikIcon.png";
import "./Signup.css";

const Signup = () => {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    personalWorkspaceName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = typeof location.state?.from === "string" && location.state.from.startsWith("/") && !location.state.from.startsWith("//")
    ? location.state.from
    : "/dashboard";

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();

    if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Full name, email, and password are required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
      await axios.post(`${API_BASE_URL}/api/auth/register`, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(form.phone.trim() && { phone: form.phone.trim() }),
        ...(form.personalWorkspaceName.trim() && { personalWorkspaceName: form.personalWorkspaceName.trim() }),
      });

      navigate("/", {
        state: {
          successMessage: "Account created! Please log in.",
          from: returnTo,
        },
      });
    } catch (err) {
      if (err.response?.status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="signup-page">
      <section className="signup-auth-panel" aria-labelledby="signup-title">
        <div className="signup-brand">
          <img src={logo} alt="Techionik Digital Invoicing" />
          <span>FBR Digital Invoicing</span>
        </div>

        <div className="signup-copy">
          <span>Get started</span>
          <h1 id="signup-title">Create Account</h1>
          <p>Set up your account to manage invoices, FBR submissions, and your business workspace.</p>
        </div>

        <form className="signup-form" onSubmit={handleSignup}>
          <label className="signup-field" htmlFor="signup-fullname">
            <span>Full Name</span>
            <div>
              <FiUser size={18} />
              <input
                id="signup-fullname"
                type="text"
                autoComplete="name"
                placeholder="John Doe"
                value={form.fullName}
                onChange={set("fullName")}
              />
            </div>
          </label>

          <label className="signup-field" htmlFor="signup-email">
            <span>Email Address</span>
            <div>
              <FiMail size={18} />
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={set("email")}
              />
            </div>
          </label>

          <label className="signup-field" htmlFor="signup-password">
            <span>Password</span>
            <div>
              <FiLock size={18} />
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set("password")}
              />
              <button
                type="button"
                className="signup-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <label className="signup-field" htmlFor="signup-phone">
            <span>Phone <em>(optional)</em></span>
            <div>
              <FiPhone size={18} />
              <input
                id="signup-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+92 300 0000000"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
          </label>

          <label className="signup-field" htmlFor="signup-workspace">
            <span>Workspace Name <em>(optional)</em></span>
            <div>
              <FiBriefcase size={18} />
              <input
                id="signup-workspace"
                type="text"
                autoComplete="organization"
                placeholder="My Business"
                value={form.personalWorkspaceName}
                onChange={set("personalWorkspaceName")}
              />
            </div>
          </label>

          {error && <div className="signup-alert danger" role="alert">{error}</div>}

          <button className="signup-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <FiArrowRight size={17} />
              </>
            )}
          </button>

          <p className="signup-login-link">
            Already have an account? <Link to="/" state={{ from: returnTo }}>Log in</Link>
          </p>
        </form>

        <div className="signup-powered">
          <img src={icon} alt="Techionik" />
          <span>
            Powered by <strong>Techionik</strong>
          </span>
        </div>
      </section>

      <section className="signup-visual-panel" aria-hidden="true">
        <div className="signup-visual-deco signup-visual-deco--1" />
        <div className="signup-visual-deco signup-visual-deco--2" />
        <div className="signup-visual-deco signup-visual-deco--3" />
        <div className="signup-visual-inner">
          <div className="signup-visual-eyebrow">
            <span className="signup-visual-dot" />
            Start for free today
          </div>
          <h2 className="signup-visual-headline">Everything you need<br />to go FBR-compliant</h2>
          <p className="signup-visual-sub">Your account gives you instant access to the full platform — invoicing, reporting, sandbox testing, and your team workspace.</p>
          <div className="signup-visual-cards">
            <div className="signup-feature-card">
              <span className="signup-feature-card__icon">⚡</span>
              <div>
                <strong>Instant Setup</strong>
                <p>Your workspace is ready the moment you register — no waiting period.</p>
              </div>
            </div>
            <div className="signup-feature-card">
              <span className="signup-feature-card__icon">🔒</span>
              <div>
                <strong>Secure by Default</strong>
                <p>JWT sessions, bcrypt passwords, and role-based access from day one.</p>
              </div>
            </div>
            <div className="signup-feature-card">
              <span className="signup-feature-card__icon">🧪</span>
              <div>
                <strong>Sandbox Included</strong>
                <p>Test FBR submissions risk-free before going live with real invoices.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Signup;
