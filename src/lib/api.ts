export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorShape {
  status: number;
  message: string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { method?: ApiMethod } = {}
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");

  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
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
    } catch {}
    const error: ApiErrorShape = { status: res.status, message };
    throw error;
  }

  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

export function getJson<T>(path: string, init?: RequestInit) {
  return apiFetch<T>(path, { ...(init ?? {}), method: "GET" });
}

export function postJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit) {
  return apiFetch<TRes>(path, {
    ...(init ?? {}),
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function putJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit) {
  return apiFetch<TRes>(path, {
    ...(init ?? {}),
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function delJson<TRes>(path: string, init?: RequestInit) {
  return apiFetch<TRes>(path, { ...(init ?? {}), method: "DELETE" });
}

// Types commonly used by auth screens; adjust to your backend if needed
export type LoginRequest = { email: string; password: string };
export type LoginResponse = { accessToken: string; refreshToken?: string };
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
