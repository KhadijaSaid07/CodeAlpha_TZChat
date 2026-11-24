import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import UserAvatar from "../../components/UserAvatar";
import { useToast } from "../../context/ToastContext";

export default function AdminPostsPage() {
  const { showToast, askConfirm } = useToast();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [postType, setPostType] = useState(searchParams.get("post_type") || "");
  const [visibility, setVisibility] = useState("");
  const [modStatus, setModStatus] = useState(searchParams.get("status") || "");
  const [error, setError] = useState("");

  async function loadPosts() {
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (postType) params.set("post_type", postType);
      if (visibility) params.set("visibility", visibility);
      if (modStatus) params.set("status", modStatus);
      const data = await apiRequest(`/api/admin-api/posts/?${params.toString()}`);
      setPosts(data.results || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setPostType(searchParams.get("post_type") || "");
    setModStatus(searchParams.get("status") || "");
  }, [searchParams]);

  useEffect(() => {
    loadPosts();
  }, [postType, visibility, modStatus]);

  async function handleTogglePost(post) {
    const nextRemoved = !post.is_removed;
    const ok = await askConfirm(`${nextRemoved ? "Remove" : "Restore"} Post #${post.id}?`);
    if (!ok) return;
    try {
      await apiRequest(`/api/admin-api/posts/${post.id}/moderate/`, {
        method: "POST",
        body: JSON.stringify({ is_removed: nextRemoved, reason: "Moderated by admin" }),
      });
      showToast(`Post #${post.id} ${nextRemoved ? "removed" : "restored"}!`);
      loadPosts();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2>📝 Post Management</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ width: 180 }} type="search" placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" style={{ width: "auto" }} value={postType} onChange={(e) => setPostType(e.target.value)}>
            <option value="">All Types</option>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          <select className="input" style={{ width: "auto" }} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="">All Visibility</option>
            <option value="public">Public</option>
            <option value="friends">Friends</option>
            <option value="private">Private</option>
          </select>
          <select className="input" style={{ width: "auto" }} value={modStatus} onChange={(e) => setModStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="removed">Removed</option>
          </select>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadPosts}>Filter</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No posts match this filter.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((p) => (
            <div key={p.id} className="card" style={{ opacity: p.is_removed ? 0.7 : 1, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserAvatar src={p.author?.profile_picture_url} name={p.author?.full_name} size={34} />
                  <div>
                    <strong>{p.author?.full_name}</strong> (@{p.author?.username})
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {new Date(p.created_at).toLocaleString()} · {p.post_type} · {p.visibility}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={p.is_removed ? "pill pill-red" : "pill pill-green"}>
                    {p.is_removed ? "Removed" : "Active"}
                  </span>
                  <button
                    type="button"
                    className={`btn btn-sm ${p.is_removed ? "btn-outline" : "btn-danger"}`}
                    onClick={() => handleTogglePost(p)}
                  >
                    {p.is_removed ? "Restore" : "Remove"}
                  </button>
                </div>
              </div>

              {p.content && <p>{p.content}</p>}
              {p.images?.map((img) => (
                <img key={img.id} src={img.image} alt="Post" style={{ maxHeight: 220, objectFit: "cover", borderRadius: 8 }} />
              ))}
              {p.videos?.map((vid) => (
                <video key={vid.id} src={vid.video} controls style={{ maxHeight: 220, borderRadius: 8 }} />
              ))}
              <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                ❤️ {p.likes_count} likes · 💬 {p.comments_count} comments
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
