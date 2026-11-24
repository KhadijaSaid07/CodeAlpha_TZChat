import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest, refreshAccessToken, setAccessToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarVersion, setAvatarVersion] = useState(Date.now());

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
        const token = await refreshAccessToken();
        if (token) {
          const me = await apiRequest("/api/auth/me/");
          setUser(me);
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
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    // Register account without auto-logging in so user sees success message & logs in
    return await apiRequest("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function logout() {
    try {
      await apiRequest("/api/auth/logout/", { method: "POST", body: JSON.stringify({}) });
    } finally {
      setAccessToken(null);
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
