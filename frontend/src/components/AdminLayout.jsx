import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, clearAuthTokens, getRefreshToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import TZLogo from "./TZLogo";
import UserAvatar from "./UserAvatar";

const PAGE_TITLES = {
  "/admin/dashboard": "Dashboard Overview",
  "/admin/users": "User Management",
  "/admin/posts": "Post Management",
  "/admin/messages": "Messaging Management",
  "/admin/groups": "Group Management",
  "/admin/reports": "Reports Management",
  "/admin/user-activities": "All User Activities",
  "/admin/audit-logs": "Audit Logs",
  "/admin/analytics": "Analytics & Reports",
  "/admin/settings": "Admin Settings",
  "/admin/notifications": "Admin Notifications",
};

export default function AdminLayout() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [search, setSearch] = useState("");
  const [openMenus, setOpenMenus] = useState({ users: false, posts: false, reports: false });

  const isSuper = user?.role === "super_admin";
  const perms = user?.admin_permissions || {};
  const can = (key) => isSuper || Boolean(perms[key]);

  useEffect(() => {
    async function loadNotifCount() {
      try {
        const res = await apiRequest("/api/admin-api/notifications/unread-count/");
        setUnreadNotifs(res?.unread_count || 0);
      } catch {
        // Ignore transient badge error
      }
    }
    loadNotifCount();
    window.addEventListener("admin-notif-updated", loadNotifCount);
    return () => window.removeEventListener("admin-notif-updated", loadNotifCount);
  }, [location.pathname]);

  async function handleAdminLogout() {
    const currentRefresh = getRefreshToken();
    try {
      await apiRequest("/api/admin-api/logout/", {
        method: "POST",
        body: JSON.stringify(currentRefresh ? { refresh: currentRefresh } : {}),
      });
    } catch {
      // Ignore
    } finally {
      clearAuthTokens();
      setUser(null);
      showToast("Admin logged out.");
      navigate("/login");
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/admin/users?q=${encodeURIComponent(search.trim())}`);
    }
  }

  const pageTitle = PAGE_TITLES[location.pathname] || "Admin Control Center";

  return (
    <div className="admin-shell">
      {/* Top Navigation Bar */}
      <header className="admin-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.innerWidth <= 768) {
                setMobileOpen((v) => !v);
              } else {
                setCollapsed((v) => !v);
              }
            }}
            aria-label="Toggle sidebar"
            style={{ fontSize: "1.15rem" }}
          >
            ☰
          </button>

          <Link to="/admin/dashboard" className="topbar-brand">
            <TZLogo size={34} showText subtitle="Admin" lightText />
          </Link>

          <div className="hide-mobile" style={{ borderLeft: "1px solid rgba(255,255,255,0.16)", paddingLeft: 12 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#ffffff", lineHeight: 1.2 }}>
              {pageTitle}
            </div>
            <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.68)" }}>
              Admin / {pageTitle}
            </div>
          </div>
        </div>

        <form className="topbar-search" onSubmit={handleSearch}>
          <input
            className="input"
            type="search"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: 999, background: "#f8fafc" }}
          />
        </form>

        <div className="topbar-actions" style={{ position: "relative" }}>
          <NavLink
            to="/admin/notifications"
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: 999, background: "#f1f5f9" }}
            aria-label="Admin notifications"
          >
            🔔 {unreadNotifs > 0 && <span className="badge-count">{unreadNotifs}</span>}
          </NavLink>

          <button
            type="button"
            onClick={() => setProfileMenuOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "4px 12px 4px 4px",
            }}
          >
            <UserAvatar src={user?.profile_picture_url} name={user?.full_name || "Admin"} size={34} />
            <div style={{ textAlign: "left", lineHeight: 1.15 }} className="hide-mobile">
              <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>{user?.full_name}</div>
              <div style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: 600 }}>
                {isSuper ? "Super Admin" : "Admin"}
              </div>
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
                width: 210,
                padding: 8,
                zIndex: 60,
                display: "grid",
                gap: 4,
              }}
              onMouseLeave={() => setProfileMenuOpen(false)}
            >
              <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", fontSize: "0.8rem" }}>
                <strong>{user?.full_name}</strong>
                <div style={{ color: "var(--muted)" }}>{isSuper ? "Super Administrator" : "Administrator"}</div>
              </div>
              <Link to="/admin/settings?tab=profile" className="nav-item" onClick={() => setProfileMenuOpen(false)}>View Profile</Link>
              <Link to="/admin/settings?tab=profile" className="nav-item" onClick={() => setProfileMenuOpen(false)}>Edit Profile</Link>
              <Link to="/admin/settings?tab=security" className="nav-item" onClick={() => setProfileMenuOpen(false)}>Security Settings</Link>
              <button type="button" className="nav-item" style={{ background: "none", border: "none", textAlign: "left", color: "var(--danger)" }} onClick={handleAdminLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={`shell-body admin-shell-body ${collapsed ? "admin-collapsed" : ""}`}>
        {/* Collapsible Left Sidebar (distinct executive slate theme) */}
        <aside className={`admin-sidebar ${mobileOpen ? "admin-sidebar-mobile-open" : ""}`}>
          <div style={{ padding: "4px 8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <TZLogo size={30} showText={!collapsed} subtitle={!collapsed ? "Control Panel" : ""} lightText />
          </div>

          <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
            <span>📊</span>{!collapsed && <span>Dashboard</span>}
          </NavLink>

          {can("can_manage_users") && (
            <div>
              <button
                type="button"
                className="admin-nav-item"
                style={{ width: "100%", background: "none", border: "none", justifyContent: "space-between" }}
                onClick={() => setOpenMenus((m) => ({ ...m, users: !m.users }))}
              >
                <span style={{ display: "flex", gap: 10 }}><span>👥</span>{!collapsed && <span>Users</span>}</span>
                {!collapsed && <span>{openMenus.users ? "▾" : "▸"}</span>}
              </button>
              {!collapsed && openMenus.users && (
                <div style={{ paddingLeft: 26, display: "grid", gap: 2 }}>
                  <Link to="/admin/users" className="admin-nav-item" onClick={() => setMobileOpen(false)}>All Users</Link>
                  <Link to="/admin/users?status=active" className="admin-nav-item" onClick={() => setMobileOpen(false)}>Active Users</Link>
                  <Link to="/admin/users?status=suspended" className="admin-nav-item" onClick={() => setMobileOpen(false)}>Suspended Users</Link>
                  {isSuper && <Link to="/admin/users?status=admins" className="admin-nav-item" onClick={() => setMobileOpen(false)}>Administrators</Link>}
                </div>
              )}
            </div>
          )}

          {can("can_moderate_posts") && (
            <div>
              <button
                type="button"
                className="admin-nav-item"
                style={{ width: "100%", background: "none", border: "none", justifyContent: "space-between" }}
                onClick={() => setOpenMenus((m) => ({ ...m, posts: !m.posts }))}
              >
                <span style={{ display: "flex", gap: 10 }}><span>📝</span>{!collapsed && <span>Posts</span>}</span>
                {!collapsed && <span>{openMenus.posts ? "▾" : "▸"}</span>}
              </button>
              {!collapsed && openMenus.posts && (
                <div style={{ paddingLeft: 26, display: "grid", gap: 2 }}>
                  <Link to="/admin/posts" className="admin-nav-item" onClick={() => setMobileOpen(false)}>All Posts</Link>
                  <Link to="/admin/posts?post_type=text" className="admin-nav-item" onClick={() => setMobileOpen(false)}>Text Posts</Link>
                  <Link to="/admin/posts?post_type=image" className="admin-nav-item" onClick={() => setMobileOpen(false)}>Image Posts</Link>
                  <Link to="/admin/posts?post_type=video" className="admin-nav-item" onClick={() => setMobileOpen(false)}>Video Posts</Link>
                  <Link to="/admin/posts?status=removed" className="admin-nav-item" onClick={() => setMobileOpen(false)}>Removed Posts</Link>
                </div>
              )}
            </div>
          )}

          {can("can_view_reports") && (
            <NavLink to="/admin/messages" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <span>💬</span>{!collapsed && <span>Messaging Reports</span>}
            </NavLink>
          )}

          {can("can_manage_groups") && (
            <NavLink to="/admin/groups" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <span>🌐</span>{!collapsed && <span>Groups</span>}
            </NavLink>
          )}

          {can("can_view_reports") && (
            <NavLink to="/admin/reports" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <span>🚩</span>{!collapsed && <span>Reports</span>}
            </NavLink>
          )}

          {can("can_view_activities") && (
            <NavLink to="/admin/user-activities" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <span>⚡</span>{!collapsed && <span>All User Activities</span>}
            </NavLink>
          )}

          {can("can_view_audit_logs") && (
            <NavLink to="/admin/audit-logs" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <span>🛡️</span>{!collapsed && <span>Audit Logs</span>}
            </NavLink>
          )}

          {can("can_view_stats") && (
            <NavLink to="/admin/analytics" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <span>📈</span>{!collapsed && <span>Analytics</span>}
            </NavLink>
          )}

          <NavLink to="/admin/settings" className={({ isActive }) => `admin-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
            <span>⚙️</span>{!collapsed && <span>Admin Settings</span>}
          </NavLink>

          <div className="sidebar-footer-push">
            <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.14)", margin: "8px 0 6px" }} />
            <button
              type="button"
              className="admin-nav-item"
              onClick={handleAdminLogout}
              style={{ background: "none", border: "none", textAlign: "left", width: "100%", color: "#fda4af" }}
            >
              <span>🚪</span>{!collapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
