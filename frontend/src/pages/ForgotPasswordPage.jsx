import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import TZLogo from "../components/TZLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/auth/password-reset/", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Link to="/login" className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }}>
            ← Login
          </Link>
          <TZLogo size={40} />
        </div>

        <h2 style={{ fontSize: "1.35rem", marginBottom: 6 }}>Reset Password</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: 16 }}>
          Enter your registered email address to receive reset instructions.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Sending..." : "Send Reset Instructions"}
          </button>
        </form>
      </div>
    </div>
  );
}
