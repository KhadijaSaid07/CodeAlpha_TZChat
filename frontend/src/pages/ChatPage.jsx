import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest, apiUrl, getAccessToken, wsUrl } from "../api/client";
import GroupManagePanel from "../components/GroupManagePanel";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [typingUser, setTypingUser] = useState("");
  const [error, setError] = useState("");
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    setShowGroupPanel(false);
    setGroupInfo(null);
    async function loadMessages() {
      try {
        const [convData, msgData] = await Promise.all([
          apiRequest(`/api/messaging/conversations/${id}/`),
          apiRequest(`/api/messaging/conversations/${id}/messages/`),
        ]);
        setConversation(convData);
        setMessages(msgData.results || []);
        if (convData?.conversation_type === "group" && convData?.group_id) {
          apiRequest(`/api/groups/${convData.group_id}/`)
            .then((g) => setGroupInfo(g))
            .catch(() => {});
        }
        await apiRequest(`/api/messaging/conversations/${id}/read/`, { method: "POST" });
      } catch (err) {
        setError(err.message);
      }
    }
    loadMessages();

    const token = getAccessToken();
    const ws = new WebSocket(wsUrl(`/ws/chat/${id}/?token=${token}`));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "chat_message" && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      } else if (data.type === "typing" && data.username !== user?.username) {
        setTypingUser(data.is_typing ? `${data.username} is typing...` : "");
      }
    };

    return () => {
      ws.close();
    };
  }, [id, user?.username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleTyping(val) {
    setText(val);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", is_typing: Boolean(val.trim()) }));
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() && !attachment) return;
    setError("");

    try {
      const formData = new FormData();
      formData.append("content", text.trim());
      if (replyTo) formData.append("reply_to", replyTo.id);
      if (attachment) {
        formData.append("attachment", attachment);
        formData.append("file_type", attachment.type.startsWith("image/") ? "image" : "file");
      }

      const created = await apiRequest(`/api/messaging/conversations/${id}/messages/`, {
        method: "POST",
        body: formData,
      });
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
      setText("");
      setAttachment(null);
      setReplyTo(null);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "typing", is_typing: false }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteMessage(msgId) {
    try {
      await apiRequest(`/api/messaging/messages/${msgId}/`, { method: "DELETE" });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, is_deleted: true, content: "" } : m))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  const isGroup = conversation?.conversation_type === "group";
  const otherUser =
    conversation?.conversation_type === "direct"
      ? conversation.participants?.find((p) => p.id !== user?.id) || conversation.participants?.[0]
      : null;

  const chatTitle = isGroup
    ? groupInfo?.name || conversation?.group_name || "Group Chat"
    : otherUser
    ? otherUser.full_name
    : "Chat";

  const chatSubtitle = isGroup
    ? `${groupInfo?.members_count ?? conversation?.participants?.length ?? 0} members${groupInfo?.description ? ` · ${groupInfo.description}` : ""}`
    : otherUser
    ? `@${otherUser.username}`
    : "";

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 140px)",
        minHeight: 420,
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 10, gap: 8 }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: isGroup ? "pointer" : "default" }}
          onClick={() => isGroup && groupInfo && setShowGroupPanel((v) => !v)}
        >
          <Link
            to="/messages"
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            ←
          </Link>
          <UserAvatar src={otherUser?.profile_picture_url} name={chatTitle} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {chatTitle}
            </div>
            {chatSubtitle && (
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {chatSubtitle}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {typingUser && <span style={{ fontSize: "0.8rem", color: "var(--primary)" }}>{typingUser}</span>}
          {isGroup && groupInfo && (
            <button
              type="button"
              className={`btn btn-sm ${showGroupPanel ? "btn-primary" : "btn-outline"}`}
              onClick={() => setShowGroupPanel((v) => !v)}
            >
              ⚙️ {showGroupPanel ? "Back to Chat" : "Group Info"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}

      {showGroupPanel && groupInfo ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 4px" }}>
          <GroupManagePanel
            group={groupInfo}
            onGroupUpdated={(updated) => {
              setGroupInfo(updated);
              setConversation((prev) => (prev ? { ...prev, group_name: updated.name } : prev));
            }}
            onLeftGroup={() => navigate("/groups")}
            onClose={() => setShowGroupPanel(false)}
          />
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => {
              const senderId = m.sender?.id ?? m.sender_id;
              const isMe = senderId === user?.id;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    background: isMe ? "var(--primary)" : "#e9eef6",
                    color: isMe ? "#fff" : "var(--text)",
                    padding: "10px 14px",
                    borderRadius: 14,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {!isMe && (
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: 2 }}>
                      @{m.sender?.username || m.sender_username}
                    </div>
                  )}
                  {m.reply_to && (
                    <div
                      style={{
                        fontSize: "0.76rem",
                        padding: "4px 8px",
                        marginBottom: 6,
                        borderRadius: 6,
                        background: isMe ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.07)",
                        borderLeft: "3px solid currentColor",
                      }}
                    >
                      ↩ {messages.find((x) => x.id === m.reply_to)?.content?.slice(0, 60) || "Quoted message"}
                    </div>
                  )}
                  <div>{m.is_deleted ? <em>Message deleted</em> : m.content}</div>
                  {m.attachments?.map((att) => (
                    <div key={att.id} style={{ marginTop: 6 }}>
                      {att.file_type === "image" ? (
                        <img src={apiUrl(att.file)} alt="attachment" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }} />
                      ) : (
                        <a href={apiUrl(att.file)} target="_blank" rel="noreferrer" style={{ color: isMe ? "#fff" : "var(--primary)" }}>
                          📎 Download file
                        </a>
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: "0.72rem", opacity: 0.85, marginTop: 4 }}>
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => setReplyTo(m)} style={{ background: "none", border: "none", color: "inherit", fontSize: "0.72rem" }}>
                        Reply
                      </button>
                      {isMe && !m.is_deleted && (
                        <button type="button" onClick={() => handleDeleteMessage(m.id)} style={{ background: "none", border: "none", color: "inherit", fontSize: "0.72rem" }}>
                          Delete
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {replyTo && (
            <div style={{ fontSize: "0.82rem", color: "var(--muted)", padding: "4px 8px", background: "var(--bg)", borderRadius: 8, marginBottom: 6 }}>
              Replying to: {replyTo.content?.slice(0, 50)}{" "}
              <button type="button" onClick={() => setReplyTo(null)} style={{ border: "none", background: "none", color: "var(--danger)" }}>✕</button>
            </div>
          )}

          {attachment && (
            <div style={{ fontSize: "0.82rem", color: "var(--primary)", marginBottom: 6 }}>
              📎 {attachment.name}{" "}
              <button type="button" onClick={() => setAttachment(null)} style={{ border: "none", background: "none" }}>✕</button>
            </div>
          )}

          <form onSubmit={handleSend} style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10, alignItems: "center" }}>
            <label className="btn btn-ghost btn-sm" title="Attach image or file" style={{ position: "relative", overflow: "hidden", flexShrink: 0, padding: "8px 10px" }}>
              📎
              <input
                type="file"
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
            </label>
            <input
              className="input"
              type="text"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => handleTyping(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Send</button>
          </form>
        </>
      )}
    </div>
  );
}
