"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { parseToken } from "@/utils/jwt";

export interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  userId: string | null;
  userEmail: string | null;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  logout: () => void;
}

const LS_TOKEN_KEY = "token";
const LS_USER_KEY = "auth_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStorage<T>(key: string, parser?: (value: string) => T | null): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;
    return parser ? parser(value) : (value as T);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    return;
  }
}

function getInitialToken(): string | null {
  return readStorage<string>(LS_TOKEN_KEY);
}

function getInitialUser(): User | null {
  return readStorage<User>(LS_USER_KEY, (value) => {
    try {
      const parsed = JSON.parse(value) as User;
      return parsed?.id ? parsed : null;
    } catch {
      return null;
    }
  });
}

function extractIdentity(token: string | null) {
  if (!token) return { userId: null, userEmail: null };
  try {
    const { userId, email } = parseToken(token);
    return { userId, userEmail: email };
  } catch {
    return { userId: null, userEmail: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialToken = getInitialToken();
  const initialIdentity = extractIdentity(initialToken);

  const [user, setUserState] = useState<User | null>(getInitialUser);
  const [token, setTokenState] = useState<string | null>(initialToken);
  const [userId, setUserId] = useState<string | null>(initialIdentity.userId);
  const [userEmail, setUserEmail] = useState<string | null>(initialIdentity.userEmail);

  const updateIdentityFromToken = useCallback((newToken: string | null) => {
    const identity = extractIdentity(newToken);
    setUserId(identity.userId);
    setUserEmail(identity.userEmail);
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      const newToken = readStorage<string>(LS_TOKEN_KEY);
      if (newToken !== token) {
        setTokenState(newToken);
        updateIdentityFromToken(newToken);
        if (!newToken) {
          setUserState(null);
          writeStorage(LS_USER_KEY, null);
        }
      }
    };

    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, [token, updateIdentityFromToken]);

  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken);
    updateIdentityFromToken(newToken);
    if (!newToken) {
      setUserState(null);
      writeStorage(LS_USER_KEY, null);
    }
  }, [updateIdentityFromToken]);

  const setUser = useCallback((newUser: User | null) => {
    setUserState(newUser);
    writeStorage(LS_USER_KEY, newUser ? JSON.stringify(newUser) : null);
  }, []);

  const logout = useCallback(() => {
    writeStorage(LS_TOKEN_KEY, null);
    writeStorage(LS_USER_KEY, null);
    window.dispatchEvent(new Event("auth-changed"));
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoggedIn: !!token,
      userId,
      userEmail,
      setUser,
      setToken,
      logout,
    }),
    [user, token, userId, userEmail, setUser, setToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}