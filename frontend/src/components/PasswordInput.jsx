import { useState } from "react";

function EyeIcon({ slashed = false }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      {slashed && <line x1="2" y1="2" x2="22" y2="22" />}
    </svg>
  );
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  required = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        className="input"
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        style={{ paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 10,
          background: "none",
          border: "none",
          color: "var(--muted)",
          padding: 4,
          display: "flex",
          alignItems: "center",
        }}
      >
        <EyeIcon slashed={visible} />
      </button>
    </div>
  );
}
