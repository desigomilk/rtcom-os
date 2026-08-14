import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type LoginResult } from "../api/client";

interface AuthState {
  user: LoginResult["user"] | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResult["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync("user").then((stored) => {
      if (stored) setUser(JSON.parse(stored));
      setLoading(false);
    });
  }, []);

  async function login(phone: string, password: string) {
    const result = await api.post<LoginResult>("/auth/login", { phone, password });
    await SecureStore.setItemAsync("accessToken", result.accessToken);
    await SecureStore.setItemAsync("refreshToken", result.refreshToken);
    await SecureStore.setItemAsync("user", JSON.stringify(result.user));
    setUser(result.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("user");
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
