import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";

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
        <h2 style={{ marginBottom: 6 }}>Reset Password</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 16 }}>
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

        <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.9rem" }}>
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
