import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { ImageIcon, VideoIcon } from "../components/NavIcons";
import PostCard from "../components/PostCard";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function HomePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [postFilter, setPostFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Post composer state
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [imageFile, setImageFile] = useState(null);
  const [imageCaption, setImageCaption] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoCaption, setVideoCaption] = useState("");
  const [posting, setPosting] = useState(false);

  async function loadFeed() {
    setLoading(true);
    try {
      const feedData = await apiRequest("/api/posts/");
      setPosts(feedData.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
  }, []);

  async function handleCreatePost(e) {
    e.preventDefault();
    if (!content.trim() && !imageFile && !videoFile) {
      showToast("Please write something or choose a photo/video first.", "error");
      return;
    }
    setError("");
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("visibility", visibility);
      if (imageFile) {
        formData.append("image", imageFile);
        formData.append("image_caption", imageCaption);
      }
      if (videoFile) {
        formData.append("video", videoFile);
        formData.append("video_caption", videoCaption);
      }

      const created = await apiRequest("/api/posts/", {
        method: "POST",
        body: formData,
      });
      setPosts((prev) => [created, ...prev]);
      setContent("");
      setImageFile(null);
      setImageCaption("");
      setVideoFile(null);
      setVideoCaption("");
      showToast("Post published!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setPosting(false);
    }
  }

  const visiblePosts = posts.filter((p) => {
    if (postFilter === "text") return !p.images?.length && !p.videos?.length;
    if (postFilter === "image") return (p.images?.length || 0) > 0;
    if (postFilter === "video") return (p.videos?.length || 0) > 0;
    return true;
  });

  return (
    <div style={{ maxWidth: 740, margin: "0 auto", display: "grid", gap: 14 }}>
      {/* Clean Post Composer */}
      <section className="card">
        <form onSubmit={handleCreatePost}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <UserAvatar src={user?.profile_picture_url} name={user?.full_name || user?.username} size={42} />
            <textarea
              className="input"
              rows={2}
              placeholder={`What's on your mind, ${user?.full_name?.split(" ")[0] || ""}?`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {imageFile && (
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <div style={{ fontSize: "0.84rem", color: "var(--primary)", fontWeight: 600 }}>
                Photo selected: {imageFile.name}{" "}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setImageFile(null); setImageCaption(""); }}>✕</button>
              </div>
              <input
                className="input"
                type="text"
                placeholder="Write a caption for this photo (optional)"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
              />
            </div>
          )}

          {videoFile && (
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <div style={{ fontSize: "0.84rem", color: "var(--primary)", fontWeight: 600 }}>
                Video selected: {videoFile.name}{" "}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVideoFile(null); setVideoCaption(""); }}>✕</button>
              </div>
              <input
                className="input"
                type="text"
                placeholder="Write a caption for this video (optional)"
                value={videoCaption}
                onChange={(e) => setVideoCaption(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <label className="composer-pill" style={{ position: "relative", overflow: "hidden" }}>
                <ImageIcon />
                <span>Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </label>
              <label className="composer-pill" style={{ position: "relative", overflow: "hidden" }}>
                <VideoIcon />
                <span>Video</span>
                <input
                  type="file"
                  accept="video/*"
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                />
              </label>
              <select
                className="input"
                style={{ width: "auto", padding: "6px 12px", fontSize: "0.84rem", borderRadius: 999 }}
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="private">Private</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ borderRadius: 999, padding: "8px 20px" }}
              disabled={posting || (!content.trim() && !imageFile && !videoFile)}
            >
              {posting ? "Publishing..." : "Publish"}
            </button>
          </div>
        </form>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Clean Post Filter Tabs (no counts) */}
      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 14px" }}>
        {[
          { key: "all", label: "All" },
          { key: "text", label: "Text" },
          { key: "image", label: "Photos" },
          { key: "video", label: "Videos" },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            className={`btn btn-sm ${postFilter === f.key ? "btn-primary" : "btn-ghost"}`}
            style={{ borderRadius: 999, padding: "7px 16px" }}
            onClick={() => setPostFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ color: "var(--muted)" }}>Loading feed...</div>
      ) : visiblePosts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>
          {postFilter === "all"
            ? "No posts yet. Share your first post or follow people in Explore!"
            : `No ${postFilter === "image" ? "photo" : postFilter} posts yet.`}
        </div>
      ) : (
        visiblePosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          />
        ))
      )}
    </div>
  );
}
