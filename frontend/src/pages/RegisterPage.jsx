import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import TZLogo from "../components/TZLogo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const nextUrl = location.state?.from || sessionStorage.getItem("tzchat_next") || "";

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    phone_number: "",
    password: "",
    confirm_password: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    if (field === "full_name") {
      // Prevent typing numbers or invalid symbols in Full Name
      const lettersOnly = value.replace(/[^A-Za-z\s'-]/g, "");
      setForm((prev) => ({ ...prev, full_name: lettersOnly }));
      return;
    }
    if (field === "phone_number") {
      // Allow only leading + and digits/spaces/hyphens
      const phoneClean = value.replace(/[^0-9+\s-]/g, "");
      setForm((prev) => ({ ...prev, phone_number: phoneClean }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const trimmedName = form.full_name.trim();
    const trimmedUsername = form.username.trim();
    const trimmedEmail = form.email.trim();
    const cleanedPhone = form.phone_number.replace(/[\s\-()]/g, "");

    if (!/^[A-Za-z][A-Za-z\s'-]{1,79}$/.test(trimmedName)) {
      setError("Full Name must contain only letters (at least 2 characters, no numbers).");
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9_]{2,29}$/.test(trimmedUsername)) {
      setError("Username must be 3-30 characters, start with a letter, and contain only letters, numbers, or underscores.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!/^\+?[0-9]{7,15}$/.test(cleanedPhone)) {
      setError("Phone number must be 7-15 digits (optional leading +, no letters).");
      return;
    }
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError("Password must be at least 8 characters and include both letters and numbers.");
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        ...form,
        full_name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        phone_number: cleanedPhone,
      });
      showToast("Your registration is successful! Please login.");
      navigate("/login", {
        state: { successMessage: "Your registration is successful! Please login.", from: nextUrl },
      });
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }}>
            ← Home
          </Link>
          <TZLogo size={40} />
        </div>

        <h2 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Create Account</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: 18 }}>
          Join TZChat in seconds. Enter your details below.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 11 }}>
          <input
            className="input"
            type="text"
            placeholder="Full Name"
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            required
          />
          <input
            className="input"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Username"
            value={form.username}
            onChange={(e) => updateField("username", e.target.value)}
            required
          />
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="Email Address"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
          />
          <input
            className="input"
            type="tel"
            autoComplete="tel"
            placeholder="Phone number (e.g. +255712345678)"
            value={form.phone_number}
            onChange={(e) => updateField("phone_number", e.target.value)}
            required
          />
          <PasswordInput
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            placeholder="Password (min 8 characters)"
            autoComplete="new-password"
          />
          <PasswordInput
            value={form.confirm_password}
            onChange={(e) => updateField("confirm_password", e.target.value)}
            placeholder="Confirm Password"
            autoComplete="new-password"
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", color: "var(--muted)", marginTop: 2 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ accentColor: "var(--primary)", width: 16, height: 16, flexShrink: 0 }}
            />
            <span>
              I agree to the{" "}
              <Link
                to="/terms"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontWeight: 600, textDecoration: "underline" }}
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontWeight: 600, textDecoration: "underline" }}
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 4 }}>
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.88rem", color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link to="/login" state={{ from: nextUrl }} style={{ fontWeight: 600 }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
