import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  BellIcon,
  CompassIcon,
  HomeIcon,
  LogoutIcon,
  MessageIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from "./NavIcons";
import TZLogo from "./TZLogo";
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
      {/* Clean, Handcrafted Top Navbar */}
      <header className="topbar">
        <NavLink to="/home" className="topbar-brand">
          <TZLogo size={34} showText lightText />
        </NavLink>

        <form className="topbar-search" onSubmit={handleSearchSubmit}>
          <div className="topbar-search-wrap">
            <SearchIcon style={{ color: "var(--muted)", flexShrink: 0 }} />
            <input
              type="search"
              placeholder="Search people, posts, or groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </form>

        <div className="topbar-actions" style={{ position: "relative" }}>
          <NavLink
            to="/messages"
            className={({ isActive }) => `topbar-icon-btn hide-mobile ${isActive ? "active" : ""}`}
            aria-label="Messages"
            title="Messages"
          >
            <MessageIcon />
            {unreadMsgs > 0 && <span className="topbar-icon-badge">{unreadMsgs}</span>}
          </NavLink>

          <NavLink
            to="/notifications"
            className={({ isActive }) => `topbar-icon-btn ${isActive ? "active" : ""}`}
            aria-label="Notifications"
            title="Notifications"
          >
            <BellIcon />
            {unreadNotifs > 0 && <span className="topbar-icon-badge">{unreadNotifs}</span>}
          </NavLink>

          <button
            type="button"
            className="topbar-profile-pill"
            onClick={() => setProfileMenuOpen((v) => !v)}
            title={user?.full_name}
          >
            <UserAvatar src={user?.profile_picture_url} name={user?.full_name || user?.username} size={32} />
            <div style={{ lineHeight: 1.2, textAlign: "left" }} className="hide-mobile">
              <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>{user?.full_name}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>@{user?.username}</div>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>▾</span>
          </button>

          {profileMenuOpen && (
            <div
              className="card"
              style={{
                position: "absolute",
                top: 50,
                right: 0,
                width: 200,
                padding: 8,
                zIndex: 60,
                display: "grid",
                gap: 4,
                boxShadow: "var(--shadow-lg)",
              }}
              onMouseLeave={() => setProfileMenuOpen(false)}
            >
              <NavLink to="/profile" className="nav-item" onClick={() => setProfileMenuOpen(false)}>
                <span className="nav-item-label"><UserIcon /> Profile</span>
              </NavLink>
              <NavLink to="/settings" className="nav-item" onClick={() => setProfileMenuOpen(false)}>
                <span className="nav-item-label"><SettingsIcon /> Settings</span>
              </NavLink>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />
              <button
                type="button"
                className="nav-item"
                style={{ background: "none", border: "none", textAlign: "left", color: "var(--danger)", width: "100%" }}
                onClick={() => {
                  setProfileMenuOpen(false);
                  handleLogout();
                }}
              >
                <span className="nav-item-label"><LogoutIcon /> Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="shell-body">
        {/* Editorial Left Sidebar */}
        <aside className="sidebar">
          <Link to="/profile" className="sidebar-profile-card">
            <UserAvatar src={user?.profile_picture_url} name={user?.full_name || user?.username} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.full_name}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                @{user?.username}
              </div>
            </div>
          </Link>

          <div className="sidebar-section-label">Menu</div>

          <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-item-label"><HomeIcon /> Home</span>
          </NavLink>
          <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-item-label"><CompassIcon /> Explore</span>
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-item-label"><MessageIcon /> Messages</span>
            {unreadMsgs > 0 && <span className="badge-count">{unreadMsgs}</span>}
          </NavLink>
          <NavLink to="/groups" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-item-label"><UsersIcon /> Groups</span>
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-item-label"><BellIcon /> Notifications</span>
            {unreadNotifs > 0 && <span className="badge-count">{unreadNotifs}</span>}
          </NavLink>

          <div className="sidebar-section-label" style={{ marginTop: 10 }}>Account</div>

          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-item-label"><UserIcon /> Profile</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-item-label"><SettingsIcon /> Settings</span>
          </NavLink>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0 6px" }} />
          <button
            type="button"
            className="nav-item"
            onClick={handleLogout}
            style={{ background: "none", border: "none", width: "100%", color: "var(--danger)" }}
          >
            <span className="nav-item-label"><LogoutIcon /> Sign out</span>
          </button>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>

      {/* Native-App Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <NavLink to="/home"><HomeIcon /><span>Home</span></NavLink>
        <NavLink to="/explore"><CompassIcon /><span>Explore</span></NavLink>
        <NavLink to="/messages">
          <MessageIcon />
          <span>Messages</span>
          {unreadMsgs > 0 && <span className="bottom-nav-dot">{unreadMsgs}</span>}
        </NavLink>
        <NavLink to="/groups"><UsersIcon /><span>Groups</span></NavLink>
        <NavLink to="/profile"><UserIcon /><span>Profile</span></NavLink>
      </nav>
    </div>
  );
}
