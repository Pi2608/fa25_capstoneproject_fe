"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  logout: () => void;
}

const LS_TOKEN_KEY = "token";
const LS_USER_KEY = "auth_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(LS_TOKEN_KEY);
      const storedUserRaw = localStorage.getItem(LS_USER_KEY);
      if (storedToken) setToken(storedToken);
      if (storedUserRaw) {
        const parsed = JSON.parse(storedUserRaw) as User;
        if (parsed && parsed.id) setUser(parsed);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      if (token) localStorage.setItem(LS_TOKEN_KEY, token);
      else localStorage.removeItem(LS_TOKEN_KEY);
    } catch {}
  }, [token]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(LS_USER_KEY);
    } catch {}
  }, [user]);

  const logout = () => {
    try {
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.removeItem(LS_USER_KEY);
    } catch {}
    setUser(null);
    setToken(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoggedIn: !!token,
      setUser,
      setToken,
      logout,
    }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
