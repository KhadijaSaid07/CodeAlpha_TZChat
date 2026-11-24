import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const regSuccess = location.state?.successMessage || "";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedIn = await login(identifier, password);
      showToast("Welcome back to TZChat!");
      if (loggedIn.role === "admin" || loggedIn.role === "super_admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/home");
      }
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-badge">💬</div>
        <h2 style={{ textAlign: "center", marginBottom: 4 }}>Login to TZChat</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem", marginBottom: 18 }}>
          Welcome back!
        </p>

        {regSuccess && <div className="alert alert-success">{regSuccess}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Username or Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
          <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
            <Link to="/forgot-password">Forgot Password?</Link>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.9rem", color: "var(--muted)" }}>
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
