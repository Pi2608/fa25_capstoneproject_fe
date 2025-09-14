"use client";

type Listener = () => void;

const TOKEN_KEY = "token";
const listeners = new Set<Listener>();

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export const authStore = {
  getSnapshot: () => !!readToken(),

  subscribe: (listener: Listener) => {
    listeners.add(listener);

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === TOKEN_KEY) listener();
    };
    const onAuthChanged = () => listener();               
    const onPageShow = () => listener();                   
    const onPopState = () => listener();                    
    const onVisible = () => {
      if (document.visibilityState === "visible") listener();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", onAuthChanged as EventListener);
    window.addEventListener("pageshow", onPageShow as EventListener);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", onAuthChanged as EventListener);
      window.removeEventListener("pageshow", onPageShow as EventListener);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("visibilitychange", onVisible);
    };
  },

  setToken: (token?: string) => {
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);

    listeners.forEach((l) => l());
    window.dispatchEvent(new Event("auth-changed"));
  },

  getToken: readToken,
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    listeners.forEach((l) => l());
    window.dispatchEvent(new Event("auth-changed"));
  },
};
