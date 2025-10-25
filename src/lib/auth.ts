import { clearAllAuthData } from "@/utils/authUtils";
import { clearAuth } from "./api";

/**
 * Logout function that clears all authentication data
 */
export const logout = () => {
  // Clear all auth-related data
  clearAllAuthData();
  clearAuth();
  
  // Redirect to login page
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("auth_token") !== null;
};

/**
 * Get auth token
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
};

/**
 * Set auth token
 */
export const setAuthToken = (token: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
};
