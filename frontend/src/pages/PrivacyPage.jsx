import { Link } from "react-router-dom";
import TZLogo from "../components/TZLogo";

export default function PrivacyPage() {
  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 32, paddingBottom: 32 }}>
      <div className="auth-card" style={{ maxWidth: 700, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <TZLogo size={38} />
            <div>
              <h1 style={{ fontSize: "1.45rem", margin: 0 }}>TZChat Privacy Policy</h1>
              <p style={{ color: "var(--muted)", fontSize: "0.84rem", marginTop: 2 }}>
                Effective Date: November 2026 · TZChat (Connect. Chat. Share.)
              </p>
            </div>
          </div>
          <Link to="/register" className="btn btn-outline btn-sm">
            ← Back to Register
          </Link>
        </div>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>1. Information We Collect</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            When you create a TZChat account, we collect your full name, username, email address, phone
            number, and optional profile details (bio, location, profile picture, and cover image) as well
            as the posts, comments, messages, voice notes, and group activity you choose to share.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>2. How We Use Your Information</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            We use your information to authenticate your account securely, deliver real-time private and
            group messages, display your social feed, send notifications, and protect the community
            through moderation and abuse prevention.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>3. Your Privacy Controls</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            In TZChat Settings, you control who can view your profile, who can see your profile picture
            (enforced on the backend), who can message you directly, who can find you by phone number,
            and which accounts are blocked.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>4. Security &amp; Data Protection</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            Passwords are stored using strong cryptographic hashing, and sessions are protected with
            short-lived JWT access tokens and rotating HttpOnly refresh cookies over HTTPS.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>5. Contact &amp; Data Requests</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            You can update or delete your posts, comments, messages, and profile information at any time.
            For privacy questions, reach out to our team via the Contact section on the TZChat home page.
          </p>
        </section>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <Link to="/terms" style={{ fontSize: "0.88rem", fontWeight: 600 }}>
            Read Terms of Service →
          </Link>
          <Link to="/register" className="btn btn-primary btn-sm">
            Return to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
