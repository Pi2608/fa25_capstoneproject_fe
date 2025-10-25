/**
 * Clear first-time user flags and related data
 * Should be called when user logs out or when starting fresh registration
 */
export const clearFirstTimeFlags = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("is_first_time_user");
    localStorage.removeItem("user_email");
    localStorage.removeItem("account_type");
    localStorage.removeItem("org_name");
    localStorage.removeItem("org_plan");
    localStorage.removeItem("org_members");
    localStorage.removeItem("org_role");
    localStorage.removeItem("org_credits");
  }
};

/**
 * Clear registration data
 * Should be called when user starts new registration
 */
export const clearRegistrationData = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("reg_email");
    localStorage.removeItem("reg_name");
    localStorage.removeItem("reg_phone");
    localStorage.removeItem("reg_password");
    localStorage.removeItem("reg_otp");
  }
};

/**
 * Clear all auth-related data
 * Should be called when user logs out
 */
export const clearAllAuthData = () => {
  clearFirstTimeFlags();
  clearRegistrationData();
  
  if (typeof window !== "undefined") {
    // Clear any other auth-related data
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_data");
    localStorage.removeItem("organization_data");
  }
};

/**
 * Check if user is first-time user
 */
export const isFirstTimeUser = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("is_first_time_user") === "true";
};

/**
 * Set user as first-time user
 */
export const setFirstTimeUser = (email: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("is_first_time_user", "true");
    localStorage.setItem("user_email", email);
  }
};
