import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, setAccessToken } from "../../api/client";
import PasswordInput from "../../components/PasswordInput";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function AdminLoginPage() {
  const { setUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/admin-api/login/", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      setAccessToken(data.access);
      setUser(data.user);
      showToast("Admin login successful!");
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Administrator login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page" style={{ background: "linear-gradient(150deg, #0f172a 0%, #1e3a8a 100%)" }}>
      <div className="auth-card">
        <div className="brand-badge">🛡️</div>
        <h2 style={{ textAlign: "center", marginBottom: 4 }}>TZChat Admin Portal</h2>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.9rem", marginBottom: 18 }}>
          Sign in with your Administrator or Super Admin account
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Admin Username or Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin Password"
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In to Admin"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.88rem" }}>
          <Link to="/login">← Back to User Login</Link>
        </p>
      </div>
    </div>
  );
}
