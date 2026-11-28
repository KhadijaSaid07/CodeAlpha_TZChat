import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, apiUrl } from "../api/client";
import GroupManagePanel from "../components/GroupManagePanel";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create Group form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupImage, setGroupImage] = useState(null);
  const [groupImagePreview, setGroupImagePreview] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);

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

  // Load candidate users when Create Group form is open
  useEffect(() => {
    if (!showCreate) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const q = memberSearch.trim();
        const data = await apiRequest(`/api/explore/users/${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        if (active) setMemberCandidates((data || []).filter((u) => u.id !== user?.id));
      } catch {
        if (active) setMemberCandidates([]);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [showCreate, memberSearch, user?.id]);

  // Auto-join when opened via shareable invite link (?join=<code>)
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
        if (joined.conversation_id) {
          navigate(`/chat/${joined.conversation_id}`);
        } else {
          setSelected(joined);
        }
      } catch (err) {
        showToast(err.message, "error");
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams]);

  function handleSelectImage(file) {
    setGroupImage(file || null);
    if (groupImagePreview) URL.revokeObjectURL(groupImagePreview);
    setGroupImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function toggleInitialMember(username) {
    setSelectedMembers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      if (groupImage) formData.append("group_image", groupImage);
      if (selectedMembers.length > 0) {
        formData.append("member_usernames", selectedMembers.join(","));
      }
      const created = await apiRequest("/api/groups/", {
        method: "POST",
        body: formData,
      });
      setGroups((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      handleSelectImage(null);
      setSelectedMembers([]);
      setShowCreate(false);
      showToast(`Group "${created.name}" created!`);
      if (created.conversation_id) {
        navigate(`/chat/${created.conversation_id}`);
      } else {
        setSelected(created);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreating(false);
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
      if (joined.conversation_id) {
        navigate(`/chat/${joined.conversation_id}`);
      } else {
        setSelected(joined);
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div style={{ maxWidth: 820, width: "100%", margin: "0 auto", display: "grid", gap: 14, minWidth: 0 }}>
      {/* Top Bar: New Group + Join via Link */}
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>Groups</h2>
            <p style={{ fontSize: "0.84rem", color: "var(--muted)", marginTop: 2 }}>
              Create WhatsApp-style groups, invite via link, and manage participants.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ background: "var(--primary)", borderRadius: 20, padding: "8px 16px" }}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "✕ Close" : "+ New Group"}
          </button>
        </div>

        {/* WhatsApp-style Create Group Form */}
        {showCreate && (
          <form
            onSubmit={handleCreateGroup}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--bg)",
            }}
          >
            <div style={{ background: "var(--primary)", color: "#fff", padding: "10px 14px", fontWeight: 700 }}>
              New Group
            </div>
            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              {/* Group Picture Picker */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <label
                  style={{
                    position: "relative",
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "#e0edff",
                    color: "var(--primary)",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                    flexShrink: 0,
                    fontSize: "1.3rem",
                  }}
                  title="Upload group picture"
                >
                  {groupImagePreview ? (
                    <img src={groupImagePreview} alt="Group" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    "📷"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                    onChange={(e) => handleSelectImage(e.target.files?.[0])}
                  />
                </label>
                <div style={{ flex: "1 1 180px", minWidth: 0, display: "grid", gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Group Name (required)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Group Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ minHeight: 58 }}
                  />
                </div>
              </div>

              {/* Multi-select Initial Participants */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.88rem" }}>Add Participants (optional)</strong>
                  {selectedMembers.length > 0 && (
                    <span className="pill pill-blue">{selectedMembers.length} selected</span>
                  )}
                </div>
                <input
                  className="input"
                  type="search"
                  placeholder="Search registered users to add..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                {memberCandidates.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: "auto", background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    {memberCandidates.map((u) => {
                      const checked = selectedMembers.includes(u.username);
                      return (
                        <label
                          key={u.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 10px",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            background: checked ? "var(--primary-light)" : "transparent",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <UserAvatar src={u.profile_picture_url} name={u.full_name} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{u.full_name}</div>
                              <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>@{u.username}</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInitialMember(u.username)}
                            style={{ width: 17, height: 17, accentColor: "var(--primary)" }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating}
                style={{ borderRadius: 24, background: "var(--primary)", width: "100%" }}
              >
                {creating ? "Creating Group..." : "Create Group & Open Chat"}
              </button>
            </div>
          </form>
        )}

        {/* Join via Invite Link or Code */}
        <form onSubmit={handleJoinInvite} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Paste group invite link or code..."
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            required
            style={{ flex: "1 1 180px", minWidth: 0 }}
          />
          <button type="submit" className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>Join</button>
        </form>
      </div>

      {/* Your Groups List */}
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Your Groups ({groups.length})</h3>
        {groups.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>You are not in any groups yet. Click &ldquo;+ New Group&rdquo; above!</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groups.map((g) => (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                  {g.group_image ? (
                    <img
                      src={apiUrl(g.group_image)}
                      alt={g.name}
                      style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div className="avatar-circle" style={{ width: 46, height: 46, background: "var(--primary)", color: "#fff", flexShrink: 0 }}>
                      {g.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, overflowWrap: "anywhere", wordBreak: "break-word" }}>{g.name}</div>
                    {g.description && (
                      <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 2, overflowWrap: "anywhere", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        {g.description}
                      </div>
                    )}
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>
                      {g.members_count} participants
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.conversation_id && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ background: "var(--primary)" }}
                      onClick={() => navigate(`/chat/${g.conversation_id}`)}
                    >
                      Open Chat
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(g)}>
                    Group Info
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
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
      )}
    </div>
  );
}
