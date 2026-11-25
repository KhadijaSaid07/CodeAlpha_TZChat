import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [s, a] = await Promise.all([
          apiRequest("/api/admin-api/stats/"),
          apiRequest("/api/admin-api/analytics/?period=month"),
        ]);
        setStats(s);
        setAnalytics(a);
        if (user?.role === "super_admin" || user?.admin_permissions?.can_view_audit_logs) {
          const l = await apiRequest("/api/admin-api/audit-logs/");
          setLogs((l.results || []).slice(0, 5));
        }
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [user?.role]);

  const kpis = stats
    ? [
        { label: "Total Users", value: stats.total_users, color: "#2563eb", bg: "#dbeafe", icon: "👥" },
        { label: "Active Users", value: stats.active_users, color: "#16a34a", bg: "#dcfce7", icon: "✅" },
        { label: "Suspended Users", value: stats.suspended_users, color: "#dc2626", bg: "#fee2e2", icon: "⛔" },
        { label: "Total Posts", value: stats.total_posts, color: "#d97706", bg: "#fef3c7", icon: "📝" },
        { label: "Total Comments", value: stats.total_comments, color: "#0284c7", bg: "#e0f2fe", icon: "💬" },
        { label: "Total Likes", value: stats.total_likes, color: "#db2777", bg: "#fce7f3", icon: "❤️" },
        { label: "Total Groups", value: stats.total_groups, color: "#7c3aed", bg: "#ede9fe", icon: "🌐" },
        { label: "Total Followers", value: stats.total_followers, color: "#0d9488", bg: "#ccfbf1", icon: "🤝" },
        { label: "Pending Reports", value: stats.pending_reports, color: "#b91c1c", bg: "#fee2e2", icon: "🚩" },
        { label: "Administrators", value: stats.total_admins, color: "#4f46e5", bg: "#e0e7ff", icon: "🛡️" },
      ]
    : [];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2>Admin Dashboard Overview</h2>
          <p style={{ color: "var(--muted)" }}>Real-time platform metrics from PostgreSQL</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/admin/users" className="btn btn-outline btn-sm">View Users</Link>
          <Link to="/admin/posts" className="btn btn-outline btn-sm">View Posts</Link>
          <Link to="/admin/reports?status=pending" className="btn btn-primary btn-sm">Pending Reports</Link>
          <Link to="/admin/user-activities" className="btn btn-outline btn-sm">User Activities</Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ borderTop: `4px solid ${k.color}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: k.bg, color: k.color, display: "grid", placeItems: "center", fontSize: "1.2rem" }}>
              {k.icon}
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{k.value}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Recent User Activities</h3>
          {(stats?.recent_user_activities || []).length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No user activities recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {stats.recent_user_activities.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border)", fontSize: "0.86rem", gap: 8 }}>
                  <span>{a.description}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3>Recent Audit Logs</h3>
            <Link to="/admin/audit-logs" style={{ fontSize: "0.85rem" }}>View all →</Link>
          </div>
          {logs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No audit logs recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {logs.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border)", fontSize: "0.86rem", gap: 8 }}>
                  <span><strong>@{l.actor_username || "system"}</strong> · {l.action.replaceAll("_", " ")}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {analytics && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>User &amp; Content Growth (Database Trends)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div>
              <strong style={{ fontSize: "0.85rem", color: "#2563eb" }}>User Registrations</strong>
              {(analytics.user_growth || []).map((row) => (
                <div key={row.date} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", padding: "4px 0" }}>
                  <span>{row.date}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
            <div>
              <strong style={{ fontSize: "0.85rem", color: "#d97706" }}>Posts Created</strong>
              {(analytics.post_trends || []).map((row) => (
                <div key={row.date} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", padding: "4px 0" }}>
                  <span>{row.date}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
            <div>
              <strong style={{ fontSize: "0.85rem", color: "#7c3aed" }}>Groups Created</strong>
              {(analytics.group_trends || []).map((row) => (
                <div key={row.date} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", padding: "4px 0" }}>
                  <span>{row.date}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
