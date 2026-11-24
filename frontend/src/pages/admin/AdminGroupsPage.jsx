import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function AdminGroupsPage() {
  const { showToast, askConfirm } = useToast();
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [error, setError] = useState("");

  async function loadGroups() {
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const data = await apiRequest(`/api/admin-api/groups/${qs}`);
      setGroups(data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function handleViewGroup(groupId) {
    try {
      const detail = await apiRequest(`/api/admin-api/groups/${groupId}/`);
      setSelectedDetail(detail);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeleteGroup(group) {
    const ok = await askConfirm(`Delete group "${group.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/admin-api/groups/${group.id}/`, { method: "DELETE" });
      showToast(`Group "${group.name}" deleted.`);
      setSelectedDetail(null);
      loadGroups();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2>🌐 Group Management</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" style={{ width: 200 }} placeholder="Search groups..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" className="btn btn-outline btn-sm" onClick={loadGroups}>Search</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {selectedDetail && (
        <div className="card" style={{ background: "var(--bg)", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>{selectedDetail.group.name}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedDetail(null)}>✕</button>
          </div>
          <div>Creator: @{selectedDetail.group.creator?.username || "Unknown"} · Members: {selectedDetail.members?.length || 0}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(selectedDetail.members || []).map((m) => (
              <span key={m.id} className="pill pill-blue">@{m.user?.username} ({m.role})</span>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No groups found.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {groups.map((g) => (
            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, border: "1px solid var(--border)", borderRadius: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong>{g.name}</strong>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  Owner: @{g.creator?.username || "-"} · {g.members_count} members · {new Date(g.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleViewGroup(g.id)}>View Members</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteGroup(g)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
