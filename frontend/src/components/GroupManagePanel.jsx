import { useEffect, useState } from "react";
import { apiRequest, apiUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import UserAvatar from "./UserAvatar";

/**
 * WhatsApp-style Group Details, Edit Group, and Add Participants panel.
 * Used inside ChatPage (Group Info) and GroupsPage (Manage).
 */
export default function GroupManagePanel({ group, onGroupUpdated, onLeftGroup, onClose }) {
  const { user } = useAuth();
  const { showToast, askConfirm } = useToast();

  // "details" | "edit" | "add"
  const [view, setView] = useState("details");
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);

  // Edit Group state
  const [editName, setEditName] = useState(group?.name || "");
  const [editDescription, setEditDescription] = useState(group?.description || "");
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(Boolean(group?.only_admins_can_send));
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(Boolean(group?.only_admins_can_edit_info));
  const [allowMemberInvites, setAllowMemberInvites] = useState(Boolean(group?.allow_member_invites));
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [resettingLink, setResettingLink] = useState(false);

  // Add Participants state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsernames, setSelectedUsernames] = useState([]);
  const [addingUsers, setAddingUsers] = useState(false);

  useEffect(() => {
    setEditName(group?.name || "");
    setEditDescription(group?.description || "");
    setOnlyAdminsSend(Boolean(group?.only_admins_can_send));
    setOnlyAdminsEdit(Boolean(group?.only_admins_can_edit_info));
    setAllowMemberInvites(Boolean(group?.allow_member_invites));
  }, [group]);

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
    setView("details");
    loadDetails();
  }, [group?.id]);

  // Search registered users when in "add" view
  useEffect(() => {
    if (view !== "add") return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const q = searchQuery.trim();
        const data = await apiRequest(`/api/explore/users/${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        if (active) setSearchResults(data || []);
      } catch {
        if (active) setSearchResults([]);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [view, searchQuery]);

  if (!group) return null;

  const myMembership = members.find((m) => m.user?.id === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isOwnerOrAdmin = myMembership?.role === "owner" || myMembership?.role === "admin";
  const canEditInfo = isOwnerOrAdmin || !group.only_admins_can_edit_info;
  const canAddMembers = isOwnerOrAdmin || group.allow_member_invites;

  const memberUsernames = new Set(members.map((m) => m.user?.username));
  const candidateMap = new Map();
  friends.forEach((f) => {
    if (!memberUsernames.has(f.username)) candidateMap.set(f.username, f);
  });
  searchResults.forEach((u) => {
    if (!memberUsernames.has(u.username) && u.id !== user?.id) candidateMap.set(u.username, u);
  });
  const candidates = Array.from(candidateMap.values());

  const inviteLink = `${window.location.origin}/groups?join=${group.invite_code}`;

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("group_image", file);
      const updated = await apiRequest(`/api/groups/${group.id}/`, {
        method: "PATCH",
        body: formData,
      });
      onGroupUpdated?.(updated);
      showToast("Group picture updated!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: editName.trim(),
        description: editDescription.trim(),
      };
      if (isOwnerOrAdmin) {
        payload.only_admins_can_send = onlyAdminsSend;
        payload.only_admins_can_edit_info = onlyAdminsEdit;
        payload.allow_member_invites = allowMemberInvites;
      }
      const updated = await apiRequest(`/api/groups/${group.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      onGroupUpdated?.(updated);
      setView("details");
      showToast("Group updated!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelectUser(username) {
    setSelectedUsernames((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  }

  async function handleAddSelected() {
    if (selectedUsernames.length === 0) return;
    setAddingUsers(true);
    try {
      await apiRequest(`/api/groups/${group.id}/members/`, {
        method: "POST",
        body: JSON.stringify({ usernames: selectedUsernames }),
      });
      showToast(`Added ${selectedUsernames.length} participant${selectedUsernames.length > 1 ? "s" : ""}!`);
      setSelectedUsernames([]);
      setSearchQuery("");
      setView("details");
      await loadDetails();
      const refreshed = await apiRequest(`/api/groups/${group.id}/`);
      onGroupUpdated?.(refreshed);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setAddingUsers(false);
    }
  }

  async function handleResetInviteLink() {
    const ok = await askConfirm("Revoke the current invite link and generate a new one?");
    if (!ok) return;
    setResettingLink(true);
    try {
      const res = await apiRequest(`/api/groups/${group.id}/invite-link/`, { method: "POST" });
      onGroupUpdated?.({ ...group, invite_code: res.invite_code });
      showToast("Invite link reset!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setResettingLink(false);
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
      const refreshed = await apiRequest(`/api/groups/${group.id}/`);
      onGroupUpdated?.(refreshed);
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

  const blueHeaderStyle = {
    background: "#1565f5",
    color: "#fff",
    padding: "12px 14px",
    borderRadius: "12px 12px 0 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  };

  /* -------------------- SUB-VIEW 2: EDIT GROUP -------------------- */
  if (view === "edit") {
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--card)" }}>
        <div style={blueHeaderStyle}>
          <button
            type="button"
            onClick={() => setView("details")}
            style={{ background: "none", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 6 }}
          >
            ← Edit group
          </button>
        </div>

        <form onSubmit={handleSaveEdit} style={{ padding: 16, display: "grid", gap: 14 }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Group name</label>
            <input
              className="input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Group name"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Group description</label>
            <textarea
              className="textarea"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe what this group is about..."
            />
          </div>

          {isOwnerOrAdmin && (
            <div style={{ display: "grid", gap: 10, paddingTop: 4 }}>
              <strong style={{ fontSize: "0.9rem" }}>Group permissions</strong>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="sendPerm"
                  checked={onlyAdminsSend}
                  onChange={() => setOnlyAdminsSend(true)}
                />
                <span>Only admins can send messages</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="sendPerm"
                  checked={!onlyAdminsSend}
                  onChange={() => setOnlyAdminsSend(false)}
                />
                <span>Both Admins &amp; participants can send messages</span>
              </label>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyAdminsEdit}
                  onChange={(e) => setOnlyAdminsEdit(e.target.checked)}
                />
                <span>Only admins can edit group info</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allowMemberInvites}
                  onChange={(e) => setAllowMemberInvites(e.target.checked)}
                />
                <span>Allow participants to add other users</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ width: "100%", borderRadius: 24, padding: "11px 16px", background: "#1565f5" }}
          >
            {saving ? "Saving changes..." : "Save changes"}
          </button>
        </form>
      </div>
    );
  }

  /* -------------------- SUB-VIEW 3: ADD PARTICIPANTS -------------------- */
  if (view === "add") {
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--card)" }}>
        <div style={blueHeaderStyle}>
          <button
            type="button"
            onClick={() => {
              setSelectedUsernames([]);
              setView("details");
            }}
            style={{ background: "none", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 6 }}
          >
            ← Add participants
          </button>
          {selectedUsernames.length > 0 && (
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{selectedUsernames.length} selected</span>
          )}
        </div>

        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <input
            className="input"
            type="search"
            placeholder="Search registered users by name or @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div style={{ display: "grid", gap: 2, maxHeight: 320, overflowY: "auto" }}>
            {candidates.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.88rem", padding: "12px 4px" }}>
                No matching users found to add.
              </p>
            ) : (
              candidates.map((u) => {
                const checked = selectedUsernames.includes(u.username);
                return (
                  <label
                    key={u.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      background: checked ? "var(--primary-light)" : "transparent",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <UserAvatar src={u.profile_picture_url} name={u.full_name} size={40} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{u.full_name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>@{u.username}</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelectUser(u.username)}
                      style={{ width: 18, height: 18, accentColor: "#1565f5", flexShrink: 0 }}
                    />
                  </label>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={addingUsers || selectedUsernames.length === 0}
              onClick={handleAddSelected}
              style={{ borderRadius: 24, padding: "10px 22px", background: "#1565f5" }}
            >
              {addingUsers
                ? "Adding..."
                : `Add ${selectedUsernames.length > 0 ? `(${selectedUsernames.length}) ` : ""}→`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------- SUB-VIEW 1: GROUP DETAILS -------------------- */
  const createdDate = group.created_at
    ? new Date(group.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--card)" }}>
      <div style={blueHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", color: "#fff", fontSize: "1.05rem", fontWeight: 700 }}
              title="Back"
            >
              ←
            </button>
          )}
          <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {group.name}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLeaveGroup}
          style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: "5px 10px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 600 }}
        >
          Leave
        </button>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 16 }}>
        {/* Centered Group Picture + Name + Meta */}
        <div style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 6 }}>
          <div style={{ position: "relative", width: 88, height: 88 }}>
            {group.group_image ? (
              <img
                src={apiUrl(group.group_image)}
                alt={group.name}
                style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--primary-light)" }}
              />
            ) : (
              <div
                className="avatar-circle"
                style={{ width: 88, height: 88, fontSize: "2rem", background: "#1565f5", color: "#fff" }}
              >
                {group.name?.charAt(0).toUpperCase()}
              </div>
            )}
            {canEditInfo && (
              <label
                title="Change group picture"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#1565f5",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  border: "2px solid #fff",
                  fontSize: "0.8rem",
                }}
              >
                {uploadingPhoto ? "…" : "📷"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
              </label>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <h3 style={{ margin: 0 }}>{group.name}</h3>
            {canEditInfo && (
              <button
                type="button"
                onClick={() => setView("edit")}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.95rem" }}
                title="Edit group name & description"
              >
                ✏️
              </button>
            )}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Group | {members.length || group.members_count || 0} Participants
          </div>
          {group.creator && (
            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              Created by {group.creator.id === user?.id ? "you" : `@${group.creator.username}`}
              {createdDate ? `, ${createdDate}` : ""}
            </div>
          )}
        </div>

        {/* Group Description Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            padding: "12px 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Group description</div>
            <div style={{ fontSize: "0.92rem", marginTop: 2, color: group.description ? "var(--text)" : "#1565f5", fontWeight: group.description ? 500 : 600 }}>
              {group.description || "Add description"}
            </div>
          </div>
          {canEditInfo && (
            <button
              type="button"
              onClick={() => setView("edit")}
              className="btn btn-ghost btn-sm"
              title="Edit description"
            >
              ✏️
            </button>
          )}
        </div>

        {/* Group Permissions Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>⚙️ Group permissions</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
              {group.only_admins_can_send
                ? "Only admins can send messages"
                : "Both Admins & participants can send messages"}
            </div>
          </div>
          {isOwnerOrAdmin && (
            <button type="button" onClick={() => setView("edit")} className="btn btn-ghost btn-sm">
              ✏️
            </button>
          )}
        </div>

        {/* Invite Through Link */}
        <div style={{ background: "var(--bg)", padding: 12, borderRadius: 10, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <strong style={{ fontSize: "0.88rem" }}>🔗 Invite via Link</strong>
            {isOwnerOrAdmin && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetInviteLink}
                disabled={resettingLink}
                style={{ fontSize: "0.78rem", color: "var(--danger)" }}
              >
                {resettingLink ? "Resetting..." : "Revoke & Reset Link"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              readOnly
              value={inviteLink}
              onFocus={(e) => e.target.select()}
              style={{ flex: 1, minWidth: 160, fontSize: "0.8rem" }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ background: "#1565f5", flexShrink: 0 }}
              onClick={() => {
                navigator.clipboard?.writeText(inviteLink);
                showToast("Invite link copied!");
              }}
            >
              Copy Link
            </button>
          </div>
        </div>

        {/* Participants Section */}
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)" }}>
            {members.length} Participants
          </div>

          {canAddMembers && (
            <button
              type="button"
              onClick={() => setView("add")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 8px",
                background: "var(--bg)",
                border: "none",
                borderRadius: 10,
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#1565f5",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "1rem",
                  }}
                >
                  👤+
                </span>
                Add participants
              </span>
              <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>›</span>
            </button>
          )}

          {members.map((m) => {
            const isMe = m.user?.id === user?.id;
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "8px 4px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <UserAvatar src={m.user?.profile_picture_url} name={m.user?.full_name} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                      {isMe ? "You" : m.user?.full_name}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>@{m.user?.username}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {(m.role === "owner" || m.role === "admin") && (
                    <span
                      style={{
                        background: m.role === "owner" ? "#1565f5" : "#e0edff",
                        color: m.role === "owner" ? "#fff" : "#1565f5",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        textTransform: "capitalize",
                      }}
                    >
                      {m.role}
                    </span>
                  )}
                  {isOwner && m.role !== "owner" && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleToggleAdmin(m)}>
                      {m.role === "admin" ? "Demote" : "Make Admin"}
                    </button>
                  )}
                  {isOwnerOrAdmin && m.role !== "owner" && !isMe && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
