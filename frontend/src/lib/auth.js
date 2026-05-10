import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "@/lib/api";

const AuthCtx = createContext(null);

const STORAGE_USER_KEY = "ss_user";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || "null");
  } catch (e) {
    console.warn("Could not parse stored user", e);
    return null;
  }
}

function writeStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  } catch (e) {
    console.warn("Could not persist user", e);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const validateSession = useCallback(async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
      writeStoredUser(r.data);
    } catch (e) {
      // 401 → clear stale display state
      writeStoredUser(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  const setSessionUser = useCallback((u) => {
    writeStoredUser(u);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/auth/login", { email, password });
      setSessionUser(data.user);
      return data.user;
    },
    [setSessionUser]
  );

  const signup = useCallback(
    async (email, password, name) => {
      const { data } = await api.post("/auth/signup", { email, password, name });
      setSessionUser(data.user);
      return data.user;
    },
    [setSessionUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      console.warn("Logout request failed", e);
    }
    writeStoredUser(null);
    setUser(null);
  }, []);

  const updateMe = useCallback(
    async (patch) => {
      const { data } = await api.put("/auth/me", patch);
      setSessionUser(data);
      return data;
    },
    [setSessionUser]
  );

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, logout, updateMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
