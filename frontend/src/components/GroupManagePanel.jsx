import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

/**
 * Shared WhatsApp-style group management panel used on both GroupsPage and ChatPage.
 */
export default function GroupManagePanel({ group, onGroupUpdated, onLeftGroup, onClose }) {
  const { user } = useAuth();
  const { showToast, askConfirm } = useToast();

  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [memberUsername, setMemberUsername] = useState("");
  const [editingInfo, setEditingInfo] = useState(false);
  const [editName, setEditName] = useState(group?.name || "");
  const [editDescription, setEditDescription] = useState(group?.description || "");
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    setEditName(group?.name || "");
    setEditDescription(group?.description || "");
    setEditingInfo(false);
  }, [group?.id, group?.name, group?.description]);

  async function loadDetails() {
    if (!group?.id) return;
    try {
      const [mData, fData] = await Promise.all([
        apiRequest(`/api/groups/${group.id}/members/`),
        apiRequest("/api/friends/"),
      ]);
      setMembers(mData || []);
      setFriends(fData || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  useEffect(() => {
    loadDetails();
  }, [group?.id]);

  if (!group) return null;

  const myMembership = members.find((m) => m.user?.id === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isOwnerOrAdmin = myMembership?.role === "owner" || myMembership?.role === "admin";
  const canEditInfo = isOwnerOrAdmin || !group.only_admins_can_edit_info;
  const canAddMembers = isOwnerOrAdmin || group.allow_member_invites;

  const memberUsernames = new Set(members.map((m) => m.user?.username));
  const addableFriends = friends.filter((f) => !memberUsernames.has(f.username));
  const inviteLink = `${window.location.origin}/groups?join=${group.invite_code}`;

  async function handleSaveInfo(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSavingInfo(true);
    try {
      const updated = await apiRequest(`/api/groups/${group.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });
      onGroupUpdated?.(updated);
      setEditingInfo(false);
      showToast("Group info updated!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleTogglePermission(field) {
    try {
      const updated = await apiRequest(`/api/groups/${group.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: !group[field] }),
      });
      onGroupUpdated?.(updated);
      showToast("Group permission updated!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function addMemberByUsername(usernameToAdd) {
    const clean = usernameToAdd.trim().replace(/^@/, "");
    if (!clean) return;
    try {
      await apiRequest(`/api/groups/${group.id}/members/`, {
        method: "POST",
        body: JSON.stringify({ username: clean }),
      });
      setMemberUsername("");
      showToast(`Added @${clean} to ${group.name}!`);
      await loadDetails();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleToggleAdmin(member) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    try {
      await apiRequest(`/api/groups/${group.id}/admins/${member.user.username}/`, {
        method: "POST",
        body: JSON.stringify({ role: nextRole }),
      });
      showToast(`@${member.user.username} is now ${nextRole}.`);
      await loadDetails();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleRemoveMember(member) {
    const ok = await askConfirm(`Remove @${member.user.username} from ${group.name}?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/groups/${group.id}/members/${member.user.username}/`, {
        method: "DELETE",
      });
      showToast(`Removed @${member.user.username}.`);
      await loadDetails();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleLeaveGroup() {
    const ok = await askConfirm(`Are you sure you want to leave "${group.name}"?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/groups/${group.id}/leave/`, { method: "POST" });
      showToast("You have left the group.");
      onLeftGroup?.(group.id);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function copyInviteLink() {
    navigator.clipboard?.writeText(inviteLink);
    showToast("Invite link copied!");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{group.name}</h3>
          <p style={{ fontSize: "0.86rem", color: "var(--muted)", marginTop: 4 }}>
            {group.description || "No description yet."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canEditInfo && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setEditingInfo((v) => !v)}
            >
              {editingInfo ? "Cancel Edit" : "✏️ Edit Info"}
            </button>
          )}
          <button type="button" className="btn btn-danger btn-sm" onClick={handleLeaveGroup}>
            Leave Group
          </button>
          {onClose && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Edit Name & Description */}
      {editingInfo && canEditInfo && (
        <form
          onSubmit={handleSaveInfo}
          style={{ background: "var(--bg)", padding: 12, borderRadius: 10, display: "grid", gap: 8 }}
        >
          <strong style={{ fontSize: "0.9rem" }}>Edit Group Name & Description</strong>
          <input
            className="input"
            placeholder="Group name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <textarea
            className="textarea"
            rows={2}
            placeholder="Group description..."
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={savingInfo} style={{ width: "fit-content" }}>
            {savingInfo ? "Saving..." : "Save Changes"}
          </button>
        </form>
      )}

      {/* Shareable Invite Link */}
      <div style={{ background: "var(--bg)", padding: 12, borderRadius: 10, display: "grid", gap: 6 }}>
        <strong style={{ fontSize: "0.9rem" }}>🔗 Invite Through Link</strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="input"
            readOnly
            value={inviteLink}
            onFocus={(e) => e.target.select()}
            style={{ flex: 1, minWidth: 180, fontSize: "0.82rem" }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={copyInviteLink} style={{ flexShrink: 0 }}>
            📋 Copy Invite Link
          </button>
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          Invite Code: <code>{group.invite_code}</code>
        </div>
      </div>

      {/* WhatsApp-style Group Permissions (Owner / Admin only) */}
      {isOwnerOrAdmin && (
        <div style={{ background: "var(--bg)", padding: 12, borderRadius: 10, display: "grid", gap: 8 }}>
          <strong>🛡️ Group Permissions (WhatsApp Style)</strong>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={Boolean(group.only_admins_can_send)}
              onChange={() => handleTogglePermission("only_admins_can_send")}
            />
            <span>Only admins can send messages</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={Boolean(group.only_admins_can_edit_info)}
              onChange={() => handleTogglePermission("only_admins_can_edit_info")}
            />
            <span>Only admins can edit group info</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={Boolean(group.allow_member_invites)}
              onChange={() => handleTogglePermission("allow_member_invites")}
            />
            <span>Allow members to add friends to this group</span>
          </label>
        </div>
      )}

      {/* Add by username or 1-click Add Friend */}
      {canAddMembers && (
        <div style={{ display: "grid", gap: 10 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMemberByUsername(memberUsername);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              className="input"
              placeholder="Add user by username..."
              value={memberUsername}
              onChange={(e) => setMemberUsername(e.target.value)}
              style={{ minWidth: 0 }}
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
              Add User
            </button>
          </form>

          {addableFriends.length > 0 && (
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>Quick-Add Friends:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {addableFriends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => addMemberByUsername(f.username)}
                  >
                    + {f.full_name} (@{f.username})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members list with Owner/Admin controls */}
      <div style={{ display: "grid", gap: 8 }}>
        <strong>Members ({members.length})</strong>
        {members.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              padding: "8px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <strong>{m.user?.full_name}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>@{m.user?.username}</span>{" "}
              <span className="pill pill-blue">{m.role}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {isOwner && m.role !== "owner" && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleToggleAdmin(m)}>
                  {m.role === "admin" ? "Demote" : "Make Admin"}
                </button>
              )}
              {isOwnerOrAdmin && m.role !== "owner" && m.user?.id !== user?.id && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
