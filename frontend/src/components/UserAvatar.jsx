import { useEffect, useState } from "react";
import { getAccessToken } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function UserAvatar({
  src,
  name = "U",
  size = 40,
  style = {},
}) {
  const { avatarVersion } = useAuth();
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    async function loadProtectedAvatar() {
      if (!src) {
        setBlobUrl(null);
        return;
      }
      try {
        const token = getAccessToken();
        const separator = src.includes("?") ? "&" : "?";
        const res = await fetch(`${src}${separator}v=${avatarVersion}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (!res.ok) {
          if (active) setBlobUrl(null);
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setBlobUrl(objectUrl);
      } catch {
        if (active) setBlobUrl(null);
      }
    }

    loadProtectedAvatar();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, avatarVersion]);

  const initial = (name || "U").charAt(0).toUpperCase();

  return (
    <div
      className="avatar-circle"
      style={{
        width: size,
        height: size,
        fontSize: `${Math.max(0.85, size * 0.025)}rem`,
        ...style,
      }}
    >
      {blobUrl ? <img src={blobUrl} alt={name} /> : initial}
    </div>
  );
}
