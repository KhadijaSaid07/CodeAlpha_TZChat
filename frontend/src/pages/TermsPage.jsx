import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 32, paddingBottom: 32 }}>
      <div className="auth-card" style={{ maxWidth: 680, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", margin: 0 }}>TZChat Terms &amp; Services</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>
              Effective Date: November 2026 · TZChat (Connect. Chat. Share.)
            </p>
          </div>
          <Link to="/register" className="btn btn-outline btn-sm">
            ← Back to Register
          </Link>
        </div>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>1. Account &amp; Eligibility</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            To use TZChat, you must provide accurate registration information (full name, unique username,
            valid email address, and phone number) and keep your password secure. You are responsible for
            all activity under your account.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>2. Community Guidelines &amp; Acceptable Use</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            You agree to treat other users respectfully. Harassment, hate speech, spam, impersonation,
            explicit or illegal content, and unauthorized attempts to access other accounts or platform
            infrastructure are strictly prohibited.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>3. User Content &amp; Media</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            You retain ownership of the posts, photos, videos, voice messages, and files you share on TZChat.
            By posting content, you grant TZChat permission to store and display that content according to
            the visibility and privacy settings you choose.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>4. Privacy &amp; Controls</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            TZChat gives you control over your profile visibility, profile picture visibility, direct message
            permissions, group permissions, and blocked users in Settings. You may update your settings or
            delete your own posts, comments, and messages at any time.
          </p>
        </section>

        <section style={{ display: "grid", gap: 6 }}>
          <h3 style={{ fontSize: "1.02rem" }}>5. Moderation &amp; Enforcement</h3>
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
            Users can report abusive accounts, posts, or messages. TZChat administrators review reports and
            may remove violating content or suspend accounts that breach these Terms to keep the community safe.
          </p>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <Link to="/register" className="btn btn-primary btn-sm">
            I Understand — Return to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
