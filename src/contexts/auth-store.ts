// src/contexts/auth-store.ts
"use client";

type Listener = () => void;

const TOKEN_KEY = "token";
const listeners = new Set<Listener>();

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export const authStore = {
  /** snapshot hiện tại (dùng cho useSyncExternalStore) */
  getSnapshot: () => !!readToken(),

  /** đăng ký lắng nghe mọi thay đổi liên quan đến auth/token */
  subscribe: (listener: Listener) => {
    listeners.add(listener);

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === TOKEN_KEY) listener();
    };
    const onAuthChanged = () => listener();                 // do mình phát ra khi set/clear token
    const onPageShow = () => listener();                    // khi khôi phục từ bfcache
    const onPopState = () => listener();                    // back/forward
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

  /** set hoặc xoá token + phát sự kiện cho toàn app */
  setToken: (token?: string) => {
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);

    // gọi tất cả subscriber + phát event cho nơi nào nghe event
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
