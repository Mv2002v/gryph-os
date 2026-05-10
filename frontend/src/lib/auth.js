import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ss_user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ss_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        localStorage.setItem("ss_user", JSON.stringify(r.data));
      })
      .catch(() => {
        localStorage.removeItem("ss_token");
        localStorage.removeItem("ss_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setSession = (token, u) => {
    localStorage.setItem("ss_token", token);
    localStorage.setItem("ss_user", JSON.stringify(u));
    setUser(u);
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setSession(data.token, data.user);
    return data.user;
  };

  const signup = async (email, password, name) => {
    const { data } = await api.post("/auth/signup", { email, password, name });
    setSession(data.token, data.user);
    return data.user;
  };

  const demo = async () => {
    throw new Error("Demo bypass disabled");
  };

  const logout = () => {
    localStorage.removeItem("ss_token");
    localStorage.removeItem("ss_user");
    setUser(null);
  };

  const updateMe = async (patch) => {
    const { data } = await api.put("/auth/me", patch);
    setUser(data);
    localStorage.setItem("ss_user", JSON.stringify(data));
    return data;
  };

  return (
    <AuthCtx.Provider
      value={{ user, loading, login, signup, demo, logout, updateMe }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
