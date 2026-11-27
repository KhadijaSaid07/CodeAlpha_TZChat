import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import FollowButton from "../components/FollowButton";
import { ImageIcon, VideoIcon } from "../components/NavIcons";
import PostCard from "../components/PostCard";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const FEELINGS = ["", "happy 😊", "excited 🎉", "grateful 🙏", "blessed ✨", "coding 💻"];

export default function HomePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [postFilter, setPostFilter] = useState("all");
  const [suggested, setSuggested] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Post composer state
  const [content, setContent] = useState("");
  const [feeling, setFeeling] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [imageFile, setImageFile] = useState(null);
  const [imageCaption, setImageCaption] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoCaption, setVideoCaption] = useState("");
  const [posting, setPosting] = useState(false);

  async function loadFeed() {
    setLoading(true);
    try {
      const [feedData, peopleData, groupData] = await Promise.all([
        apiRequest("/api/posts/"),
        apiRequest("/api/explore/users/"),
        apiRequest("/api/groups/"),
      ]);
      setPosts(feedData.results || []);
      setSuggested((peopleData || []).slice(0, 5));
      setGroups((groupData || []).slice(0, 4));
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
      formData.append("feeling", feeling);
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
      setFeeling("");
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

  async function handleFollow(username) {
    try {
      await apiRequest(`/api/follows/follow/${username}/`, { method: "POST" });
      setSuggested((prev) => prev.filter((u) => u.username !== username));
      showToast(`Followed @${username}!`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const initial = (user?.full_name || user?.username || "U").charAt(0).toUpperCase();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 20 }} className="home-grid">
      <div>
        {/* Post Composer */}
        <section className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreatePost}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <UserAvatar src={user?.profile_picture_url} name={user?.full_name || user?.username} size={40} />
              <textarea
                className="input"
                rows={2}
                placeholder={`What's on your mind, ${user?.full_name?.split(" ")[0] || ""}?`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            {imageFile && (
              <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                <div style={{ fontSize: "0.85rem", color: "var(--primary)" }}>
                  📷 Selected image: {imageFile.name}{" "}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setImageFile(null); setImageCaption(""); }}>✕</button>
                </div>
                <input
                  className="input"
                  type="text"
                  placeholder="Write an explanation or caption for this picture (optional)"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                />
              </div>
            )}

            {videoFile && (
              <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                <div style={{ fontSize: "0.85rem", color: "var(--primary)" }}>
                  🎥 Selected video: {videoFile.name}{" "}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVideoFile(null); setVideoCaption(""); }}>✕</button>
                </div>
                <input
                  className="input"
                  type="text"
                  placeholder="Write an explanation or caption for this video (optional)"
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
                  style={{ width: "auto", padding: "6px 10px", fontSize: "0.84rem", borderRadius: 999 }}
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value)}
                >
                  <option value="">Feeling</option>
                  {FEELINGS.filter(Boolean).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  className="input"
                  style={{ width: "auto", padding: "6px 10px", fontSize: "0.84rem", borderRadius: 999 }}
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
                style={{ borderRadius: 999, padding: "8px 18px" }}
                disabled={posting || (!content.trim() && !imageFile && !videoFile)}
              >
                {posting ? "Posting..." : "Publish"}
              </button>
            </div>
          </form>
        </section>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Post Type Filter Bar (All / Text / Photos / Videos) */}
        <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 14px", marginBottom: 14 }}>
          {[
            { key: "all", label: `All (${posts.length})` },
            {
              key: "text",
              label: `Text (${posts.filter((p) => !p.images?.length && !p.videos?.length).length})`,
            },
            {
              key: "image",
              label: `Photos (${posts.filter((p) => p.images?.length > 0).length})`,
            },
            {
              key: "video",
              label: `Videos (${posts.filter((p) => p.videos?.length > 0).length})`,
            },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn btn-sm ${postFilter === f.key ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: 999 }}
              onClick={() => setPostFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card">Loading feed...</div>
        ) : (() => {
          const visiblePosts = posts.filter((p) => {
            if (postFilter === "text") return !p.images?.length && !p.videos?.length;
            if (postFilter === "image") return (p.images?.length || 0) > 0;
            if (postFilter === "video") return (p.videos?.length || 0) > 0;
            return true;
          });
          return visiblePosts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
              {postFilter === "all"
                ? "No posts yet. Share your first post or follow people in Explore!"
                : `No ${postFilter} posts yet.`}
            </div>
          ) : (
            visiblePosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))
          );
        })()}
      </div>

      {/* Right Sidebar */}
      <aside className="home-right" style={{ display: "grid", gap: 16, height: "fit-content" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3>Suggested People</h3>
            <Link to="/explore" style={{ fontSize: "0.85rem" }}>See all →</Link>
          </div>
          {suggested.length === 0 ? (
            <p style={{ fontSize: "0.88rem", color: "var(--muted)" }}>No suggestions right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {suggested.map((person) => (
                <div key={person.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <Link to={`/profile/${person.username}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", minWidth: 0 }}>
                    <UserAvatar src={person.profile_picture_url} name={person.full_name} size={34} />
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {person.full_name}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>@{person.username}</div>
                    </div>
                  </Link>
                  <FollowButton username={person.username} initialStatus={person.follow_status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3>Your Groups</h3>
            <Link to="/groups" style={{ fontSize: "0.85rem" }}>See all →</Link>
          </div>
          {groups.length === 0 ? (
            <p style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
              No groups yet. <Link to="/groups">Create one</Link>
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {groups.map((g) => (
                <Link key={g.id} to="/groups" style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "inherit" }}>
                  <span style={{ fontWeight: 600 }}>{g.name}</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{g.members_count} members</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
