import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function AdminMessagesPage() {
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await apiRequest("/api/admin-api/reports/?category=message");
      setReports(data.results || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecision(id, statusVal) {
    try {
      await apiRequest(`/api/admin-api/reports/${id}/decision/`, {
        method: "POST",
        body: JSON.stringify({ status: statusVal, resolution_note: `Message report ${statusVal}` }),
      });
      showToast(`Message report #${id} ${statusVal}.`);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <h2>💬 Messaging Management (Reported Messages Only)</h2>
      <div className="alert alert-success">
        <strong>Privacy Guardrail:</strong> Administrators cannot browse private conversations. Only user-submitted messaging reports and evidence are visible here.
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {reports.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No message-related reports found.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {reports.map((r) => (
            <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong>Report #{r.id}: {r.reason}</strong>{" "}
                <span className="pill pill-amber">{r.status}</span>
                <div style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                  Reporter: @{r.reporter_username} · Reported User: @{r.reported_username || "N/A"} · {new Date(r.created_at).toLocaleString()}
                </div>
                {r.evidence_summary && <p style={{ marginTop: 4 }}><strong>Evidence:</strong> {r.evidence_summary}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDecision(r.id, "resolved")}>Resolve</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDecision(r.id, "rejected")}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
