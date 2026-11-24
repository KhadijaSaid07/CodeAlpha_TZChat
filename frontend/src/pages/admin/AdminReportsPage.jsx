import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, getAccessToken } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function AdminReportsPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [category, setCategory] = useState("");
  const [repStatus, setRepStatus] = useState(searchParams.get("status") || "");
  const [period, setPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function loadReports() {
    setError("");
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (repStatus) params.set("status", repStatus);
      if (period) params.set("period", period);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (search.trim()) params.set("q", search.trim());
      const data = await apiRequest(`/api/admin-api/reports/?${params.toString()}`);
      setReports(data.results || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setRepStatus(searchParams.get("status") || "");
  }, [searchParams]);

  useEffect(() => {
    loadReports();
  }, [category, repStatus, period]);

  async function handleDecision(id, statusVal, removePost = false) {
    try {
      await apiRequest(`/api/admin-api/reports/${id}/decision/`, {
        method: "POST",
        body: JSON.stringify({ status: statusVal, resolution_note: `Marked ${statusVal}`, remove_post: removePost }),
      });
      showToast(`Report #${id} marked as ${statusVal}.`);
      loadReports();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDownloadPdf() {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (repStatus) params.set("status", repStatus);
      if (period) params.set("period", period);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const res = await fetch(`/api/admin-api/reports/export-pdf/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to export PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tzchat_reports.pdf";
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF report downloaded!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2>🚩 Reports Management</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadPdf}>
          📄 Export PDF Report
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input className="input" style={{ width: 180 }} placeholder="Search reason/user..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="user">Users</option>
          <option value="post">Posts</option>
          <option value="comment">Comments</option>
          <option value="message">Messages</option>
          <option value="group">Groups</option>
        </select>
        <select className="input" style={{ width: "auto" }} value={repStatus} onChange={(e) => setRepStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
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
        <button type="button" className="btn btn-outline btn-sm" onClick={loadReports}>Filter</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {reports.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No reports match this filter.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {reports.map((r) => (
            <div key={r.id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong>#{r.id} [{r.category.toUpperCase()}] · {r.reason}</strong>{" "}
                <span className="pill pill-amber">{r.status}</span>
                <div style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                  By @{r.reporter_username} · Target: {r.reported_username ? `@${r.reported_username}` : `${r.category}#${r.reported_post || r.reported_group || r.id}`} · {new Date(r.created_at).toLocaleString()}
                </div>
                {r.description && <p style={{ marginTop: 4 }}>{r.description}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDecision(r.id, "under_review", false)}>Review</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDecision(r.id, "resolved", Boolean(r.reported_post))}>Resolve</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDecision(r.id, "rejected", false)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
