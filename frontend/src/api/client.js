// Fetch API client with persistent JWT tokens (works reliably across Vercel + Render)
// and single-flight token refresh deduplication.

function normalizeApiBase(raw) {
  let base = (raw || "").trim().replace(/\/+$/, "");
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    base.startsWith("http://") &&
    !base.includes("localhost") &&
    !base.includes("127.0.0.1")
  ) {
    base = base.replace(/^http:\/\//, "https://");
  }
  return base;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

export function apiUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export function wsUrl(path) {
  if (API_BASE) {
    const wsBase = API_BASE.replace(/^http/, "ws");
    return `${wsBase}${path}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${path}`;
}

const ACCESS_KEY = "tzchat_access_token";
const REFRESH_KEY = "tzchat_refresh_token";

let accessToken = typeof window !== "undefined" ? localStorage.getItem(ACCESS_KEY) : null;
let refreshToken = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
let activeRefreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
  if (typeof window !== "undefined") {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    else localStorage.removeItem(ACCESS_KEY);
  }
}

export function setRefreshToken(token) {
  refreshToken = token || null;
  if (typeof window !== "undefined") {
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_KEY);
  }
}

export function clearAuthTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

async function refreshAccessToken() {
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
    try {
      const bodyPayload = refreshToken ? { refresh: refreshToken } : {};
      const res = await fetch(apiUrl("/api/auth/refresh/"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) {
        clearAuthTokens();
        return null;
      }
      const data = await res.json();
      if (data.access) setAccessToken(data.access);
      if (data.refresh) setRefreshToken(data.refresh);
      return accessToken;
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function apiRequest(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res;
  try {
    res = await fetch(apiUrl(path), {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    const err = new Error("Cannot reach server right now. Please check your connection and try again.");
    err.status = 0;
    throw err;
  }

  if (
    res.status === 401 &&
    retry &&
    !path.includes("/api/auth/login/") &&
    !path.includes("/api/auth/refresh/")
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest(path, options, false);
    }
  }

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message =
      data?.detail ||
      (data && typeof data === "object"
        ? Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ")
        : "Request failed");
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export { refreshAccessToken };
