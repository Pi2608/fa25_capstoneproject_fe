// src/lib/api.ts

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorShape {
  status: number;
  message: string;
}

/** ===== Auth storage helpers ===== */
const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAuthTokens(args: { accessToken?: string; token?: string; refreshToken?: string }) {
  if (typeof window === "undefined") return;
  const t = args.accessToken ?? args.token;
  if (t) localStorage.setItem(ACCESS_TOKEN_KEY, t);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);

  if ("refreshToken" in args) {
    const r = args.refreshToken;
    if (r) localStorage.setItem(REFRESH_TOKEN_KEY, r);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  window.dispatchEvent(new Event("auth-changed"));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

/** ===== Core fetch (auto Authorization) ===== */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { method?: ApiMethod } = {}
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");

  const token = getToken();

  const res = await fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = (await res.json()) as Partial<ApiErrorShape> | unknown;
      if (typeof data === "object" && data && "message" in (data as Record<string, unknown>)) {
        const msg = (data as { message?: unknown }).message;
        if (typeof msg === "string") message = msg;
      }
    } catch { }
    const error: ApiErrorShape = { status: res.status, message };
    throw error;
  }

  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

/** ===== JSON helpers ===== */
export function getJson<T>(path: string, init?: RequestInit) {
  return apiFetch<T>(path, { ...(init ?? {}), method: "GET" });
}

export function postJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit) {
  return apiFetch<TRes>(path, { ...(init ?? {}), method: "POST", body: JSON.stringify(body) });
}

export function putJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit) {
  return apiFetch<TRes>(path, { ...(init ?? {}), method: "PUT", body: JSON.stringify(body) });
}

export function delJson<TRes>(path: string, init?: RequestInit) {
  return apiFetch<TRes>(path, { ...(init ?? {}), method: "DELETE" });
}

/** ===== AUTH ===== */
export type LoginRequest = { email: string; password: string };
export type LoginResponse = { accessToken?: string; token?: string; refreshToken?: string };

export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type RegisterResponse = { userId: string };

export function login(req: LoginRequest) {
  return postJson<LoginRequest, LoginResponse>("/auth/login", req);
}

export function register(req: RegisterRequest) {
  return postJson<RegisterRequest, RegisterResponse>("/auth/register", req);
}

/** ===== PLANS ===== */
export type Plan = {
  planId: number;
  planName: string;
  description: string;
  priceMonthly: number;
};

export function getPlans() {
  return getJson<Plan[]>("/membership-plan/active");
}

/** ===== TEMPLATES ===== */
export type Template = {
  id: string;
  title: string;
  tag: string;
  description?: string;
};

export function getTemplates() {
  return getJson<Template[]>("/templates");
}

/** ===== USERS ===== */
export type User = {
  userId: string;
  email: string;
  fullName?: string;
  role: string;
};

export function getUsers() {
  return getJson<User[]>("/users");
}

/** ===== MAPS ===== */
export type Map = {
  id: string;
  name: string;
  ownerId: string;
  description?: string;
  createdAt: string;
};

export function getMapById(id: string) {
  return getJson<Map>(`/maps/${id}`);
}

/** ===== EXPORTS ===== */
export type ExportRequest = {
  mapId: string;
  format: "pdf" | "png" | "geojson";
};

export type ExportResponse = {
  url: string;
  exportId: string;
};

export function createExport(req: ExportRequest) {
  return postJson<ExportRequest, ExportResponse>("/exports", req);
}

/** ===== ACCESS TOOLS – USER ===== */
export type UserAccessTool = {
  id: string;
  accessToolId: string;
  name: string;
  description?: string;
  expiredAt: string;
  isActive: boolean;
};

export function getUserAccessTools() {
  return getJson<UserAccessTool[]>("/user-access-tool/get-all");
}

export function getActiveUserAccessTools() {
  return getJson<UserAccessTool[]>("/user-access-tool/get-active");
}

/** ===== MEMBERSHIP ===== */
export type MembershipResponse = {
  membershipId: string;
  status: "active" | "expired" | "pending" | string;
};

export function createOrRenewMembership(payload: { planId: number }) {
  return postJson<typeof payload, MembershipResponse>("/membership/create-or-renew", payload);
}

// ==== Forgot / Reset Password ====

export type ResetPasswordVerifyReq = { email: string };
export type ResetPasswordVerifyRes = { message?: string };

export function resetPasswordVerify(req: ResetPasswordVerifyReq) {
  return postJson<ResetPasswordVerifyReq, ResetPasswordVerifyRes>(
    "/auth/reset-password-verify",
    req
  );
}

export type ResetPasswordReq = {
  otp: string;
  newPassword: string;
  confirmPassword: string;
};
export type ResetPasswordRes = { message?: string };

export function resetPassword(req: ResetPasswordReq) {
  return postJson<ResetPasswordReq, ResetPasswordRes>(
    "/auth/reset-password",
    req
  );
}