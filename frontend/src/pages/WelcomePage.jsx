import { Link } from "react-router-dom";

export default function WelcomePage() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="brand-badge">💬</div>
        <h1 style={{ fontSize: "1.75rem", marginBottom: 6 }}>Welcome to TZChat</h1>
        <p style={{ color: "var(--primary)", fontWeight: 700, marginBottom: 10 }}>
          Connect. Chat. Share.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: 22 }}>
          Join our community and stay connected with friends, family, and groups around the world.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <Link to="/register" className="btn btn-primary">
            Sign Up
          </Link>
          <Link to="/login" className="btn btn-outline">
            Login
          </Link>
        </div>

        <div style={{ textAlign: "left", fontSize: "0.88rem", color: "var(--muted)", display: "grid", gap: 6 }}>
          <div>✅ Share posts with photos &amp; videos</div>
          <div>✅ Chat privately &amp; in groups in real time</div>
          <div>✅ Follow &amp; make friends</div>
          <div>✅ Full privacy control</div>
        </div>
      </div>
    </div>
  );
}
