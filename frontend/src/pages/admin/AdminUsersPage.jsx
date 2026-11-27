import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import PasswordInput from "../../components/PasswordInput";
import UserAvatar from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { showToast, askConfirm } = useToast();
  const [searchParams] = useSearchParams();

  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [sort, setSort] = useState("newest");
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: "",
    username: "",
    email: "",
    phone_number: "+255",
    password: "",
    role: "user",
  });
  const [editingUser, setEditingUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");

  async function loadUsers(pageNum = page) {
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", pageNum);
      params.set("sort", sort);
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());

      const data = await apiRequest(`/api/admin-api/users/?${params.toString()}`);
      setUsers(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "");
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    loadUsers(1);
  }, [statusFilter, sort]);

  async function handleViewDetail(targetId) {
    try {
      const detail = await apiRequest(`/api/admin-api/users/${targetId}/`);
      setUserDetail(detail);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    try {
      await apiRequest("/api/admin-api/users/", {
        method: "POST",
        body: JSON.stringify(addForm),
      });
      showToast(`User @${addForm.username} created!`);
      setShowAdd(false);
      setAddForm({ full_name: "", username: "", email: "", phone_number: "+255", password: "", role: "user" });
      loadUsers(1);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    try {
      await apiRequest(`/api/admin-api/users/${editingUser.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editingUser.full_name,
          username: editingUser.username,
          email: editingUser.email,
        }),
      });
      showToast(`Updated @${editingUser.username}!`);
      setEditingUser(null);
      loadUsers(page);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleSuspendSubmit(e) {
    e.preventDefault();
    if (!suspendTarget || !suspendReason.trim()) return;
    const ok = await askConfirm(`Suspend @${suspendTarget.username} for: "${suspendReason.trim()}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/admin-api/users/${suspendTarget.id}/suspend/`, {
        method: "POST",
        body: JSON.stringify({ reason: suspendReason.trim() }),
      });
      showToast(`Suspended @${suspendTarget.username}.`);
      setSuspendTarget(null);
      setSuspendReason("");
      loadUsers(page);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleReactivate(target) {
    const ok = await askConfirm(`Reactivate @${target.username}?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/admin-api/users/${target.id}/reactivate/`, { method: "POST" });
      showToast(`Reactivated @${target.username}.`);
      loadUsers(page);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeleteUser(target) {
    const ok = await askConfirm(`Permanently delete @${target.username}?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/admin-api/users/${target.id}/`, { method: "DELETE" });
      showToast(`Deleted @${target.username}.`);
      loadUsers(page);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2>👥 User Management</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ width: 200 }}
            type="search"
            placeholder="Search name, username, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" style={{ width: "auto" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Users</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="admins">Administrators</option>
          </select>
          <select className="input" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="username">Username</option>
          </select>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => loadUsers(1)}>Search</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd((v) => !v)}>+ Add User</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showAdd && (
        <form onSubmit={handleCreateUser} className="card" style={{ background: "var(--bg)", display: "grid", gap: 10 }}>
          <h3>Add User</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
            <input className="input" placeholder="Full Name" value={addForm.full_name} onChange={(e) => setAddForm((p) => ({ ...p, full_name: e.target.value }))} required />
            <input className="input" placeholder="Username" value={addForm.username} onChange={(e) => setAddForm((p) => ({ ...p, username: e.target.value }))} required />
            <input className="input" type="email" placeholder="Email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} required />
            <input className="input" placeholder="+255712345678" value={addForm.phone_number} onChange={(e) => setAddForm((p) => ({ ...p, phone_number: e.target.value }))} required />
            <PasswordInput
              placeholder="Password"
              value={addForm.password}
              onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
              autoComplete="new-password"
            />
            {user?.role === "super_admin" && (
              <select className="input" value={addForm.role} onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm">Create</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {suspendTarget && (
        <form onSubmit={handleSuspendSubmit} className="card" style={{ background: "#fef2f2", display: "grid", gap: 8 }}>
          <strong>Suspend @{suspendTarget.username} - Reason Required:</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" placeholder="Enter suspension reason..." value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} required />
            <button type="submit" className="btn btn-danger btn-sm">Confirm Suspend</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSuspendTarget(null)}>Cancel</button>
          </div>
        </form>
      )}

      {editingUser && (
        <form onSubmit={handleEditSave} className="card" style={{ background: "var(--primary-light)", display: "grid", gap: 10 }}>
          <h3>Edit User: @{editingUser.username}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
            <input className="input" value={editingUser.full_name} onChange={(e) => setEditingUser((p) => ({ ...p, full_name: e.target.value }))} required />
            <input className="input" value={editingUser.username} onChange={(e) => setEditingUser((p) => ({ ...p, username: e.target.value }))} required />
            <input className="input" type="email" value={editingUser.email} onChange={(e) => setEditingUser((p) => ({ ...p, email: e.target.value }))} required />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingUser(null)}>Cancel</button>
          </div>
        </form>
      )}

      {userDetail && (
        <div className="card" style={{ background: "var(--bg)", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>{userDetail.user.full_name} (@{userDetail.user.username})</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUserDetail(null)}>✕</button>
          </div>
          <div>Bio: {userDetail.bio || "-"} · Location: {userDetail.location || "-"}</div>
          <div>Posts: {userDetail.posts_count} · Reports Against: {userDetail.reports_against?.length || 0}</div>
          <div>Recent Activities: {(userDetail.recent_activities || []).slice(0, 3).map((a) => a.description).join(" | ") || "None"}</div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--border)" }}>
              <th style={{ padding: 10 }}>User</th>
              <th style={{ padding: 10 }}>Email / Phone</th>
              <th style={{ padding: 10 }}>Role</th>
              <th style={{ padding: 10 }}>Joined</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <UserAvatar src={u.profile_picture_url} name={u.full_name} size={32} />
                    <div>
                      <strong>{u.full_name}</strong>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: 10 }}>
                  <div>{u.email}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{u.phone_number}</div>
                </td>
                <td style={{ padding: 10 }}><span className="pill pill-blue">{u.role}</span></td>
                <td style={{ padding: 10, fontSize: "0.8rem", color: "var(--muted)" }}>
                  {new Date(u.date_joined).toLocaleDateString()}
                </td>
                <td style={{ padding: 10 }}>
                  <span className={u.is_suspended ? "pill pill-red" : "pill pill-green"}>
                    {u.is_suspended ? "Suspended" : "Active"}
                  </span>
                </td>
                <td style={{ padding: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleViewDetail(u.id)} title="View details">👁️</button>
                  {u.role !== "super_admin" && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingUser(u)} title="Edit">✏️</button>
                      {u.is_suspended ? (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleReactivate(u)}>Activate</button>
                      ) : (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSuspendTarget(u); setSuspendReason(""); }}>Suspend</button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteUser(u)} title="Delete">🗑️</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Total users: {count}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadUsers(p); }}>Previous</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={users.length < 20} onClick={() => { const p = page + 1; setPage(p); loadUsers(p); }}>Next</button>
        </div>
      </div>
    </div>
  );
}
