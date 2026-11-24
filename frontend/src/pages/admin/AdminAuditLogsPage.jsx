import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";

function getActionBadge(action) {
  if (action.includes("delete") || action.includes("suspend")) return "pill pill-red";
  if (action.includes("login") || action.includes("reactivate")) return "pill pill-green";
  if (action.includes("report") || action.includes("moderate")) return "pill pill-amber";
  if (action.includes("permission") || action.includes("settings")) return "pill pill-purple";
  return "pill pill-blue";
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest("/api/admin-api/audit-logs/");
        setLogs(data.results || []);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  const filtered = logs.filter((l) => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (search.trim()) {
      const text = `${l.actor_username || ""} ${l.action} ${l.target_type} ${l.ip_address || ""}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2>🛡️ Audit Logs</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            Immutable security &amp; moderation trail (Super Admin only)
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ width: 200 }}
            type="search"
            placeholder="Filter by user or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" style={{ width: "auto" }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {filtered.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No audit log entries match your filter.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f8fafc", borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "10px 12px" }}>Date &amp; Time</th>
                <th style={{ padding: "10px 12px" }}>Actor</th>
                <th style={{ padding: "10px 12px" }}>Action</th>
                <th style={{ padding: "10px 12px" }}>Target</th>
                <th style={{ padding: "10px 12px" }}>Result</th>
                <th style={{ padding: "10px 12px" }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, idx) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--muted)" }}>
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                    @{l.actor_username || "system"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={getActionBadge(l.action)}>{l.action.replaceAll("_", " ")}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {l.target_type} {l.target_id ? `#${l.target_id}` : ""}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={l.result === "success" ? "pill pill-green" : "pill pill-red"}>
                      {l.result}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.82rem" }}>
                    {l.ip_address || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
