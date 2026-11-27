import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useToast } from "../context/ToastContext";

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
  const { showToast, askConfirm } = useToast();
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/notifications/");
      setItems(data.results || []);
      setSelectedIds([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((n) => n.id));
    }
  }

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
      showToast("All notifications marked as read.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearOne(id) {
    try {
      await apiRequest(`/api/notifications/${id}/`, { method: "DELETE" });
      setItems((prev) => prev.filter((n) => n.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      window.dispatchEvent(new Event("user-notif-updated"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearSelected() {
    if (selectedIds.length === 0) return;
    try {
      await apiRequest("/api/notifications/clear/", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      });
      const removed = new Set(selectedIds);
      setItems((prev) => prev.filter((n) => !removed.has(n.id)));
      setSelectedIds([]);
      window.dispatchEvent(new Event("user-notif-updated"));
      showToast(`Cleared ${removed.size} notification${removed.size > 1 ? "s" : ""}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearAll() {
    const ok = await askConfirm("Clear all notifications?");
    if (!ok) return;
    try {
      await apiRequest("/api/notifications/clear/", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setItems([]);
      setSelectedIds([]);
      window.dispatchEvent(new Event("user-notif-updated"));
      showToast("All notifications cleared.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Notifications</h2>
        {items.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>
              Mark all read
            </button>
            {selectedIds.length > 0 && (
              <button type="button" className="btn btn-danger btn-sm" onClick={clearSelected}>
                Clear selected ({selectedIds.length})
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading notifications...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>You have no notifications yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", color: "var(--muted)", paddingLeft: 4, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selectedIds.length === items.length && items.length > 0}
              onChange={toggleSelectAll}
              style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
            />
            <span>Select all ({items.length})</span>
          </label>

          {items.map((n) => {
            const checked = selectedIds.includes(n.id);
            return (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: 12,
                  borderRadius: 10,
                  background: n.is_read ? "#fff" : "var(--primary-light)",
                  border: checked ? "1px solid var(--primary)" : "1px solid var(--border)",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(n.id)}
                    style={{ width: 16, height: 16, accentColor: "var(--primary)", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{ICONS[n.notification_type] || "🔔"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: n.is_read ? 400 : 600, overflowWrap: "anywhere" }}>{n.message}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {!n.is_read && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--danger)" }}
                    title="Clear notification"
                    onClick={() => clearOne(n.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
