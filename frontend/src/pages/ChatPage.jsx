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
    ? `${groupInfo?.members_count ?? conversation?.participants?.length ?? 0} participants`
    : otherUser
    ? `@${otherUser.username}`
    : "";

  const groupImgSrc = groupInfo?.group_image || conversation?.group_image;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 130px)",
        minHeight: 440,
        maxWidth: "100%",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* Royal Blue Top App Bar (matches WhatsApp/mockup style) */}
      <div
        style={{
          background: "#1565f5",
          color: "#fff",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: isGroup ? "pointer" : "default", flex: 1 }}
          onClick={() => isGroup && groupInfo && setShowGroupPanel((v) => !v)}
        >
          <Link
            to="/messages"
            style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, padding: "4px 6px", flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
            title="Back to Messages"
          >
            ←
          </Link>
          {isGroup ? (
            groupImgSrc ? (
              <img
                src={apiUrl(groupImgSrc)}
                alt={chatTitle}
                style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.4)", flexShrink: 0 }}
              />
            ) : (
              <div
                className="avatar-circle"
                style={{ width: 38, height: 38, background: "rgba(255,255,255,0.22)", color: "#fff", flexShrink: 0 }}
              >
                {chatTitle.charAt(0).toUpperCase()}
              </div>
            )
          ) : (
            <UserAvatar src={otherUser?.profile_picture_url} name={chatTitle} size={38} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.96rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {chatTitle}
            </div>
            <div style={{ fontSize: "0.76rem", opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {typingUser || chatSubtitle}
            </div>
          </div>
        </div>

        {isGroup && groupInfo && (
          <button
            type="button"
            onClick={() => setShowGroupPanel((v) => !v)}
            style={{
              background: showGroupPanel ? "#fff" : "rgba(255,255,255,0.2)",
              color: showGroupPanel ? "#1565f5" : "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: "0.8rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {showGroupPanel ? "Chat" : "ℹ️ Info"}
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ margin: "8px 12px 0" }}>
          {error}
        </div>
      )}

      {showGroupPanel && groupInfo ? (
        <div style={{ flex: 1, overflowY: "auto", padding: 12, background: "var(--bg)" }}>
          <GroupManagePanel
            group={groupInfo}
            onGroupUpdated={(updated) => {
              setGroupInfo(updated);
              setConversation((prev) =>
                prev ? { ...prev, group_name: updated.name, group_image: updated.group_image } : prev
              );
            }}
            onLeftGroup={() => navigate("/groups")}
            onClose={() => setShowGroupPanel(false)}
          />
        </div>
      ) : (
        <>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "14px 12px",
              background: "#f1f5f9",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.86rem", marginTop: 24 }}>
                No messages yet. Say hello!
              </div>
            )}
            {messages.map((m) => {
              const senderId = m.sender?.id ?? m.sender_id;
              const isMe = senderId === user?.id;
              const quoted = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 8,
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    maxWidth: "84%",
                  }}
                >
                  {!isMe && isGroup && (
                    <UserAvatar
                      src={m.sender?.profile_picture_url}
                      name={m.sender?.full_name || m.sender?.username || "U"}
                      size={28}
                    />
                  )}
                  <div
                    style={{
                      background: isMe ? "#1565f5" : "#ffffff",
                      color: isMe ? "#fff" : "var(--text)",
                      padding: "9px 13px",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      minWidth: 90,
                    }}
                  >
                    {!isMe && isGroup && (
                      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#1565f5", marginBottom: 3 }}>
                        {m.sender?.full_name || `@${m.sender?.username || m.sender_username}`}
                      </div>
                    )}
                    {m.reply_to && (
                      <div
                        style={{
                          fontSize: "0.76rem",
                          padding: "5px 8px",
                          marginBottom: 6,
                          borderRadius: 8,
                          background: isMe ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                          borderLeft: `3px solid ${isMe ? "#fff" : "#1565f5"}`,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.72rem" }}>
                          {quoted?.sender?.full_name || "Quoted message"}
                        </div>
                        <div style={{ opacity: 0.9 }}>{quoted?.content?.slice(0, 70) || "Attachment"}</div>
                      </div>
                    )}
                    <div style={{ fontSize: "0.93rem", lineHeight: 1.4 }}>
                      {m.is_deleted ? <em>Message deleted</em> : m.content}
                    </div>
                    {m.attachments?.map((att) => (
                      <div key={att.id} style={{ marginTop: 6 }}>
                        {att.file_type === "image" ? (
                          <img
                            src={apiUrl(att.file)}
                            alt="attachment"
                            style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10 }}
                          />
                        ) : (
                          <a
                            href={apiUrl(att.file)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: isMe ? "#fff" : "#1565f5", textDecoration: "underline" }}
                          >
                            📎 Download file
                          </a>
                        )}
                      </div>
                    ))}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        fontSize: "0.7rem",
                        opacity: 0.8,
                        marginTop: 4,
                      }}
                    >
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {isMe && (m.status === "read" ? " ✓✓" : " ✓")}
                      </span>
                      <span style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setReplyTo(m)}
                          style={{ background: "none", border: "none", color: "inherit", fontSize: "0.7rem" }}
                        >
                          Reply
                        </button>
                        {isMe && !m.is_deleted && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m.id)}
                            style={{ background: "none", border: "none", color: "inherit", fontSize: "0.7rem" }}
                          >
                            Delete
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {replyTo && (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", padding: "6px 12px", background: "#eef2ff", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>↩ Replying to <strong>{replyTo.sender?.full_name || "message"}</strong>: {replyTo.content?.slice(0, 50)}</span>
              <button type="button" onClick={() => setReplyTo(null)} style={{ border: "none", background: "none", color: "var(--danger)", fontWeight: 700 }}>✕</button>
            </div>
          )}

          {attachment && (
            <div style={{ fontSize: "0.8rem", color: "#1565f5", padding: "6px 12px", background: "#eef2ff", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📎 {attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)} style={{ border: "none", background: "none", color: "var(--danger)", fontWeight: 700 }}>✕</button>
            </div>
          )}

          <form
            onSubmit={handleSend}
            style={{
              display: "flex",
              gap: 8,
              borderTop: "1px solid var(--border)",
              padding: "10px 12px",
              alignItems: "center",
              background: "var(--card)",
            }}
          >
            <label
              className="btn btn-ghost btn-sm"
              title="Attach image or file"
              style={{ position: "relative", overflow: "hidden", flexShrink: 0, padding: "8px 10px", borderRadius: 20 }}
            >
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
              placeholder="Message"
              value={text}
              onChange={(e) => handleTyping(e.target.value)}
              style={{ flex: 1, minWidth: 0, borderRadius: 24, padding: "9px 14px" }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0, borderRadius: 24, padding: "9px 16px", background: "#1565f5" }}
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
