import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import UserAvatar from "./UserAvatar";

export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth();
  const { showToast, askConfirm } = useToast();
  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("Inappropriate content");

  const isOwner = user?.id === post.author?.id;

  async function toggleLike() {
    if (liking) return;
    setLiking(true);
    try {
      if (liked) {
        await apiRequest(`/api/posts/${post.id}/like/`, { method: "DELETE" });
        setLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
      } else {
        await apiRequest(`/api/posts/${post.id}/like/`, { method: "POST" });
        setLiked(true);
        setLikesCount((c) => c + 1);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLiking(false);
    }
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      try {
        const data = await apiRequest(`/api/posts/${post.id}/comments/`);
        setComments(data);
        setCommentsLoaded(true);
      } catch (err) {
        showToast(err.message, "error");
      }
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const payload = { content: commentText.trim() };
      if (replyTarget) payload.parent = replyTarget.id;

      const created = await apiRequest(`/api/posts/${post.id}/comments/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setComments((prev) => [...prev, created]);
      setCommentsCount((c) => c + 1);
      setCommentText("");
      setReplyTarget(null);
      showToast(replyTarget ? "Reply added!" : "Comment added!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeleteComment(commentId) {
    const ok = await askConfirm("Delete this comment?");
    if (!ok) return;
    try {
      await apiRequest(`/api/posts/comments/${commentId}/`, { method: "DELETE" });
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent !== commentId));
      setCommentsCount((c) => Math.max(0, c - 1));
      showToast("Comment deleted.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDeletePost() {
    const ok = await askConfirm("Are you sure you want to delete this post?");
    if (!ok) return;
    try {
      await apiRequest(`/api/posts/${post.id}/`, { method: "DELETE" });
      showToast("Post deleted successfully.");
      if (onDeleted) onDeleted(post.id);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleReportSubmit(e) {
    e.preventDefault();
    try {
      await apiRequest("/api/reports/", {
        method: "POST",
        body: JSON.stringify({ reported_post: post.id, reason: reportReason }),
      });
      setReporting(false);
      showToast("Report submitted to moderators.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const topComments = comments.filter((c) => !c.parent);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent) {
      acc[c.parent] = acc[c.parent] || [];
      acc[c.parent].push(c);
    }
    return acc;
  }, {});

  return (
    <article className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Link to={`/profile/${post.author?.username}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit" }}>
          <UserAvatar src={post.author?.profile_picture_url} name={post.author?.full_name || post.author?.username} size={42} />
          <div>
            <div style={{ fontWeight: 700 }}>
              {post.author?.full_name}{" "}
              {post.feeling && (
                <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "0.88rem" }}>
                  is feeling {post.feeling}
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              @{post.author?.username} · {new Date(post.created_at).toLocaleString()} · {post.visibility}
            </div>
          </div>
        </Link>

        <div style={{ display: "flex", gap: 6 }}>
          {isOwner ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleDeletePost} title="Delete post">
              🗑️
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting((r) => !r)} title="Report post">
              🚩
            </button>
          )}
        </div>
      </div>

      {reporting && (
        <form onSubmit={handleReportSubmit} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input className="input" value={reportReason} onChange={(e) => setReportReason(e.target.value)} required />
          <button type="submit" className="btn btn-danger btn-sm">Report</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting(false)}>Cancel</button>
        </form>
      )}

      {post.content && <p style={{ marginBottom: 10, whiteSpace: "pre-wrap" }}>{post.content}</p>}

      {post.images?.map((img) => (
        <div key={img.id} style={{ marginBottom: 10 }}>
          <img
            src={img.image}
            alt={img.caption || "Post attachment"}
            style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 10 }}
          />
          {img.caption && <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>{img.caption}</p>}
        </div>
      ))}

      {post.videos?.map((vid) => (
        <div key={vid.id} style={{ marginBottom: 10 }}>
          <video
            src={vid.video}
            controls
            style={{ width: "100%", maxHeight: 420, borderRadius: 10, background: "#000" }}
          />
          {vid.caption && <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>{vid.caption}</p>}
        </div>
      ))}

      <div style={{ display: "flex", gap: 16, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleLike} disabled={liking}>
          {liked ? "❤️" : "🤍"} {likesCount} Like{likesCount === 1 ? "" : "s"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleComments}>
          💬 {commentsCount} Comment{commentsCount === 1 ? "" : "s"}
        </button>
      </div>

      {showComments && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          {replyTarget && (
            <div style={{ fontSize: "0.82rem", color: "var(--primary)", marginBottom: 6 }}>
              Replying to @{replyTarget.author?.username}{" "}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyTarget(null)}>✕</button>
            </div>
          )}

          <form onSubmit={handleAddComment} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              className="input"
              type="text"
              placeholder={replyTarget ? `Reply to @${replyTarget.author?.username}...` : "Write a comment..."}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">Send</button>
          </form>

          {topComments.length === 0 ? (
            <p style={{ fontSize: "0.88rem", color: "var(--muted)" }}>No comments yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {topComments.map((c) => (
                <div key={c.id}>
                  <div style={{ background: "var(--bg)", padding: "8px 12px", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "0.88rem" }}>@{c.author?.username}</strong>{" "}
                      <span style={{ fontSize: "0.9rem" }}>{c.content}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyTarget(c)}>
                        Reply
                      </button>
                      {c.author?.id === user?.id && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteComment(c.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested replies */}
                  {(repliesByParent[c.id] || []).map((rep) => (
                    <div
                      key={rep.id}
                      style={{
                        marginLeft: 24,
                        marginTop: 6,
                        background: "#f8fafc",
                        borderLeft: "2px solid var(--primary)",
                        padding: "6px 10px",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "0.84rem" }}>@{rep.author?.username}</strong>{" "}
                        <span style={{ fontSize: "0.88rem" }}>{rep.content}</span>
                      </div>
                      {rep.author?.id === user?.id && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteComment(rep.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
