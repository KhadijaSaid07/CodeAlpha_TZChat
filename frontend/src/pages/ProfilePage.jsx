import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest, apiUrl } from "../api/client";
import FollowButton from "../components/FollowButton";
import PostCard from "../components/PostCard";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function ProfilePage() {
  const { username } = useParams();
  const { user, refreshUser, bumpAvatarVersion } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isOwn = !username || username === user?.username;
  const targetUsername = isOwn ? user?.username : username;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [friends, setFriends] = useState([]);
  const [profileViews, setProfileViews] = useState([]);
  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", username: "", bio: "", location: "" });
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  async function loadProfile() {
    setError("");
    try {
      const endpoint = isOwn ? "/api/profiles/me/" : `/api/profiles/${targetUsername}/`;
      const pData = await apiRequest(endpoint);
      setProfile(pData);
      setEditForm({
        full_name: pData.full_name || "",
        username: pData.username || "",
        bio: pData.bio || "",
        location: pData.location || "",
      });

      const [postsRes, flwRes, flwingRes, frRes, viewsRes] = await Promise.all([
        apiRequest(`/api/posts/?username=${encodeURIComponent(pData.username)}`),
        apiRequest(`/api/follows/followers/${encodeURIComponent(pData.username)}/`),
        apiRequest(`/api/follows/following/${encodeURIComponent(pData.username)}/`),
        apiRequest(`/api/friends/user/${encodeURIComponent(pData.username)}/`),
        isOwn ? apiRequest("/api/profiles/me/views/") : Promise.resolve([]),
      ]);
      setPosts(postsRes.results || []);
      setFollowers(flwRes || []);
      setFollowing(flwingRes || []);
      setFriends(frRes || []);
      setProfileViews(viewsRes || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (targetUsername) loadProfile();
  }, [targetUsername]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      const updated = await apiRequest("/api/profiles/me/", {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setProfile(updated);
      await refreshUser();
      setEditing(false);
      showToast("Profile updated successfully!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleImageUpload(type, file) {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const updated = await apiRequest(`/api/profiles/me/${type}/`, {
        method: "POST",
        body: formData,
      });
      setProfile(updated);
      bumpAvatarVersion();
      await refreshUser();
      showToast(`${type === "avatar" ? "Profile picture" : "Cover image"} updated!`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleRemoveAvatar() {
    try {
      const updated = await apiRequest("/api/profiles/me/avatar/", { method: "DELETE" });
      setProfile(updated);
      bumpAvatarVersion();
      await refreshUser();
      showToast("Profile picture removed.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleAction(url, method = "POST", successText = "Action completed.", bodyData = null) {
    setError("");
    setStatusMsg("");
    try {
      const res = await apiRequest(url, {
        method,
        ...(bodyData ? { body: JSON.stringify(bodyData) } : {}),
      });
      const msg = res?.message || successText;
      setStatusMsg(msg);
      showToast(msg);
      loadProfile();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function handleStartChat() {
    try {
      const conv = await apiRequest(`/api/messaging/conversations/direct/${targetUsername}/`, {
        method: "POST",
      });
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      const msg = window.prompt(err.message + "\nSend a message request instead:", "Hi! Let's connect.");
      if (msg) {
        try {
          await apiRequest(`/api/messaging/requests/${targetUsername}/`, {
            method: "POST",
            body: JSON.stringify({ initial_message: msg }),
          });
          setStatusMsg("Message request sent!");
        } catch (reqErr) {
          setError(reqErr.message);
        }
      }
    }
  }

  if (error && !profile) {
    return <div className="card alert alert-error">{error}</div>;
  }
  if (!profile) {
    return <div className="card">Loading profile...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {statusMsg && <div className="alert alert-success">{statusMsg}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            height: 170,
            background: profile.cover_image_url
              ? `url(${apiUrl(profile.cover_image_url)}) center/cover`
              : "linear-gradient(120deg, #1877f2, #60a5fa)",
            position: "relative",
          }}
        >
          {isOwn && (
            <label className="btn btn-outline btn-sm" style={{ position: "absolute", right: 12, bottom: 12, background: "#fff" }}>
              Change Cover
              <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload("cover", e.target.files?.[0])} />
            </label>
          )}
        </div>

        <div style={{ padding: "0 20px 20px", marginTop: -40, position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <UserAvatar
              src={profile.profile_picture_url}
              name={profile.full_name || profile.username}
              size={84}
              style={{ border: "4px solid #fff" }}
            />

            {isOwn ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="btn btn-outline btn-sm">
                  Upload Photo
                  <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload("avatar", e.target.files?.[0])} />
                </label>
                {profile.profile_picture_url && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveAvatar}>
                    Remove Photo
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing((v) => !v)}>
                  Edit Profile
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <FollowButton username={targetUsername} initialStatus={profile.follow_status} onChanged={loadProfile} />
                <button
                  type="button"
                  className={`btn btn-sm ${profile.is_friend ? "btn-primary" : "btn-outline"}`}
                  disabled={Boolean(profile.is_friend)}
                  onClick={() => handleAction(`/api/friends/request/${targetUsername}/`, "POST", `Friend request sent to @${targetUsername}!`)}
                >
                  {profile.is_friend ? "✓ Friends" : "Add Friend"}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleStartChat}>
                  Message
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleAction(`/api/privacy/block/${targetUsername}/`, "POST", `Blocked @${targetUsername}.`)}>
                  Block
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    handleAction("/api/reports/", "POST", `Reported @${targetUsername} to moderators.`, {
                      category: "user",
                      reported_username: targetUsername,
                      reason: "Inappropriate account behavior",
                    })
                  }
                >
                  🚩 Report
                </button>
              </div>
            )}
          </div>

          <h2 style={{ marginTop: 10 }}>{profile.full_name}</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>@{profile.username}</p>
          {(profile.bio || profile.location) && (
            <p style={{ marginTop: 8 }}>
              {profile.bio} {profile.location && <span style={{ color: "var(--muted)" }}>· 📍 {profile.location}</span>}
            </p>
          )}

          <div style={{ display: "flex", gap: 18, marginTop: 14, fontWeight: 600, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab("posts")}>{posts.length} Posts</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab("followers")}>{followers.length} Followers</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab("following")}>{following.length} Following</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTab("friends")}>{friends.length} Friends</button>
          </div>
        </div>
      </div>

      {editing && isOwn && (
        <form className="card" onSubmit={handleSaveProfile} style={{ display: "grid", gap: 10 }}>
          <h3>Edit Profile</h3>
          <input
            className="input"
            placeholder="Full Name"
            value={editForm.full_name}
            onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Username"
            value={editForm.username}
            onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
          />
          <textarea
            className="input"
            rows={3}
            placeholder="Bio"
            value={editForm.bio}
            onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Location (e.g. Zanzibar, Tanzania)"
            value={editForm.location}
            onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { key: "posts", label: "Posts" },
          { key: "followers", label: `Followers (${followers.length})` },
          { key: "following", label: `Following (${following.length})` },
          { key: "friends", label: `Friends (${friends.length})` },
          ...(isOwn ? [{ key: "views", label: `Profile Views (${profileViews.length})` }] : []),
          { key: "about", label: "About" },
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

      {tab === "posts" && (
        posts.length === 0 ? (
          <div className="card" style={{ color: "var(--muted)" }}>No posts yet.</div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
          ))
        )
      )}

      {tab === "followers" && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Followers ({followers.length})</h3>
          {followers.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No followers yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {followers.map((f) => (
                <Link key={f.id} to={`/profile/${f.username}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit" }}>
                  <UserAvatar name={f.full_name} size={36} />
                  <div><strong>{f.full_name}</strong> <span style={{ color: "var(--muted)" }}>@{f.username}</span></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "following" && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Following ({following.length})</h3>
          {following.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Not following anyone yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {following.map((f) => (
                <Link key={f.id} to={`/profile/${f.username}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit" }}>
                  <UserAvatar name={f.full_name} size={36} />
                  <div><strong>{f.full_name}</strong> <span style={{ color: "var(--muted)" }}>@{f.username}</span></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "friends" && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Friends ({friends.length})</h3>
          {friends.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No friends yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {friends.map((f) => (
                <Link key={f.id} to={`/profile/${f.username}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit" }}>
                  <UserAvatar name={f.full_name} size={36} />
                  <div><strong>{f.full_name}</strong> <span style={{ color: "var(--muted)" }}>@{f.username}</span></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "views" && isOwn && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Who Viewed Your Profile ({profileViews.length})</h3>
          {profileViews.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No one has viewed your profile yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {profileViews.map((v) => (
                <Link key={v.id} to={`/profile/${v.username}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "inherit", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <UserAvatar src={v.profile_picture_url} name={v.full_name} size={36} />
                    <div><strong>{v.full_name}</strong> <span style={{ color: "var(--muted)" }}>@{v.username}</span></div>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{new Date(v.viewed_at).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "about" && (
        <div className="card">
          <h3>About</h3>
          <p style={{ marginTop: 8 }}><strong>Bio:</strong> {profile.bio || "Not set"}</p>
          <p style={{ marginTop: 4 }}><strong>Location:</strong> {profile.location || "Not set"}</p>
        </div>
      )}
    </div>
  );
}
