import { createContext, useContext, useEffect, useState } from "react";
import {
  apiRequest,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  setAccessToken,
  setRefreshToken,
} from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());

  function bumpAvatarVersion() {
    setAvatarVersion(Date.now());
  }

  async function refreshUser() {
    const me = await apiRequest("/api/auth/me/");
    setUser(me);
    return me;
  }

  useEffect(() => {
    async function restoreSession() {
      try {
        // First try existing persisted access token (avoids unnecessary refresh on reload)
        if (getAccessToken()) {
          try {
            const me = await apiRequest("/api/auth/me/");
            setUser(me);
            return;
          } catch {
            // Fall through to refresh
          }
        }
        const token = await refreshAccessToken();
        if (token) {
          const me = await apiRequest("/api/auth/me/");
          setUser(me);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  async function login(identifier, password) {
    const data = await apiRequest("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    setAccessToken(data.access);
    if (data.refresh) setRefreshToken(data.refresh);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    return await apiRequest("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function logout() {
    const currentRefresh = getRefreshToken();
    try {
      await apiRequest("/api/auth/logout/", {
        method: "POST",
        body: JSON.stringify(currentRefresh ? { refresh: currentRefresh } : {}),
      });
    } catch {
      // Always clear local session even if server request fails
    } finally {
      clearAuthTokens();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        register,
        logout,
        refreshUser,
        avatarVersion,
        bumpAvatarVersion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
