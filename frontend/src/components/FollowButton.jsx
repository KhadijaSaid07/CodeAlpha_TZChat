import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function FollowButton({ username, initialStatus = "none", onChanged }) {
  const { showToast, askConfirm } = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(initialStatus || "none");
  }, [initialStatus]);

  async function handleClick() {
    if (busy || !username) return;
    setBusy(true);
    try {
      if (status === "accepted" || status === "pending") {
        const ok = await askConfirm(`Do you want to unfollow @${username}?`);
        if (!ok) {
          setBusy(false);
          return;
        }
        await apiRequest(`/api/follows/unfollow/${username}/`, { method: "DELETE" });
        setStatus("none");
        showToast(`Unfollowed @${username}.`);
        if (onChanged) onChanged("none");
      } else {
        const res = await apiRequest(`/api/follows/follow/${username}/`, { method: "POST" });
        const nextStatus = res.status || "accepted";
        setStatus(nextStatus);
        showToast(nextStatus === "pending" ? `Follow request sent to @${username}.` : `You are now following @${username}!`);
        if (onChanged) onChanged(nextStatus);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const label =
    status === "accepted"
      ? "Following"
      : status === "pending"
      ? "Requested"
      : "Follow";

  const btnClass =
    status === "accepted" || status === "pending" ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm";

  return (
    <button type="button" className={btnClass} onClick={handleClick} disabled={busy}>
      {label}
    </button>
  );
}
