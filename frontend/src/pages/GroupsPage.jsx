import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function GroupsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast, askConfirm } = useToast();

  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [memberUsername, setMemberUsername] = useState("");

  async function loadGroups() {
    try {
      const [gData, fData] = await Promise.all([
        apiRequest("/api/groups/"),
        apiRequest("/api/friends/"),
      ]);
      setGroups(gData || []);
      setFriends(fData || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function openGroup(group) {
    setSelected(group);
    try {
      const mData = await apiRequest(`/api/groups/${group.id}/members/`);
      setMembers(mData || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    try {
      const created = await apiRequest("/api/groups/", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      setGroups((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      showToast(`Group "${created.name}" created!`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleJoinInvite(e) {
    e.preventDefault();
    try {
      const code = inviteInput.trim().split("/").filter(Boolean).pop();
      const joined = await apiRequest(`/api/groups/join/${code}/`, { method: "POST" });
      setInviteInput("");
      showToast(`Joined ${joined.name}!`);
      loadGroups();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function addMemberByUsername(usernameToAdd) {
    if (!selected || !usernameToAdd) return;
    try {
      await apiRequest(`/api/groups/${selected.id}/members/`, {
        method: "POST",
        body: JSON.stringify({ username: usernameToAdd }),
      });
      setMemberUsername("");
      showToast(`Added @${usernameToAdd} to ${selected.name}!`);
      openGroup(selected);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleToggleAdmin(member) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    try {
      await apiRequest(`/api/groups/${selected.id}/admins/${member.user.username}/`, {
        method: "POST",
        body: JSON.stringify({ role: nextRole }),
      });
      showToast(`@${member.user.username} is now ${nextRole}.`);
      openGroup(selected);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleRemoveMember(member) {
    const ok = await askConfirm(`Remove @${member.user.username} from ${selected.name}?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/groups/${selected.id}/members/${member.user.username}/`, {
        method: "DELETE",
      });
      showToast(`Removed @${member.user.username}.`);
      openGroup(selected);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleTogglePermission(field) {
    if (!selected) return;
    const nextVal = !selected[field];
    try {
      const updated = await apiRequest(`/api/groups/${selected.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: nextVal }),
      });
      setSelected(updated);
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      showToast("Group permission updated!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleLeaveGroup(groupId) {
    const ok = await askConfirm("Are you sure you want to leave this group?");
    if (!ok) return;
    try {
      await apiRequest(`/api/groups/${groupId}/leave/`, { method: "POST" });
      setSelected(null);
      showToast("You have left the group.");
      loadGroups();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const myMembership = members.find((m) => m.user?.id === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isOwnerOrAdmin = myMembership?.role === "owner" || myMembership?.role === "admin";
  const memberUsernames = new Set(members.map((m) => m.user?.username));
  const addableFriends = friends.filter((f) => !memberUsernames.has(f.username));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <h2 style={{ marginBottom: 10 }}>Create Group</h2>
        <form onSubmit={handleCreateGroup} style={{ display: "grid", gap: 10 }}>
          <input className="input" placeholder="Group Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm" style={{ width: "fit-content" }}>Create Group</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Join Group via Invite Code</h3>
        <form onSubmit={handleJoinInvite} style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="Paste invite code..." value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} required style={{ minWidth: 0 }} />
          <button type="submit" className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>Join</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Your Groups ({groups.length})</h3>
        {groups.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>You are not in any groups yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groups.map((g) => (
              <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{g.name}</strong>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", overflowWrap: "anywhere" }}>
                    {g.members_count} members · Invite: <code>{g.invite_code}</code>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.conversation_id && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/chat/${g.conversation_id}`)}>
                      Open Chat
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openGroup(g)}>
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3>Manage: {selected.name}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(selected.invite_code);
                  showToast("Invite code copied!");
                }}
              >
                📋 Copy Invite
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleLeaveGroup(selected.id)}>
                Leave Group
              </button>
            </div>
          </div>

          {/* WhatsApp-style Group Permissions (Owner / Admin only) */}
          {isOwnerOrAdmin && (
            <div style={{ background: "var(--bg)", padding: 12, borderRadius: 10, display: "grid", gap: 8 }}>
              <strong>🛡️ Group Permissions (WhatsApp Style)</strong>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                <input
                  type="checkbox"
                  checked={Boolean(selected.only_admins_can_send)}
                  onChange={() => handleTogglePermission("only_admins_can_send")}
                />
                <span>Only admins can send messages</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                <input
                  type="checkbox"
                  checked={Boolean(selected.only_admins_can_edit_info)}
                  onChange={() => handleTogglePermission("only_admins_can_edit_info")}
                />
                <span>Only admins can edit group info</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                <input
                  type="checkbox"
                  checked={Boolean(selected.allow_member_invites)}
                  onChange={() => handleTogglePermission("allow_member_invites")}
                />
                <span>Allow members to add friends to this group</span>
              </label>
            </div>
          )}

          {/* Add by username or 1-click Add Friend */}
          {(isOwnerOrAdmin || selected.allow_member_invites) && (
            <div style={{ display: "grid", gap: 10 }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addMemberByUsername(memberUsername.trim());
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  className="input"
                  placeholder="Add member by username..."
                  value={memberUsername}
                  onChange={(e) => setMemberUsername(e.target.value)}
                  style={{ minWidth: 0 }}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Add</button>
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
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
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
      )}
    </div>
  );
}
