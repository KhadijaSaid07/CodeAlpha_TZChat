import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [incomingReqs, setIncomingReqs] = useState([]);
  const [outgoingReqs, setOutgoingReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [convs, inc, out] = await Promise.all([
        apiRequest("/api/messaging/conversations/"),
        apiRequest("/api/messaging/requests/incoming/"),
        apiRequest("/api/messaging/requests/outgoing/"),
      ]);
      setConversations(convs || []);
      setIncomingReqs(inc || []);
      setOutgoingReqs(out || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function getTitle(conv) {
    if (conv.conversation_type === "group") {
      return conv.group_name || "Group Chat";
    }
    const other = conv.participants?.find((p) => p.id !== user?.id) || conv.participants?.[0];
    return other ? `${other.full_name} (@${other.username})` : "Direct Message";
  }

  async function handlePeopleSearch(e) {
    e.preventDefault();
    if (!peopleSearch.trim()) {
      setPeopleResults([]);
      return;
    }
    try {
      const data = await apiRequest(`/api/explore/users/?q=${encodeURIComponent(peopleSearch.trim())}`);
      setPeopleResults(data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function startDirectChat(username) {
    setError("");
    try {
      const conv = await apiRequest(`/api/messaging/conversations/direct/${username}/`, { method: "POST" });
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      if (err.status === 403) {
        setRequestTarget(username);
        setRequestMessage("");
      } else {
        setError(err.message);
      }
    }
  }

  async function handleSendMessageRequest(e) {
    e.preventDefault();
    if (!requestTarget || !requestMessage.trim()) return;
    setError("");
    try {
      await apiRequest(`/api/messaging/requests/${requestTarget}/`, {
        method: "POST",
        body: JSON.stringify({ initial_message: requestMessage.trim() }),
      });
      setRequestTarget(null);
      setRequestMessage("");
      setPeopleResults([]);
      setPeopleSearch("");
      setTab("requests");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRequestAction(id, action) {
    try {
      const res = await apiRequest(`/api/messaging/requests/${id}/${action}/`, { method: "POST" });
      if (action === "accept" && res?.id) {
        navigate(`/chat/${res.id}`);
      } else {
        loadData();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredConvs = conversations.filter((c) => {
    if (tab === "dm" && c.conversation_type !== "direct") return false;
    if (tab === "groups" && c.conversation_type !== "group") return false;
    if (search.trim()) {
      return getTitle(c).toLowerCase().includes(search.trim().toLowerCase());
    }
    return true;
  });

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2>Messages</h2>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          type="search"
          placeholder="Filter existing chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Start a new chat by searching people */}
      <form onSubmit={handlePeopleSearch} style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          type="search"
          placeholder="Find a user by name or username to start a new chat..."
          value={peopleSearch}
          onChange={(e) => setPeopleSearch(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm">Find</button>
      </form>

      {peopleResults.length > 0 && (
        <div style={{ display: "grid", gap: 6, background: "var(--bg)", padding: 10, borderRadius: 10 }}>
          {peopleResults.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span><strong>{p.full_name}</strong> (@{p.username})</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => startDirectChat(p.username)}>
                Message
              </button>
            </div>
          ))}
        </div>
      )}

      {requestTarget && (
        <form onSubmit={handleSendMessageRequest} className="card" style={{ background: "var(--primary-light)", display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>
            @{requestTarget} only accepts direct messages from friends. Send a Message Request:
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="Write your message request..."
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm">Send Request</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRequestTarget(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "All" },
          { key: "dm", label: "DM" },
          { key: "groups", label: "Groups" },
          { key: "requests", label: `Requests (${incomingReqs.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading messages...</p>
      ) : tab === "requests" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <h3>Incoming Requests</h3>
          {incomingReqs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No incoming message requests.</p>
          ) : (
            incomingReqs.map((r) => (
              <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <strong>{r.sender?.full_name}</strong> (@{r.sender?.username})
                  <p style={{ color: "var(--muted)", marginTop: 4 }}>{r.initial_message}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleRequestAction(r.id, "accept")}>Accept</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => handleRequestAction(r.id, "decline")}>Decline</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRequestAction(r.id, "block")}>Block</button>
                </div>
              </div>
            ))
          )}

          <h3 style={{ marginTop: 8 }}>Outgoing Requests</h3>
          {outgoingReqs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No outgoing message requests.</p>
          ) : (
            outgoingReqs.map((r) => (
              <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                To <strong>@{r.receiver?.username}</strong>: {r.initial_message} ({r.status})
              </div>
            ))
          )}
        </div>
      ) : filteredConvs.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No conversations yet. Visit a user&apos;s <Link to="/explore">profile</Link> or <Link to="/groups">Groups</Link> to start chatting!
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filteredConvs.map((c) => (
            <Link
              key={c.id}
              to={`/chat/${c.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar-circle">
                  {getTitle(c).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{getTitle(c)}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {c.last_message?.is_deleted
                      ? "Message deleted"
                      : c.last_message?.content || "No messages yet"}
                  </div>
                </div>
              </div>
              {c.unread_count > 0 && <span className="badge-count">{c.unread_count}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
