import React, { useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { FiArrowRight, FiLock, FiMail, FiShield } from "react-icons/fi";
import loginimg from "./Images/imglogin.png";
import logo from "./Images/New Black Logo 1.png";
import icon from "./Images/TechionikIcon.png";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.successMessage || "";

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

      const { accessToken, user } = response.data;

      localStorage.setItem("token", accessToken);
      localStorage.setItem("email", user.email);

      navigate("/dashboard");
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
        </form>

        <div className="login-powered">
          <img src={icon} alt="Techionik" />
          <span>
            Powered by <strong>Techionik</strong>
          </span>
        </div>
      </section>

      <section className="login-visual-panel" aria-label="Digital invoicing overview">
        <div className="login-visual-card">
          <div className="login-visual-card__top">
            <span>Submission Readiness</span>
            <strong>Live</strong>
          </div>
          <img src={loginimg} alt="Digital invoicing dashboard illustration" />
        </div>
        <div className="login-readiness-strip" aria-label="Platform highlights">
          <span>Token Settings</span>
          <span>Sandbox Testing</span>
          <span>Offline Queue</span>
        </div>
      </section>
    </main>
  );
};

export default Login;
