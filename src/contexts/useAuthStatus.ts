"use client";

import { useSyncExternalStore } from "react";
import { authStore } from "@/contexts/auth-store";

export function useAuthStatus() {
  const isLoggedIn = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    () => false 
  );
  return {
    isLoggedIn,
    token: authStore.getToken(),
    setToken: authStore.setToken,
    clear: authStore.clear,
  };
}
