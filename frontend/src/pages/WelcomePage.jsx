import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { MicIcon, PaperclipIcon } from "../components/NavIcons";
import TZLogo from "../components/TZLogo";

export default function WelcomePage() {
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactDesc, setContactDesc] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState("");
  const [contactError, setContactError] = useState("");

  async function handleContactSubmit(e) {
    e.preventDefault();
    setContactError("");
    setContactSuccess("");
    setContactSending(true);
    try {
      const res = await apiRequest("/api/admin-api/contact/", {
        method: "POST",
        body: JSON.stringify({
          email: contactEmail.trim(),
          contact: contactPhone.trim(),
          description: contactDesc.trim(),
        }),
      });
      setContactSuccess(res?.message || "Thank you! Your message has been sent to our admins.");
      setContactEmail("");
      setContactPhone("");
      setContactDesc("");
    } catch (err) {
      setContactError(err.message || "Could not send message. Please try again.");
    } finally {
      setContactSending(false);
    }
  }
  return (
    <div id="home" className="landing-page">
      {/* Always-visible Fixed Navbar (ONLY Home, Features, About, Contact) */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <a href="#home">
            <TZLogo size={36} showText lightText />
          </a>

          <nav className="landing-nav-links" aria-label="Main navigation">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link to="/login" className="landing-nav-login">
              Login
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm" style={{ borderRadius: 999, padding: "8px 16px" }}>
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Vibrant Hero Section */}
      <section className="landing-hero-band">
        <div className="landing-hero">
          <div>
            <span className="landing-kicker">TZChat · Connect. Chat. Share.</span>
            <h1 className="landing-title">
              Simple, fast messaging &amp; social sharing in one place.
            </h1>
            <p className="landing-subtitle">
              Share photos and videos with captions, chat privately or in WhatsApp-style groups
              with live voice notes, and stay in complete control of your privacy.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <Link to="/register" className="btn btn-primary" style={{ padding: "12px 26px", borderRadius: 999 }}>
                Create Free Account
              </Link>
              <Link to="/login" className="landing-hero-ghost">
                Sign In
              </Link>
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: "0.86rem", color: "rgba(255,255,255,0.82)" }}>
              <span>✓ Real-time WebSockets</span>
              <span>✓ Voice Notes &amp; Media</span>
              <span>✓ Mobile &amp; Desktop Ready</span>
            </div>
          </div>

          {/* Interactive-style Preview Card */}
          <div className="landing-preview">
            <div
              style={{
                background: "var(--brand-gradient)",
                color: "#fff",
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.22)",
                    border: "1px solid rgba(255,255,255,0.35)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "0.84rem",
                  }}
                >
                  TZ
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>TZChat Community</div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>12 participants · Active now</div>
                </div>
              </div>
              <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 999 }}>
                Group Info
              </span>
            </div>

            <div style={{ padding: 18, background: "#f7f6fc", display: "grid", gap: 10 }}>
              <div
                style={{
                  justifySelf: "start",
                  maxWidth: "82%",
                  background: "#ffffff",
                  color: "var(--text)",
                  padding: "10px 14px",
                  borderRadius: "16px 16px 16px 4px",
                  border: "1px solid var(--border)",
                  fontSize: "0.88rem",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--primary)", marginBottom: 2 }}>
                  Amina Hassan
                </div>
                Just shared our project photos on the feed!
              </div>

              <div
                style={{
                  justifySelf: "end",
                  maxWidth: "85%",
                  background: "var(--brand-gradient)",
                  color: "#fff",
                  padding: "10px 14px",
                  borderRadius: "16px 16px 4px 16px",
                  fontSize: "0.86rem",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.22)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2.5, height: 22 }}>
                    {[7, 14, 10, 18, 12, 20, 15, 9, 17, 13, 19, 11, 8, 15, 10, 6].map((h, idx) => (
                      <span
                        key={idx}
                        style={{
                          width: 3,
                          height: h,
                          borderRadius: 999,
                          background: idx < 9 ? "#ffffff" : "rgba(255,255,255,0.45)",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: "0.74rem", fontWeight: 600, opacity: 0.92 }}>0:14</span>
                </div>
                <div style={{ fontSize: "0.7rem", opacity: 0.85, textAlign: "right" }}>
                  10:32 AM ✓✓
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <span className="chat-attach-btn" style={{ width: 36, height: 36, pointerEvents: "none" }}>
                  <PaperclipIcon width={16} height={16} />
                </span>
                <div
                  style={{
                    flex: 1,
                    background: "#ffffff",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "8px 14px",
                    fontSize: "0.84rem",
                    color: "var(--muted)",
                  }}
                >
                  Message
                </div>
                <span className="chat-mic-btn" style={{ width: 38, height: 38, pointerEvents: "none" }}>
                  <MicIcon width={17} height={17} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-section">
        <div className="landing-section-head">
          <span className="pill pill-purple">Features</span>
          <h2>Everything you need to stay connected</h2>
          <p>Clean, simple, and fast across phones, tablets, and desktops.</p>
        </div>

        <div className="landing-features">
          <div className="card landing-feature-card">
            <span className="feature-icon-box">🖼️</span>
            <h3>Posts, Photos &amp; Videos</h3>
            <p>
              Share moments with custom captions, feelings, likes, and nested comment replies.
            </p>
          </div>

          <div className="card landing-feature-card">
            <span className="feature-icon-box">👥</span>
            <h3>Groups &amp; Voice Notes</h3>
            <p>
              Create WhatsApp-style groups with custom pictures, admin permissions, invite links, and voice messages.
            </p>
          </div>

          <div className="card landing-feature-card">
            <span className="feature-icon-box">🛡️</span>
            <h3>Privacy You Control</h3>
            <p>
              Separate Followers and Friends, message requests, user blocking, and backend-enforced avatar privacy.
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="landing-section" style={{ paddingTop: 12 }}>
        <div className="card landing-about-card">
          <div style={{ display: "grid", gap: 10 }}>
            <span className="pill pill-blue" style={{ width: "fit-content" }}>About TZChat</span>
            <h2 style={{ fontSize: "1.6rem" }}>Built for real conversations, without clutter</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              TZChat combines social sharing and instant WebSocket messaging in one unified platform.
              Whether you are sharing daily updates with friends, organizing study or project groups,
              or sending quick voice notes on mobile, TZChat keeps everything responsive, private, and effortless.
            </p>
          </div>
          <div className="landing-stats">
            <div className="landing-stat-box">
              <strong>Real-Time</strong>
              <span>WebSocket Messaging</span>
            </div>
            <div className="landing-stat-box">
              <strong>100%</strong>
              <span>Mobile Responsive</span>
            </div>
            <div className="landing-stat-box">
              <strong>Private</strong>
              <span>Granular Controls</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section (sends directly to Admin Notifications) */}
      <section id="contact" className="landing-section" style={{ paddingTop: 12, paddingBottom: 60 }}>
        <div className="card landing-contact-card">
          <div style={{ flex: "1 1 280px", display: "grid", gap: 8 }}>
            <span className="pill pill-purple" style={{ width: "fit-content" }}>Contact Us</span>
            <h2 style={{ fontSize: "1.55rem" }}>Send a message to the TZChat team</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.93rem" }}>
              Have a question, feedback, or partnership idea? Leave your email, contact number,
              and message below - our administrators receive it directly in their portal.
            </p>
          </div>

          <form
            onSubmit={handleContactSubmit}
            style={{ flex: "1 1 340px", display: "grid", gap: 10 }}
          >
            {contactSuccess && <div className="alert alert-success" style={{ marginBottom: 0 }}>{contactSuccess}</div>}
            {contactError && <div className="alert alert-error" style={{ marginBottom: 0 }}>{contactError}</div>}

            <input
              className="input"
              type="email"
              placeholder="Your Email Address"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="text"
              placeholder="Phone or Contact Number (optional)"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
            <textarea
              className="textarea"
              rows={3}
              placeholder="Write your message or description..."
              value={contactDesc}
              onChange={(e) => setContactDesc(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={contactSending}
              style={{ borderRadius: 999, width: "fit-content", padding: "10px 24px" }}
            >
              {contactSending ? "Sending..." : "Send Message →"}
            </button>
          </form>
        </div>
      </section>

      {/* Full Footer with Terms of Service & Privacy Policy */}
      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div style={{ display: "grid", gap: 8 }}>
            <TZLogo size={32} showText lightText />
            <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.72)", maxWidth: 300 }}>
              Connect. Chat. Share. A modern social networking and real-time messaging platform.
            </p>
          </div>

          <div className="landing-footer-col">
            <strong>Navigation</strong>
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>

          <div className="landing-footer-col">
            <strong>Legal</strong>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>

          <div className="landing-footer-col">
            <strong>Account</strong>
            <Link to="/register">Create Account</Link>
            <Link to="/login">Sign In</Link>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} TZChat. All rights reserved.</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
