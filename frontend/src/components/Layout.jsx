import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import UserAvatar from "./UserAvatar";

export default function Layout() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadBadges() {
      try {
        const [nData, cData] = await Promise.all([
          apiRequest("/api/notifications/unread-count/"),
          apiRequest("/api/messaging/conversations/"),
        ]);
        setUnreadNotifs(nData?.unread_count || 0);
        const msgTotal = Array.isArray(cData)
          ? cData.reduce((sum, c) => sum + (c.unread_count || 0), 0)
          : 0;
        setUnreadMsgs(msgTotal);
      } catch {
        // Ignore transient badge errors
      }
    }
    loadBadges();
    window.addEventListener("user-notif-updated", loadBadges);
    return () => window.removeEventListener("user-notif-updated", loadBadges);
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/explore?q=${encodeURIComponent(search.trim())}`);
    }
  }

  async function handleLogout() {
    await logout();
    showToast("You have logged out.");
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/home" className="topbar-brand">
          <span className="topbar-brand-icon">💬</span>
          <span>TZChat</span>
        </NavLink>

        <form className="topbar-search" onSubmit={handleSearchSubmit}>
          <input
            className="input"
            type="search"
            placeholder="Search people, posts, or groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: 999, background: "#f8fafc" }}
          />
        </form>

        <div className="topbar-actions" style={{ position: "relative" }}>
          <NavLink
            to="/notifications"
            className="btn btn-ghost btn-sm"
            aria-label="Notifications"
            style={{ borderRadius: 999, background: "#f1f5f9" }}
          >
            🔔 {unreadNotifs > 0 && <span className="badge-count">{unreadNotifs}</span>}
          </NavLink>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((v) => !v)}
            title={user?.full_name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text)",
              background: "#f1f5f9",
              padding: "4px 12px 4px 4px",
              borderRadius: 999,
              border: "1px solid var(--border)",
            }}
          >
            <UserAvatar src={user?.profile_picture_url} name={user?.full_name || user?.username} size={34} />
            <div style={{ lineHeight: 1.2, textAlign: "left" }} className="hide-mobile">
              <div style={{ fontSize: "0.86rem", fontWeight: 700 }}>{user?.full_name}</div>
              <div style={{ fontSize: "0.74rem", color: "var(--muted)" }}>@{user?.username}</div>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>▾</span>
          </button>

          {profileMenuOpen && (
            <div
              className="card"
              style={{
                position: "absolute",
                top: 48,
                right: 0,
                width: 190,
                padding: 8,
                zIndex: 60,
                display: "grid",
                gap: 4,
              }}
              onMouseLeave={() => setProfileMenuOpen(false)}
            >
              <NavLink to="/profile" className="nav-item" onClick={() => setProfileMenuOpen(false)}>
                👤 Profile
              </NavLink>
              <NavLink to="/settings" className="nav-item" onClick={() => setProfileMenuOpen(false)}>
                ⚙️ Settings
              </NavLink>
              <button
                type="button"
                className="nav-item"
                style={{ background: "none", border: "none", textAlign: "left", color: "var(--danger)" }}
                onClick={() => {
                  setProfileMenuOpen(false);
                  handleLogout();
                }}
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="shell-body">
        <aside className="sidebar">
          <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span>🏠 Home</span>
          </NavLink>
          <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span>🔍 Explore</span>
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span>💬 Messages</span>
            {unreadMsgs > 0 && <span className="badge-count">{unreadMsgs}</span>}
          </NavLink>
          <NavLink to="/groups" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span>👥 Groups</span>
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span>🔔 Notifications</span>
            {unreadNotifs > 0 && <span className="badge-count">{unreadNotifs}</span>}
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span>👤 Profile</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span>⚙️ Settings</span>
          </NavLink>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }} />
          <button type="button" className="btn btn-ghost" onClick={handleLogout} style={{ justifyContent: "flex-start" }}>
            🚪 Logout
          </button>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        <NavLink to="/home"><span>🏠</span><span>Home</span></NavLink>
        <NavLink to="/explore"><span>🔍</span><span>Explore</span></NavLink>
        <NavLink to="/messages">
          <span>💬</span>
          <span>Messages</span>
          {unreadMsgs > 0 && <span className="bottom-nav-dot">{unreadMsgs}</span>}
        </NavLink>
        <NavLink to="/groups"><span>👥</span><span>Groups</span></NavLink>
        <NavLink to="/profile"><span>👤</span><span>Profile</span></NavLink>
      </nav>
    </div>
  );
}
