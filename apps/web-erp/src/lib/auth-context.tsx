"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // One-time hydration from localStorage, which only exists client-side —
    // this can't be a lazy useState initializer without breaking SSR, and
    // there's no external store to subscribe to beyond this single read.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = window.localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function login(phone: string, password: string) {
    const result = await api.post<LoginResponse>("/auth/login", { phone, password });
    window.localStorage.setItem("accessToken", result.accessToken);
    window.localStorage.setItem("refreshToken", result.refreshToken);
    window.localStorage.setItem("user", JSON.stringify(result.user));
    setUser(result.user);
  }

  function logout() {
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("refreshToken");
    window.localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
