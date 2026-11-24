import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function AdminNotificationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/admin-api/notifications/");
      setItems(data.results || []);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(n) {
    await apiRequest(`/api/admin-api/notifications/${n.id}/read/`, { method: "POST" });
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    window.dispatchEvent(new Event("admin-notif-updated"));
    if (n.related_path) navigate(n.related_path);
  }

  async function markAll() {
    await apiRequest("/api/admin-api/notifications/read-all/", { method: "POST" });
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    window.dispatchEvent(new Event("admin-notif-updated"));
    showToast("All admin notifications marked as read.");
  }

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>🔔 Admin Notifications</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={markAll}>
          Mark all as read
        </button>
      </div>

      {loading ? (
        <p>Loading notifications...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No admin notifications yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                background: n.is_read ? "#fff" : "#eff6ff",
                border: "1px solid var(--border)",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.message}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => markRead(n)}>
                {n.related_path ? "Open" : "Mark read"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
