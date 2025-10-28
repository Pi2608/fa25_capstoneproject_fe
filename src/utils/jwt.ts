type JwtPayload = Record<string, unknown>;

export function parseToken(t: string | null): { userId: string | null; email: string | null } {
  if (!t) return { userId: null, email: null };
  const parts = t.split(".");
  if (parts.length !== 3) return { userId: null, email: null };
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    const p = JSON.parse(json) as JwtPayload;
    const email =
      (typeof p.email === "string" && p.email) ||
      (typeof p.Email === "string" && p.Email) ||
      (typeof p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] === "string" &&
        (p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] as string)) ||
      null;
    const userId =
      (typeof p.userId === "string" && p.userId) ||
      (typeof p.uid === "string" && p.uid) ||
      (typeof p.sub === "string" && p.sub) ||
      (typeof p.nameid === "string" && p.nameid) ||
      (typeof p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] === "string" &&
        (p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] as string)) ||
      null;
    return { userId, email };
  } catch {
    return { userId: null, email: null };
  }
}

// Deprecated: Use useAuth hook from AuthContext instead
export function getMyIdentityFromToken(): { userId?: string | null; email?: string | null } {
  if (typeof window === "undefined") return { userId: null, email: null };
  const token = localStorage.getItem("token");
  return parseToken(token);
}

