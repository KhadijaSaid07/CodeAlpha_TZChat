import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import FollowButton from "../components/FollowButton";
import PostCard from "../components/PostCard";
import UserAvatar from "../components/UserAvatar";
import { useToast } from "../context/ToastContext";

const INITIAL_PEOPLE_COUNT = 6;
const PEOPLE_STEP = 8;

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [users, setUsers] = useState([]);
  const [visiblePeople, setVisiblePeople] = useState(INITIAL_PEOPLE_COUNT);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function runSearch(q) {
    setLoading(true);
    try {
      const [uData, pData] = await Promise.all([
        apiRequest(`/api/explore/users/?q=${encodeURIComponent(q)}`),
        apiRequest(`/api/explore/posts/?q=${encodeURIComponent(q)}`),
      ]);
      setUsers(uData || []);
      setVisiblePeople(INITIAL_PEOPLE_COUNT);
      setPosts(pData.results || []);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setQuery(q);
    runSearch(q);
  }, [searchParams]);

  function handleSearch(e) {
    e.preventDefault();
    setSearchParams(query.trim() ? { q: query.trim() } : {});
  }

  async function handleStartMessage(username) {
    try {
      const conv = await apiRequest(`/api/messaging/conversations/direct/${username}/`, {
        method: "POST",
      });
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      try {
        await apiRequest(`/api/messaging/requests/${username}/`, {
          method: "POST",
          body: JSON.stringify({ initial_message: "Hi! Let's connect on TZChat." }),
        });
        showToast(`Message request sent to @${username}!`);
      } catch (reqErr) {
        showToast(reqErr.message || err.message, "error");
      }
    }
  }

  const shownUsers = users.slice(0, visiblePeople);
  const hasMorePeople = users.length > visiblePeople;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 16 }}>
      <div className="card">
        <h2 style={{ marginBottom: 10 }}>Explore TZChat</h2>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 10 }}>
          <input
            className="input"
            type="search"
            placeholder="Search people by name/username or public posts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
      </div>

      {loading ? (
        <div className="card" style={{ color: "var(--muted)" }}>Searching...</div>
      ) : (
        <>
          <section className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>People</h3>
              {users.length > INITIAL_PEOPLE_COUNT && (
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Showing {shownUsers.length} of {users.length}
                </span>
              )}
            </div>
            {users.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No matching public users found.</p>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  {shownUsers.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 10,
                        paddingBottom: 10,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <Link to={`/profile/${u.username}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", minWidth: 0 }}>
                        <UserAvatar src={u.profile_picture_url} name={u.full_name} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                          <div style={{ fontSize: "0.84rem", color: "var(--muted)" }}>@{u.username}</div>
                        </div>
                      </Link>
                      <div style={{ display: "flex", gap: 8 }}>
                        <FollowButton username={u.username} initialStatus={u.follow_status} />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => handleStartMessage(u.username)}>
                          Message
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {users.length > INITIAL_PEOPLE_COUNT && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
                    {hasMorePeople && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ borderRadius: 999, padding: "7px 18px" }}
                        onClick={() => setVisiblePeople((c) => c + PEOPLE_STEP)}
                      >
                        View More People ({users.length - shownUsers.length} more)
                      </button>
                    )}
                    {visiblePeople > INITIAL_PEOPLE_COUNT && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ borderRadius: 999 }}
                        onClick={() => setVisiblePeople(INITIAL_PEOPLE_COUNT)}
                      >
                        Show Less
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          <section>
            <h3 style={{ marginBottom: 10 }}>Public Posts</h3>
            {posts.length === 0 ? (
              <div className="card" style={{ color: "var(--muted)" }}>No public posts found.</div>
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}
