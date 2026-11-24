import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const COUNTRY_CODES = [
  { code: "+255", label: "🇹🇿 Tanzania (+255)" },
  { code: "+254", label: "🇰🇪 Kenya (+254)" },
  { code: "+256", label: "🇺🇬 Uganda (+256)" },
  { code: "+250", label: "🇷🇼 Rwanda (+250)" },
  { code: "+257", label: "🇧🇮 Burundi (+257)" },
  { code: "+27", label: "🇿🇦 South Africa (+27)" },
  { code: "+234", label: "🇳🇬 Nigeria (+234)" },
  { code: "+233", label: "🇬🇭 Ghana (+233)" },
  { code: "+20", label: "🇪🇬 Egypt (+20)" },
  { code: "+44", label: "🇬🇧 United Kingdom (+44)" },
  { code: "+1", label: "🇺🇸 USA / Canada (+1)" },
  { code: "+91", label: "🇮🇳 India (+91)" },
  { code: "+971", label: "🇦🇪 UAE (+971)" },
  { code: "+966", label: "🇸🇦 Saudi Arabia (+966)" },
  { code: "+49", label: "🇩🇪 Germany (+49)" },
  { code: "+33", label: "🇫🇷 France (+33)" },
  { code: "+86", label: "🇨🇳 China (+86)" },
  { code: "other", label: "🌍 Other (type +code)" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const nextUrl = location.state?.from || sessionStorage.getItem("tzchat_next") || "";
  const [countryCode, setCountryCode] = useState("+255");
  const [customCode, setCustomCode] = useState("+");
  const [localPhone, setLocalPhone] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms & Conditions.");
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    const prefix = countryCode === "other" ? customCode.trim() : countryCode;
    const cleanedLocal = localPhone.replace(/^0+/, "").replace(/[\s\-()]/g, "");
    const fullPhone = `${prefix}${cleanedLocal}`;

    setSubmitting(true);
    try {
      await register({ ...form, phone_number: fullPhone });
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Link to="/" className="btn btn-ghost btn-sm">←</Link>
          <div>
            <h2 style={{ fontSize: "1.25rem" }}>Create Account</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Let&apos;s get started</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "155px 1fr", gap: 8 }}>
            <select
              className="input"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              aria-label="Country code"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="tel"
              placeholder="Phone number (e.g. 712345678)"
              value={localPhone}
              onChange={(e) => setLocalPhone(e.target.value)}
              required
            />
          </div>

          {countryCode === "other" && (
            <input
              className="input"
              type="text"
              placeholder="Country code (e.g. +81)"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              required
            />
          )}

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

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--muted)" }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I agree to the Terms &amp; Conditions</span>
          </label>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.9rem", color: "var(--muted)" }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
