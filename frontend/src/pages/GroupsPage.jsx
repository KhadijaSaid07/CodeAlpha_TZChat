import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import GroupManagePanel from "../components/GroupManagePanel";
import { useToast } from "../context/ToastContext";

export default function GroupsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteInput, setInviteInput] = useState("");

  async function loadGroups() {
    try {
      const gData = await apiRequest("/api/groups/");
      setGroups(gData || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    const joinCode = searchParams.get("join");
    if (!joinCode) return;
    setInviteInput(joinCode);
    (async () => {
      try {
        const joined = await apiRequest(`/api/groups/join/${joinCode.trim()}/`, { method: "POST" });
        showToast(`Joined ${joined.name}!`);
        setInviteInput("");
        setSearchParams({}, { replace: true });
        await loadGroups();
        setSelected(joined);
      } catch (err) {
        showToast(err.message, "error");
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams]);

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
      setSelected(created);
      showToast(`Group "${created.name}" created!`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleJoinInvite(e) {
    e.preventDefault();
    try {
      const raw = inviteInput.trim();
      const urlMatch = raw.match(/[?&]join=([^&]+)/);
      const code = urlMatch ? urlMatch[1] : raw.split("/").filter(Boolean).pop();
      const joined = await apiRequest(`/api/groups/join/${code}/`, { method: "POST" });
      setInviteInput("");
      showToast(`Joined ${joined.name}!`);
      await loadGroups();
      setSelected(joined);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

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
        <h3 style={{ marginBottom: 8 }}>Join Group via Invite Link or Code</h3>
        <form onSubmit={handleJoinInvite} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Paste invite link or code..."
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            required
            style={{ minWidth: 0 }}
          />
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
                  {g.description && (
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 2 }}>{g.description}</div>
                  )}
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", overflowWrap: "anywhere", marginTop: 2 }}>
                    {g.members_count} members · Invite: <code>{g.invite_code}</code>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.conversation_id && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/chat/${g.conversation_id}`)}>
                      Open Chat
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(g)}>
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="card">
          <GroupManagePanel
            group={selected}
            onGroupUpdated={(updated) => {
              setSelected(updated);
              setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
            }}
            onLeftGroup={() => {
              setSelected(null);
              loadGroups();
            }}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}
