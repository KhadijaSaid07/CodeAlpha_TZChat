import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function GroupsPage() {
  const navigate = useNavigate();
  const { showToast, askConfirm } = useToast();
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [memberUsername, setMemberUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadGroups() {
    try {
      const data = await apiRequest("/api/groups/");
      setGroups(data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function openGroup(group) {
    setSelected(group);
    setError("");
    try {
      const mData = await apiRequest(`/api/groups/${group.id}/members/`);
      setMembers(mData || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    setError("");
    try {
      const created = await apiRequest("/api/groups/", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      setGroups((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      setMessage(`Group "${created.name}" created!`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJoinInvite(e) {
    e.preventDefault();
    setError("");
    try {
      const code = inviteInput.trim().split("/").filter(Boolean).pop();
      const joined = await apiRequest(`/api/groups/join/${code}/`, { method: "POST" });
      setInviteInput("");
      setMessage(`Joined ${joined.name}!`);
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!selected || !memberUsername.trim()) return;
    try {
      await apiRequest(`/api/groups/${selected.id}/members/`, {
        method: "POST",
        body: JSON.stringify({ username: memberUsername.trim() }),
      });
      setMemberUsername("");
      openGroup(selected);
    } catch (err) {
      setError(err.message);
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

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
          <input className="input" placeholder="Paste invite UUID code..." value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} required />
          <button type="submit" className="btn btn-outline btn-sm">Join</button>
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
                <div>
                  <strong>{g.name}</strong>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {g.members_count} members · Invite code: <code>{g.invite_code}</code>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
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
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Manage: {selected.name}</h3>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleLeaveGroup(selected.id)}>
              Leave Group
            </button>
          </div>
          <form onSubmit={handleAddMember} style={{ display: "flex", gap: 8 }}>
            <input className="input" placeholder="Add member by username..." value={memberUsername} onChange={(e) => setMemberUsername(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
          <div style={{ display: "grid", gap: 6 }}>
            {members.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span><strong>{m.user?.full_name}</strong> (@{m.user?.username})</span>
                <span style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600 }}>{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
