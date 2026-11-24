import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import { useToast } from "../context/ToastContext";

export default function SettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    profile_visibility: "everyone",
    profile_picture_visibility: "everyone",
    phone_visibility: "friends",
    phone_discovery: "contacts",
    messaging_permission: "everyone",
    following_permission: "everyone",
  });
  const [blocked, setBlocked] = useState([]);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [discoveryResult, setDiscoveryResult] = useState(null);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [priv, blk] = await Promise.all([
          apiRequest("/api/privacy/settings/"),
          apiRequest("/api/privacy/blocked/"),
        ]);
        setSettings(priv);
        setBlocked(blk || []);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const updated = await apiRequest("/api/privacy/settings/", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      showToast("Privacy settings saved!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleUnblock(username) {
    try {
      await apiRequest(`/api/privacy/unblock/${username}/`, { method: "DELETE" });
      setBlocked((prev) => prev.filter((b) => b.username !== username));
      showToast(`Unblocked @${username}`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handlePhoneLookup(e) {
    e.preventDefault();
    setError("");
    setDiscoveryResult(null);
    try {
      const res = await apiRequest(`/api/privacy/discover/phone/?phone=${encodeURIComponent(phoneQuery)}`);
      setDiscoveryResult(res);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      showToast("New passwords do not match.", "error");
      return;
    }
    try {
      await apiRequest("/api/auth/change-password/", {
        method: "POST",
        body: JSON.stringify(pwForm),
      });
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
      showToast("Password changed successfully!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form className="card" onSubmit={handleSave} style={{ display: "grid", gap: 14 }}>
        <h2>🛡️ Privacy Settings</h2>
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Who can see my profile?</div>
          <select
            className="input"
            value={settings.profile_visibility}
            onChange={(e) => setSettings((p) => ({ ...p, profile_visibility: e.target.value }))}
          >
            <option value="everyone">Everyone</option>
            <option value="friends">Friends only</option>
            <option value="private">Private</option>
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Who can see my profile picture?</div>
          <select
            className="input"
            value={settings.profile_picture_visibility}
            onChange={(e) => setSettings((p) => ({ ...p, profile_picture_visibility: e.target.value }))}
          >
            <option value="everyone">Everyone</option>
            <option value="friends">Friends only</option>
            <option value="contacts">My contacts</option>
            <option value="nobody">Nobody except me</option>
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Who can see my phone number?</div>
          <select
            className="input"
            value={settings.phone_visibility}
            onChange={(e) => setSettings((p) => ({ ...p, phone_visibility: e.target.value }))}
          >
            <option value="everyone">Everyone</option>
            <option value="friends">Friends only</option>
            <option value="nobody">Nobody</option>
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Who can message me?</div>
          <select
            className="input"
            value={settings.messaging_permission}
            onChange={(e) => setSettings((p) => ({ ...p, messaging_permission: e.target.value }))}
          >
            <option value="everyone">Everyone</option>
            <option value="friends">Friends only</option>
            <option value="nobody">Nobody</option>
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Who can find me by phone number?</div>
          <select
            className="input"
            value={settings.phone_discovery}
            onChange={(e) => setSettings((p) => ({ ...p, phone_discovery: e.target.value }))}
          >
            <option value="everyone">Everyone</option>
            <option value="contacts">My contacts</option>
            <option value="nobody">Nobody</option>
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Who can follow me?</div>
          <select
            className="input"
            value={settings.following_permission}
            onChange={(e) => setSettings((p) => ({ ...p, following_permission: e.target.value }))}
          >
            <option value="everyone">Everyone</option>
            <option value="approval_required">Approval required</option>
          </select>
        </label>

        <button type="submit" className="btn btn-primary">Save Changes</button>
      </form>

      <form className="card" onSubmit={handleChangePassword} style={{ display: "grid", gap: 12 }}>
        <h3>🔒 Change Password</h3>
        <PasswordInput
          placeholder="Current Password"
          value={pwForm.current_password}
          onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))}
        />
        <PasswordInput
          placeholder="New Password (min 8 characters)"
          value={pwForm.new_password}
          onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
          autoComplete="new-password"
        />
        <PasswordInput
          placeholder="Confirm New Password"
          value={pwForm.confirm_password}
          onChange={(e) => setPwForm((p) => ({ ...p, confirm_password: e.target.value }))}
          autoComplete="new-password"
        />
        <button type="submit" className="btn btn-primary" style={{ width: "fit-content" }}>
          Update Password
        </button>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Find Friend by Phone Number</h3>
        <form onSubmit={handlePhoneLookup} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="+255712345678"
            value={phoneQuery}
            onChange={(e) => setPhoneQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-outline">Search</button>
        </form>
        {discoveryResult && (
          <div style={{ marginTop: 10, fontSize: "0.9rem" }}>
            {discoveryResult.registered && discoveryResult.user ? (
              <div>Found: <strong>{discoveryResult.user.full_name}</strong> (@{discoveryResult.user.username})</div>
            ) : (
              <div>Not found or restricted. Invite link: <code>{discoveryResult.invite_link || "N/A"}</code></div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Blocked Users ({blocked.length})</h3>
        {blocked.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>You have not blocked anyone.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {blocked.map((b) => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span><strong>{b.full_name}</strong> (@{b.username})</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleUnblock(b.username)}>
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
