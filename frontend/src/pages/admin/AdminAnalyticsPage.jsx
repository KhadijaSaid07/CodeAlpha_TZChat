import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";

const COUNTRY_COLORS = ["#2563eb", "#10b981", "#7c3aed", "#f59e0b", "#ec4899"];

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const s = await apiRequest("/api/admin-api/stats/");
        setStats(s);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  if (error) return <div className="card alert alert-error">{error}</div>;
  if (!stats) return <div className="card">Loading analytics...</div>;

  const activeUsers = Math.max(0, stats.total_users - stats.suspended_users);
  const activePct = stats.total_users ? Math.round((activeUsers / stats.total_users) * 100) : 100;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const activeOffset = circumference - (activePct / 100) * circumference;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <h2>📈 Reports &amp; Analytics</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Live platform insights from PostgreSQL</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {/* SVG Donut Ring Chart */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r={radius} fill="none" stroke="#fee2e2" strokeWidth="14" />
            <circle
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke="#16a34a"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={activeOffset}
              strokeLinecap="round"
              transform="rotate(-90 65 65)"
            />
            <text x="65" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0f172a">
              {activePct}%
            </text>
            <text x="65" y="81" textAnchor="middle" fontSize="10" fill="#64748b">
              Active Users
            </text>
          </svg>
          <div style={{ display: "grid", gap: 6, fontSize: "0.9rem" }}>
            <div><span style={{ color: "#16a34a", fontWeight: 700 }}>● Active:</span> {activeUsers}</div>
            <div><span style={{ color: "#dc2626", fontWeight: 700 }}>● Suspended:</span> {stats.suspended_users}</div>
            <div><span style={{ color: "#2563eb", fontWeight: 700 }}>● Total:</span> {stats.total_users}</div>
          </div>
        </div>

        {/* Top Countries Colored Bars */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Top Countries</h3>
          {(stats.top_countries || []).length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No country data yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {stats.top_countries.map((c, idx) => {
                const pct = stats.total_users ? Math.round((c.count / stats.total_users) * 100) : 0;
                const barColor = COUNTRY_COLORS[idx % COUNTRY_COLORS.length];
                return (
                  <div key={c.country}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", marginBottom: 3, fontWeight: 600 }}>
                      <span>{c.country}</span>
                      <span>{pct}% ({c.count})</span>
                    </div>
                    <div style={{ height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(4, pct)}%`, height: "100%", background: barColor, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content & Moderation Summary */}
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <h3>Content &amp; Moderation</h3>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 10, borderRadius: 10, background: "#eff6ff" }}>
            <span style={{ fontWeight: 600, color: "#1d4ed8" }}>📝 Active Posts</span>
            <strong>{stats.total_posts}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 10, borderRadius: 10, background: "#ecfdf5" }}>
            <span style={{ fontWeight: 600, color: "#15803d" }}>💬 Messages Sent</span>
            <strong>{stats.total_messages ?? 0}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 10, borderRadius: 10, background: "#f5f3ff" }}>
            <span style={{ fontWeight: 600, color: "#6d28d9" }}>🌐 Groups</span>
            <strong>{stats.total_groups}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 10, borderRadius: 10, background: "#fef2f2" }}>
            <span style={{ fontWeight: 600, color: "#b91c1c" }}>🚩 Pending Reports</span>
            <strong>{stats.pending_reports}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
