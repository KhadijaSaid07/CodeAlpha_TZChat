import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest, apiUrl, getAccessToken, wsUrl } from "../api/client";
import GroupManagePanel from "../components/GroupManagePanel";
import { MicIcon, PaperclipIcon, SendIcon } from "../components/NavIcons";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SENDER_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#db2777", "#2563eb", "#7c3aed"];
function getSenderColor(senderId) {
  const idx = Math.abs(Number(senderId) || 0) % SENDER_COLORS.length;
  return SENDER_COLORS[idx];
}

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
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [error, setError] = useState("");

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceFile, setVoiceFile] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

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
        window.dispatchEvent(new Event("user-notif-updated"));
      } catch (err) {
        setError(err.message);
      }
    }
    loadMessages();

    // Background 5-second sync fallback so messages & read receipts stay reliable even if WS closes
    const pollInterval = setInterval(async () => {
      try {
        const msgData = await apiRequest(`/api/messaging/conversations/${id}/messages/`);
        if (Array.isArray(msgData?.results)) {
          setMessages(msgData.results);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 5000);

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
      clearInterval(pollInterval);
      ws.close();
      stopTracks();
    };
  }, [id, user?.username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function stopTracks() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }

  function clearVoicePreview() {
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    setVoicePreviewUrl(null);
    setVoiceFile(null);
  }

  async function startRecording() {
    setError("");
    clearVoicePreview();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser. You can still attach an audio file with 📎.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stopTracks();
        if (audioChunksRef.current.length === 0) return;
        const mimeType = recorder.mimeType || chosenMime || "audio/webm";
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
        setVoiceFile(file);
        setVoicePreviewUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      stopTracks();
      setError("Microphone permission was denied. Please allow microphone access to record voice messages.");
    }
  }

  function stopRecording() {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      stopTracks();
    }
  }

  function cancelRecording() {
    audioChunksRef.current = [];
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => stopTracks();
      mediaRecorderRef.current.stop();
    } else {
      stopTracks();
    }
    setRecordSeconds(0);
  }

  function handleTyping(val) {
    setText(val);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", is_typing: Boolean(val.trim()) }));
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const activeAttachment = voiceFile || attachment;
    if (!text.trim() && !activeAttachment) return;
    setError("");

    try {
      const formData = new FormData();
      formData.append("content", text.trim());
      if (replyTo) formData.append("reply_to", replyTo.id);
      if (activeAttachment) {
        formData.append("attachment", activeAttachment);
        const fname = (activeAttachment.name || "").toLowerCase();
        const fType =
          voiceFile ||
          activeAttachment.type.startsWith("audio/") ||
          /\.(mp3|wav|m4a|ogg|aac)$/.test(fname)
            ? "audio"
            : activeAttachment.type.startsWith("image/") ||
              /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(fname)
            ? "image"
            : activeAttachment.type.startsWith("video/") ||
              /\.(mp4|mov|webm|m4v|3gp|mkv)$/.test(fname)
            ? "video"
            : "file";
        formData.append("file_type", fType);
      }

      const created = await apiRequest(`/api/messaging/conversations/${id}/messages/`, {
        method: "POST",
        body: formData,
      });
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
      setText("");
      setAttachment(null);
      clearVoicePreview();
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
    ? otherUser.is_online
      ? `● Active now · @${otherUser.username}`
      : `Offline · @${otherUser.username}`
    : "";

  const groupImgSrc = groupInfo?.group_image || conversation?.group_image;

  return (
    <div className="chat-shell">
      {/* Royal Blue Top App Bar */}
      <div
        style={{
          background: "var(--primary)",
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
              color: showGroupPanel ? "var(--primary)" : "#fff",
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
              const senderAccent = getSenderColor(senderId);
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
                  {!isMe && (
                    <UserAvatar
                      src={m.sender?.profile_picture_url}
                      name={m.sender?.full_name || m.sender?.username || "U"}
                      size={30}
                    />
                  )}
                  <div
                    style={{
                      background: isMe ? "var(--brand-gradient)" : "#ffffff",
                      color: isMe ? "#fff" : "var(--text)",
                      padding: "10px 14px",
                      borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      border: isMe ? "none" : "1px solid var(--border)",
                      boxShadow: isMe
                        ? "0 4px 14px rgba(79, 70, 229, 0.22)"
                        : "0 2px 6px rgba(20, 19, 42, 0.06)",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      minWidth: 110,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.73rem",
                        fontWeight: 700,
                        color: isMe ? "rgba(255,255,255,0.85)" : senderAccent,
                        marginBottom: 3,
                      }}
                    >
                      {isMe ? "You" : m.sender?.full_name || `@${m.sender?.username || m.sender_username}`}
                    </div>
                    {m.reply_to && (
                      <div
                        style={{
                          fontSize: "0.76rem",
                          padding: "5px 8px",
                          marginBottom: 6,
                          borderRadius: 8,
                          background: isMe ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                          borderLeft: `3px solid ${isMe ? "#fff" : "var(--primary)"}`,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.72rem" }}>
                          {quoted?.sender?.full_name || "Quoted message"}
                        </div>
                        <div style={{ opacity: 0.9 }}>{quoted?.content?.slice(0, 70) || "Attachment"}</div>
                      </div>
                    )}
                    {(m.is_deleted || m.content) && (
                      <div style={{ fontSize: "0.93rem", lineHeight: 1.4 }}>
                        {m.is_deleted ? <em>Message deleted</em> : m.content}
                      </div>
                    )}
                    {!m.is_deleted &&
                      m.attachments?.map((att) => {
                        const fileUrl = apiUrl(att.file);
                        const isImg =
                          att.file_type === "image" ||
                          /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(fileUrl);
                        const isVid =
                          att.file_type === "video" ||
                          /\.(mp4|mov|webm|m4v)(\?|$)/i.test(fileUrl);
                        const isAud = att.file_type === "audio";

                        return (
                          <div key={att.id} style={{ marginTop: 6, display: "grid", gap: 4 }}>
                            {isImg ? (
                              <>
                                <img
                                  src={fileUrl}
                                  alt="attachment"
                                  onClick={() => setLightboxUrl(fileUrl)}
                                  style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10, cursor: "zoom-in" }}
                                />
                                <div style={{ display: "flex", gap: 10, fontSize: "0.74rem" }}>
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(fileUrl)}
                                    style={{ background: "none", border: "none", color: isMe ? "#e0e7ff" : "var(--primary)", fontWeight: 600 }}
                                  >
                                    🔍 View
                                  </button>
                                  <a
                                    href={fileUrl}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: isMe ? "#e0e7ff" : "var(--primary)", fontWeight: 600 }}
                                  >
                                    ⬇ Download
                                  </a>
                                </div>
                              </>
                            ) : isAud ? (
                              <>
                                <audio
                                  controls
                                  preload="metadata"
                                  src={fileUrl}
                                  style={{ maxWidth: "100%", width: 240, height: 36 }}
                                />
                                <a
                                  href={fileUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: "0.72rem", color: isMe ? "#e0e7ff" : "var(--primary)" }}
                                >
                                  ⬇ Download audio
                                </a>
                              </>
                            ) : isVid ? (
                              <>
                                <video
                                  controls
                                  playsInline
                                  preload="metadata"
                                  src={fileUrl}
                                  style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10, background: "#000" }}
                                />
                                <a
                                  href={fileUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: "0.74rem", color: isMe ? "#e0e7ff" : "var(--primary)", fontWeight: 600 }}
                                >
                                  ⬇ Download video
                                </a>
                              </>
                            ) : (
                              <a
                                href={fileUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: isMe ? "#fff" : "var(--primary)", textDecoration: "underline", fontWeight: 600 }}
                              >
                                ⬇ Download file
                              </a>
                            )}
                          </div>
                        );
                      })}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        fontSize: "0.7rem",
                        opacity: 0.9,
                        marginTop: 4,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isMe && (
                          <span
                            style={{
                              fontWeight: 700,
                              color: m.status === "read" ? "#7dd3fc" : "rgba(255,255,255,0.78)",
                            }}
                          >
                            {m.status === "read"
                              ? "✓✓ Seen"
                              : m.status === "delivered"
                              ? "✓✓ Delivered"
                              : "✓ Sent"}
                          </span>
                        )}
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
              <span>↩ Replying to <strong>{replyTo.sender?.full_name || "message"}</strong>: {replyTo.content?.slice(0, 50) || "Attachment"}</span>
              <button type="button" onClick={() => setReplyTo(null)} style={{ border: "none", background: "none", color: "var(--danger)", fontWeight: 700 }}>✕</button>
            </div>
          )}

          {attachment && !voiceFile && (
            <div style={{ fontSize: "0.8rem", color: "var(--primary)", padding: "6px 12px", background: "#eef2ff", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📎 {attachment.name}</span>
              <button type="button" onClick={() => setAttachment(null)} style={{ border: "none", background: "none", color: "var(--danger)", fontWeight: 700 }}>✕</button>
            </div>
          )}

          {/* Voice Note Preview before Sending */}
          {voicePreviewUrl && !isRecording && (
            <div style={{ padding: "8px 12px", background: "#eef2ff", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>🎤 Voice note ready:</span>
              <audio controls src={voicePreviewUrl} style={{ height: 34, flex: 1, minWidth: 180 }} />
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={clearVoicePreview}>
                ✕ Discard
              </button>
            </div>
          )}

          {/* Live Recording Bar OR Standard Message Input Bar */}
          {isRecording ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                borderTop: "1px solid var(--border)",
                padding: "10px 14px",
                background: "#fef2f2",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626", fontWeight: 700, fontSize: "0.9rem" }}>
                <span>🔴 Recording</span>
                <span>{formatDuration(recordSeconds)}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelRecording}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: "var(--primary)", borderRadius: 20 }}
                  onClick={stopRecording}
                >
                  ⏹ Done
                </button>
              </div>
            </div>
          ) : (
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
                className="chat-attach-btn"
                title="Attach image, audio, video, or file"
              >
                <PaperclipIcon />
                <input
                  type="file"
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  onChange={(e) => {
                    clearVoicePreview();
                    setAttachment(e.target.files?.[0] || null);
                  }}
                />
              </label>
              <input
                className="input"
                type="text"
                placeholder={voiceFile ? "Optional caption for voice note..." : "Message"}
                value={text}
                onChange={(e) => handleTyping(e.target.value)}
                style={{ flex: 1, minWidth: 0, borderRadius: 24, padding: "10px 16px" }}
              />
              {text.trim() || attachment || voiceFile ? (
                <button
                  type="submit"
                  className="chat-mic-btn"
                  title="Send message"
                  aria-label="Send message"
                >
                  <SendIcon />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="chat-mic-btn"
                  title="Record voice message"
                  aria-label="Record voice message"
                >
                  <MicIcon />
                </button>
              )}
            </form>
          )}
        </>
      )}

      {lightboxUrl && (
        <div className="modal-backdrop" onClick={() => setLightboxUrl(null)} style={{ zIndex: 120 }}>
          <div style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              style={{
                position: "absolute",
                top: -14,
                right: -14,
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "none",
                background: "#14132a",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
            <img
              src={lightboxUrl}
              alt="Full preview"
              style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 14, display: "block" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
