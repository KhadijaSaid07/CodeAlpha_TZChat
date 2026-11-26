// Lightweight Fetch API client with automatic JWT refresh via HttpOnly cookie

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

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken() {
  try {
    const res = await fetch(apiUrl("/api/auth/refresh/"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = await res.json();
    accessToken = data.access;
    return accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

export async function apiRequest(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry && !path.includes("/api/auth/login/") && !path.includes("/api/auth/refresh/")) {
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
