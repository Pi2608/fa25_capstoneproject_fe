import { clearAllAuthData } from "@/utils/authUtils";
import { clearAuth } from "./api-core";

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
 * Note: Use useAuth() hook from AuthContext instead
 */
export const isAuthenticated = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("token") !== null;
};

/**
 * Get auth token
 * Note: Use useAuth() hook from AuthContext instead
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

/**
 * Set auth token
 * Note: Use setToken() from useAuth() hook instead
 */
export const setAuthToken = (token: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
};
