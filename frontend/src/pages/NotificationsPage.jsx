import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

const ICONS = {
  like: "❤️",
  comment: "💬",
  follow: "👤",
  friend_request: "🤝",
  friend_accept: "✅",
  message: "✉️",
  message_request: "📩",
  group_invite: "👥",
  group_update: "🔔",
};

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/notifications/");
      setItems(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markRead(id) {
    try {
      await apiRequest(`/api/notifications/${id}/read/`, { method: "POST" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      window.dispatchEvent(new Event("user-notif-updated"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function markAllRead() {
    try {
      await apiRequest("/api/notifications/read-all/", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new Event("user-notif-updated"));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Notifications</h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>
          Mark all as read
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading notifications...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>You have no notifications yet.</p>
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
                background: n.is_read ? "#fff" : "var(--primary-light)",
                border: "1px solid var(--border)",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.2rem" }}>{ICONS[n.notification_type] || "🔔"}</span>
                <div>
                  <div style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.message}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              {!n.is_read && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
