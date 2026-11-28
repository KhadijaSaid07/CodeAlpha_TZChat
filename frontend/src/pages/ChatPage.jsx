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

function getFileBadge(url) {
  const clean = (url || "").split("?")[0];
  const ext = (clean.split(".").pop() || "FILE").toUpperCase();
  const map = {
    PDF: { label: "PDF Document", color: "#e11d48" },
    DOC: { label: "Word Document", color: "#2563eb" },
    DOCX: { label: "Word Document", color: "#2563eb" },
    XLS: { label: "Excel Spreadsheet", color: "#0d9488" },
    XLSX: { label: "Excel Spreadsheet", color: "#0d9488" },
    CSV: { label: "CSV Spreadsheet", color: "#0d9488" },
    PPT: { label: "PowerPoint", color: "#ea580c" },
    PPTX: { label: "PowerPoint", color: "#ea580c" },
    TXT: { label: "Text File", color: "#475569" },
    ZIP: { label: "ZIP Archive", color: "#7c3aed" },
  };
  return map[ext] || { label: `${ext.slice(0, 6)} File`, color: "#4f46e5" };
}

function renderMessageWithMentions(text, isMe) {
  if (!text) return null;
  const parts = text.split(/(@[A-Za-z][A-Za-z0-9_]{1,29})/g);
  return parts.map((part, i) => {
    if (part.startsWith("@") && part.length > 2) {
      const uname = part.slice(1);
      return (
        <Link
          key={i}
          to={`/profile/${uname}`}
          style={{
            color: isMe ? "#fde68a" : "var(--primary)",
            fontWeight: 700,
            textDecoration: "underline",
          }}
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
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
  const [lightboxMedia, setLightboxMedia] = useState(null); // { type: "image" | "video", url }
  const [error, setError] = useState("");

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null);

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
  const inputRef = useRef(null);

  async function markConversationRead() {
    try {
      await apiRequest(`/api/messaging/conversations/${id}/read/`, { method: "POST" });
      window.dispatchEvent(new Event("user-notif-updated"));
    } catch {
      // Ignore transient read errors
    }
  }

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
        await markConversationRead();
      } catch (err) {
        setError(err.message);
      }
    }
    loadMessages();

    // Background 5-second sync fallback for messages & live Read/Delivered status
    const pollInterval = setInterval(async () => {
      try {
        const msgData = await apiRequest(`/api/messaging/conversations/${id}/messages/`);
        if (Array.isArray(msgData?.results)) {
          setMessages(msgData.results);
          const hasUnreadIncoming = msgData.results.some(
            (m) => (m.sender?.id ?? m.sender_id) !== user?.id && m.status !== "read"
          );
          if (hasUnreadIncoming) {
            markConversationRead();
          }
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
        if ((data.message.sender?.id ?? data.message.sender_id) !== user?.id) {
          markConversationRead();
        }
      } else if (data.type === "typing" && data.username !== user?.username) {
        setTypingUser(data.is_typing ? `${data.username} is typing...` : "");
      }
    };

    return () => {
      clearInterval(pollInterval);
      ws.close();
      stopTracks();
    };
  }, [id, user?.id, user?.username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
      setError("Voice recording is not supported in this browser. You can still attach an audio file.");
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
    // Detect @mention at end of current text
    const match = val.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    setMentionQuery(match ? match[1].toLowerCase() : null);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", is_typing: Boolean(val.trim()) }));
    }
  }

  function insertMention(username) {
    const updated = text.replace(/(^|\s)@[A-Za-z0-9_]*$/, `$1@${username} `);
    setText(updated);
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  async function handleSend(e) {
    e.preventDefault();
    const activeAttachment = voiceFile || attachment;
    if (!text.trim() && !activeAttachment) return;
    setError("");
    setMentionQuery(null);

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

  const mentionCandidates =
    mentionQuery !== null
      ? (conversation?.participants || []).filter(
          (p) =>
            p.id !== user?.id &&
            (p.username.toLowerCase().includes(mentionQuery) ||
              (p.full_name || "").toLowerCase().includes(mentionQuery))
        )
      : [];

  return (
    <div className="chat-shell">
      {/* Top Chat Header */}
      <div
        style={{
          background: "var(--brand-gradient)",
          color: "#fff",
          padding: "11px 16px",
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
            <div style={{ fontSize: "0.76rem", opacity: 0.92, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
            {showGroupPanel ? "Chat" : "Group Info"}
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
          {/* Clean Message List */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "16px 14px",
              background: "#f4f3fb",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.88rem", marginTop: 32 }}>
                No messages yet. Say hello or type @ to mention someone!
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
                    maxWidth: "82%",
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
                        ? "0 4px 14px rgba(79, 70, 229, 0.2)"
                        : "0 2px 6px rgba(20, 19, 42, 0.05)",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      minWidth: 130,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.73rem",
                        fontWeight: 700,
                        color: isMe ? "rgba(255,255,255,0.85)" : senderAccent,
                      }}
                    >
                      {isMe ? "You" : m.sender?.full_name || `@${m.sender?.username || m.sender_username}`}
                    </div>

                    {m.reply_to && (
                      <div
                        style={{
                          fontSize: "0.76rem",
                          padding: "6px 9px",
                          borderRadius: 9,
                          background: isMe ? "rgba(255,255,255,0.18)" : "#f4f3fb",
                          borderLeft: `3px solid ${isMe ? "#fff" : senderAccent}`,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.72rem" }}>
                          {quoted?.sender?.full_name || "Quoted message"}
                        </div>
                        <div style={{ opacity: 0.9 }}>{quoted?.content?.slice(0, 70) || "Attachment"}</div>
                      </div>
                    )}

                    {(m.is_deleted || m.content) && (
                      <div style={{ fontSize: "0.93rem", lineHeight: 1.45 }}>
                        {m.is_deleted ? <em>Message deleted</em> : renderMessageWithMentions(m.content, isMe)}
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
                        const docInfo = getFileBadge(fileUrl);

                        return (
                          <div key={att.id} style={{ display: "grid", gap: 6 }}>
                            {isImg ? (
                              <div style={{ borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.08)", maxWidth: 320 }}>
                                <img
                                  src={fileUrl}
                                  alt="Shared photo"
                                  onClick={() => setLightboxMedia({ type: "image", url: fileUrl })}
                                  style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block", cursor: "zoom-in" }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: isMe ? "rgba(0,0,0,0.22)" : "#f4f3fb", fontSize: "0.74rem" }}>
                                  <button
                                    type="button"
                                    onClick={() => setLightboxMedia({ type: "image", url: fileUrl })}
                                    style={{ background: "none", border: "none", color: isMe ? "#fff" : "var(--primary)", fontWeight: 600 }}
                                  >
                                    🔍 Fullscreen
                                  </button>
                                  <a
                                    href={fileUrl}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: isMe ? "#fff" : "var(--primary)", fontWeight: 600 }}
                                  >
                                    ⬇ Download
                                  </a>
                                </div>
                              </div>
                            ) : isVid ? (
                              <div style={{ borderRadius: 12, overflow: "hidden", background: "#09090f", maxWidth: 340 }}>
                                <video
                                  controls
                                  playsInline
                                  preload="metadata"
                                  src={fileUrl}
                                  style={{ width: "100%", maxHeight: 260, display: "block", objectFit: "contain", background: "#09090f" }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: isMe ? "rgba(0,0,0,0.3)" : "#f4f3fb", fontSize: "0.74rem" }}>
                                  <button
                                    type="button"
                                    onClick={() => setLightboxMedia({ type: "video", url: fileUrl })}
                                    style={{ background: "none", border: "none", color: isMe ? "#fff" : "var(--primary)", fontWeight: 600 }}
                                  >
                                    🔍 Watch Fullscreen
                                  </button>
                                  <a
                                    href={fileUrl}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: isMe ? "#fff" : "var(--primary)", fontWeight: 600 }}
                                  >
                                    ⬇ Download
                                  </a>
                                </div>
                              </div>
                            ) : isAud ? (
                              <div style={{ display: "grid", gap: 4 }}>
                                <audio
                                  controls
                                  preload="metadata"
                                  src={fileUrl}
                                  style={{ maxWidth: "100%", width: 250, height: 36 }}
                                />
                                <a
                                  href={fileUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: "0.72rem", color: isMe ? "#e0e7ff" : "var(--primary)", fontWeight: 600 }}
                                >
                                  ⬇ Download audio
                                </a>
                              </div>
                            ) : (
                              /* Document Card (PDF, Word, Excel, PowerPoint, etc.) */
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  padding: "10px 12px",
                                  borderRadius: 12,
                                  background: isMe ? "rgba(255,255,255,0.16)" : "#f4f3fb",
                                  border: isMe ? "1px solid rgba(255,255,255,0.25)" : "1px solid var(--border)",
                                  minWidth: 210,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                  <span
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 10,
                                      background: docInfo.color,
                                      color: "#fff",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "0.72rem",
                                      fontWeight: 800,
                                      flexShrink: 0,
                                    }}
                                  >
                                    DOC
                                  </span>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>{docInfo.label}</div>
                                    <div style={{ fontSize: "0.72rem", opacity: 0.8 }}>Click to open or save</div>
                                  </div>
                                </div>
                                <a
                                  href={fileUrl}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    background: isMe ? "#fff" : "var(--primary)",
                                    color: isMe ? "var(--primary)" : "#fff",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  ⬇ Open
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {/* Clean Footer Row: Timestamp + Read/Delivered/Sent Status + Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        fontSize: "0.7rem",
                        paddingTop: 2,
                        borderTop: isMe ? "1px solid rgba(255,255,255,0.14)" : "1px solid #f1f0f9",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ opacity: 0.85 }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isMe && (
                          <span
                            style={{
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 999,
                              background:
                                m.status === "read"
                                  ? "rgba(56, 189, 248, 0.25)"
                                  : "rgba(255, 255, 255, 0.14)",
                              color: m.status === "read" ? "#7dd3fc" : "rgba(255,255,255,0.88)",
                            }}
                          >
                            {m.status === "read"
                              ? "✓✓ Read"
                              : m.status === "delivered"
                              ? "✓✓ Delivered"
                              : "✓ Sent"}
                          </span>
                        )}
                      </span>
                      <span style={{ display: "flex", gap: 8, opacity: 0.85 }}>
                        <button
                          type="button"
                          onClick={() => setReplyTo(m)}
                          style={{ background: "none", border: "none", color: "inherit", fontSize: "0.7rem", fontWeight: 600 }}
                        >
                          Reply
                        </button>
                        {isMe && !m.is_deleted && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m.id)}
                            style={{ background: "none", border: "none", color: "inherit", fontSize: "0.7rem", fontWeight: 600 }}
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

          {/* @Mention Autocomplete Bar */}
          {mentionCandidates.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                borderTop: "1px solid var(--border)",
                padding: "8px 12px",
                display: "flex",
                gap: 8,
                overflowX: "auto",
              }}
            >
              {mentionCandidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => insertMention(p.username)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <UserAvatar src={p.profile_picture_url} name={p.full_name} size={20} />
                  <span>@{p.username}</span>
                </button>
              ))}
            </div>
          )}

          {replyTo && (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", padding: "6px 12px", background: "#eef0ff", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>↩ Replying to <strong>{replyTo.sender?.full_name || "message"}</strong>: {replyTo.content?.slice(0, 50) || "Attachment"}</span>
              <button type="button" onClick={() => setReplyTo(null)} style={{ border: "none", background: "none", color: "var(--danger)", fontWeight: 700 }}>✕</button>
            </div>
          )}

          {attachment && !voiceFile && (
            <div style={{ fontSize: "0.8rem", color: "var(--primary)", padding: "6px 12px", background: "#eef0ff", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📎 Ready to send: <strong>{attachment.name}</strong></span>
              <button type="button" onClick={() => setAttachment(null)} style={{ border: "none", background: "none", color: "var(--danger)", fontWeight: 700 }}>✕</button>
            </div>
          )}

          {voicePreviewUrl && !isRecording && (
            <div style={{ padding: "8px 12px", background: "#eef0ff", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)" }}>Voice note ready:</span>
              <audio controls src={voicePreviewUrl} style={{ height: 34, flex: 1, minWidth: 180 }} />
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={clearVoicePreview}>
                ✕ Discard
              </button>
            </div>
          )}

          {isRecording ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                borderTop: "1px solid var(--border)",
                padding: "10px 14px",
                background: "#fff1f2",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e11d48", fontWeight: 700, fontSize: "0.9rem" }}>
                <span>● Recording</span>
                <span>{formatDuration(recordSeconds)}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelRecording}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ borderRadius: 20 }}
                  onClick={stopRecording}
                >
                  Done
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
                title="Attach photo, video, PDF, Word, Excel, PowerPoint, or file"
              >
                <PaperclipIcon />
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  onChange={(e) => {
                    clearVoicePreview();
                    setAttachment(e.target.files?.[0] || null);
                  }}
                />
              </label>
              <input
                ref={inputRef}
                className="input"
                type="text"
                placeholder={voiceFile ? "Optional caption for voice note..." : "Message (type @ to tag someone)"}
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

      {/* Fullscreen Image & Video Lightbox */}
      {lightboxMedia && (
        <div className="modal-backdrop" onClick={() => setLightboxMedia(null)} style={{ zIndex: 120 }}>
          <div style={{ position: "relative", maxWidth: "94vw", maxHeight: "90vh", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxMedia(null)}
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
                zIndex: 2,
              }}
            >
              ✕
            </button>
            {lightboxMedia.type === "video" ? (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                playsInline
                style={{ maxWidth: "92vw", maxHeight: "82vh", borderRadius: 14, background: "#000", display: "block", margin: "0 auto" }}
              />
            ) : (
              <img
                src={lightboxMedia.url}
                alt="Full preview"
                style={{ maxWidth: "92vw", maxHeight: "82vh", borderRadius: 14, display: "block", margin: "0 auto" }}
              />
            )}
            <a
              href={lightboxMedia.url}
              download
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12, borderRadius: 999 }}
            >
              ⬇ Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
