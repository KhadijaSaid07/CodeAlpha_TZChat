import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function AdminSettingsPage() {
  const { user, refreshUser, bumpAvatarVersion } = useAuth();
  const { showToast } = useToast();
  const isSuper = user?.role === "super_admin";

  const [tab, setTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || "", username: user?.username || "" });
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "" });
  const [admins, setAdmins] = useState([]);
  const [sysForm, setSysForm] = useState({
    site_name: "TZChat",
    platform_description: "Connect. Chat. Share.",
    allow_registration: true,
    require_post_moderation: false,
    notify_on_new_user: true,
    maintenance_mode: false,
    max_upload_mb: 5,
  });

  useEffect(() => {
    if (!isSuper) return;
    async function loadSuper() {
      try {
        const [adm, sys] = await Promise.all([
          apiRequest("/api/admin-api/admins/"),
          apiRequest("/api/admin-api/settings/"),
        ]);
        setAdmins(adm || []);
        setSysForm(sys);
      } catch (err) {
        showToast(err.message, "error");
      }
    }
    loadSuper();
  }, [isSuper]);

  async function saveProfile(e) {
    e.preventDefault();
    try {
      await apiRequest("/api/profiles/me/", { method: "PATCH", body: JSON.stringify(profileForm) });
      await refreshUser();
      showToast("Admin profile updated!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    try {
      await apiRequest("/api/profiles/me/avatar/", { method: "POST", body: fd });
      bumpAvatarVersion();
      await refreshUser();
      showToast("Admin profile picture updated!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      await apiRequest("/api/admin-api/security/change-password/", {
        method: "POST",
        body: JSON.stringify(pwForm),
      });
      setPwForm({ current_password: "", new_password: "" });
      showToast("Password changed successfully!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function logoutOtherDevices() {
    try {
      await apiRequest("/api/admin-api/security/logout-other-devices/", { method: "POST" });
      showToast("All other sessions invalidated.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function togglePermission(adm, key) {
    const updatedPerms = { ...(adm.admin_permissions || {}), [key]: !adm.admin_permissions?.[key] };
    try {
      await apiRequest(`/api/admin-api/admins/${adm.id}/permissions/`, {
        method: "PATCH",
        body: JSON.stringify({ admin_permissions: updatedPerms }),
      });
      setAdmins((prev) => prev.map((a) => (a.id === adm.id ? { ...a, admin_permissions: updatedPerms } : a)));
      showToast(`Updated permissions for @${adm.username}`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function saveSystem(e) {
    e.preventDefault();
    try {
      const updated = await apiRequest("/api/admin-api/settings/", {
        method: "PATCH",
        body: JSON.stringify(sysForm),
      });
      setSysForm(updated);
      showToast("System settings saved!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <h2>⚙️ Admin Settings</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className={`btn btn-sm ${tab === "profile" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("profile")}>Admin Profile</button>
        <button type="button" className={`btn btn-sm ${tab === "security" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("security")}>Security Settings</button>
        {isSuper && (
          <>
            <button type="button" className={`btn btn-sm ${tab === "roles" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("roles")}>Admins &amp; Permissions</button>
            <button type="button" className={`btn btn-sm ${tab === "system" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("system")}>System Settings</button>
          </>
        )}
      </div>

      {tab === "profile" && (
        <form onSubmit={saveProfile} style={{ display: "grid", gap: 12, maxWidth: 460 }}>
          <input className="input" placeholder="Full Name" value={profileForm.full_name} onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))} />
          <input className="input" placeholder="Username" value={profileForm.username} onChange={(e) => setProfileForm((p) => ({ ...p, username: e.target.value }))} />
          <label className="btn btn-outline btn-sm" style={{ width: "fit-content" }}>
            Upload Profile Picture
            <input type="file" accept="image/*" hidden onChange={(e) => uploadAvatar(e.target.files?.[0])} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" style={{ width: "fit-content" }}>Save Profile</button>
        </form>
      )}

      {tab === "security" && (
        <div style={{ display: "grid", gap: 14, maxWidth: 460 }}>
          <form onSubmit={changePassword} style={{ display: "grid", gap: 10 }}>
            <h3>Change Password</h3>
            <input className="input" type="password" placeholder="Current Password" value={pwForm.current_password} onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))} required />
            <input className="input" type="password" placeholder="New Password" value={pwForm.new_password} onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))} required />
            <button type="submit" className="btn btn-primary btn-sm" style={{ width: "fit-content" }}>Update Password</button>
          </form>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
          <div>
            <h3>Session Security</h3>
            <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={logoutOtherDevices}>
              Logout from Other Devices
            </button>
          </div>
        </div>
      )}

      {tab === "roles" && isSuper && (
        <div style={{ display: "grid", gap: 12 }}>
          <h3>Administrator Accounts &amp; Permissions</h3>
          {admins.map((adm) => (
            <div key={adm.id} className="card" style={{ background: "var(--bg)", display: "grid", gap: 8 }}>
              <div><strong>{adm.full_name}</strong> (@{adm.username}) — <span className="pill pill-blue">{adm.role}</span></div>
              {adm.role === "admin" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: "0.86rem" }}>
                  {[
                    "can_manage_users",
                    "can_moderate_posts",
                    "can_manage_groups",
                    "can_view_reports",
                    "can_view_activities",
                    "can_view_audit_logs",
                    "can_view_stats",
                  ].map((permKey) => (
                    <label key={permKey} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(adm.admin_permissions?.[permKey])}
                        onChange={() => togglePermission(adm, permKey)}
                      />
                      <span>{permKey.replace("can_", "").replaceAll("_", " ")}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "system" && isSuper && (
        <form onSubmit={saveSystem} style={{ display: "grid", gap: 12, maxWidth: 500 }}>
          <label>
            <div style={{ fontWeight: 600 }}>Platform Name</div>
            <input className="input" value={sysForm.site_name} onChange={(e) => setSysForm((p) => ({ ...p, site_name: e.target.value }))} />
          </label>
          <label>
            <div style={{ fontWeight: 600 }}>Tagline / Description</div>
            <input className="input" value={sysForm.platform_description} onChange={(e) => setSysForm((p) => ({ ...p, platform_description: e.target.value }))} />
          </label>
          <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={sysForm.allow_registration} onChange={(e) => setSysForm((p) => ({ ...p, allow_registration: e.target.checked }))} /> Allow New Registrations</label>
          <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={sysForm.require_post_moderation} onChange={(e) => setSysForm((p) => ({ ...p, require_post_moderation: e.target.checked }))} /> Require Post Moderation</label>
          <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={sysForm.notify_on_new_user} onChange={(e) => setSysForm((p) => ({ ...p, notify_on_new_user: e.target.checked }))} /> Notify Admins on New Registration</label>
          <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={sysForm.maintenance_mode} onChange={(e) => setSysForm((p) => ({ ...p, maintenance_mode: e.target.checked }))} /> Maintenance Mode</label>
          <button type="submit" className="btn btn-primary btn-sm" style={{ width: "fit-content" }}>Save System Settings</button>
        </form>
      )}
    </div>
  );
}
