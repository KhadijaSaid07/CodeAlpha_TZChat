import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import UserAvatar from "../../components/UserAvatar";

const CATEGORY_BADGES = {
  account: "pill pill-blue",
  social: "pill pill-green",
  messaging: "pill pill-purple",
  group: "pill pill-amber",
  security: "pill pill-red",
};

export default function AdminUserActivitiesPage() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadActivities(pageNum = page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", pageNum);
      params.set("sort", sort);
      if (category) params.set("category", category);
      if (period) params.set("period", period);
      if (search.trim()) params.set("q", search.trim());
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const data = await apiRequest(`/api/admin-api/user-activities/?${params.toString()}`);
      setItems(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities(1);
  }, [category, period, sort]);

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div>
        <h2>⚡ All User Activities</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          Platform-wide user actions recorded automatically in PostgreSQL (separate from Admin Audit Logs)
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          className="input"
          style={{ width: 210 }}
          type="search"
          placeholder="Search user or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" style={{ width: "auto" }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="account">Account</option>
          <option value="social">Social</option>
          <option value="messaging">Messaging</option>
          <option value="group">Group</option>
          <option value="security">Security</option>
        </select>
        <select className="input" style={{ width: "auto" }} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">All Time</option>
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
        <input className="input" style={{ width: "auto" }} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input className="input" style={{ width: "auto" }} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => loadActivities(1)}>
          Apply
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {selected && (
        <div className="card" style={{ background: "var(--bg)", display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Activity #{selected.id} Details</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div>User: <strong>{selected.full_name}</strong> (@{selected.username})</div>
          <div>Category: <span className={CATEGORY_BADGES[selected.category] || "pill pill-blue"}>{selected.category}</span> · Type: <code>{selected.activity_type}</code></div>
          <div>Description: {selected.description}</div>
          <div>Related: {selected.related_object_type || "-"} #{selected.related_object_id || "-"}</div>
          <div>Timestamp: {new Date(selected.created_at).toLocaleString()}</div>
        </div>
      )}

      {loading ? (
        <p>Loading user activities...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No user activities match your filter.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f8fafc", borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "10px 12px" }}>User</th>
                <th style={{ padding: "10px 12px" }}>Category</th>
                <th style={{ padding: "10px 12px" }}>Description</th>
                <th style={{ padding: "10px 12px" }}>Date &amp; Time</th>
                <th style={{ padding: "10px 12px" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <UserAvatar src={a.profile_picture_url} name={a.full_name} size={30} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.full_name}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>@{a.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={CATEGORY_BADGES[a.category] || "pill pill-blue"}>{a.category}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{a.description}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--muted)" }}>
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(a)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Total records: {count}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadActivities(p); }}>
            Previous
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={items.length < 20} onClick={() => { const p = page + 1; setPage(p); loadActivities(p); }}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
