/**
 * Core API utilities: token management, HTTP helpers, error handling
 */

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorShape {
  status: number;
  message: string;
}

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

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { method?: ApiMethod } = {}
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");

  const token = getToken();

  const hasBody = typeof options.body !== "undefined";
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const defaultHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${base}${path}`, {
    headers: {
      ...defaultHeaders,
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const rawText = await res.text();
  const ct = res.headers.get("content-type") || "";

  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  const defaultByStatus = (status: number) => {
    if (status === 400) return "Yêu cầu không hợp lệ.";
    if (status === 401) return "Bạn chưa đăng nhập hoặc phiên đã hết hạn.";
    if (status === 403) return "Bạn không có quyền thực hiện hành động này.";
    if (status === 404) return "Không tìm thấy tài nguyên.";
    if (status === 409) return "Xung đột dữ liệu. Vui lòng thử lại.";
    if (status === 422) return "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.";
    if (status === 429) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
    if (status >= 500) return "Lỗi hệ thống. Vui lòng thử lại sau.";
    return `Yêu cầu thất bại (HTTP ${status}).`;
  };

  const normalizeMessage = (): string => {
    function isRecord(v: unknown): v is Record<string, unknown> {
      return typeof v === "object" && v !== null;
    }
    function hasString(o: Record<string, unknown>, k: string): o is Record<string, string | unknown> {
      return k in o && typeof o[k] === "string";
    }
    function isStringArray(v: unknown): v is string[] {
      return Array.isArray(v) && v.every((x) => typeof x === "string");
    }
    function safeJsonParse<T = unknown>(text: string): T | null {
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    }

    if (ct.includes("application/json") && rawText) {
      const body = safeJsonParse<unknown>(rawText);
      if (isRecord(body)) {
        const bodyObj = body as Record<string, unknown>;

        const d = typeof bodyObj.detail === "string" ? bodyObj.detail.trim() : "";
        const t = typeof bodyObj.title === "string" ? bodyObj.title.trim() : "";
        if (d || t) return d || t || defaultByStatus(res.status);

        const maybeErrors = bodyObj.errors;
        if (typeof maybeErrors === "object" && maybeErrors !== null) {
          const errorsObj = maybeErrors as Record<string, unknown>;
          const keys = Object.keys(errorsObj);
          if (keys.length) {
            const first = errorsObj[keys[0]];
            if (Array.isArray(first) && typeof first[0] === "string" && first[0].trim()) {
              return first[0].trim();
            }
          }
          return defaultByStatus(400);
        }

        const msg =
          (typeof bodyObj.message === "string" && bodyObj.message.trim()) ? bodyObj.message.trim() :
            (typeof bodyObj.error === "string" && bodyObj.error.trim()) ? bodyObj.error.trim() :
              (typeof bodyObj.detail === "string" && bodyObj.detail.trim()) ? bodyObj.detail.trim() :
                "";
        if (msg) return msg;
      }
    }

    if (!ct.includes("application/json") && rawText) {
      const safe = rawText.replace(/<[^>]+>/g, "").trim();
      if (safe) return truncate(safe, 180);
    }

    return defaultByStatus(res.status);
  };

  if (!res.ok) {
    const message = normalizeMessage();
    const error: ApiErrorShape = { status: res.status, message };
    throw error;
  }

  if (!rawText) return undefined as unknown as T;
  return JSON.parse(rawText) as T;
}

export function fetchJSON<T>(
  path: string,
  init?: RequestInit & { method?: ApiMethod }
) {
  return apiFetch<T>(path, init ?? { method: "GET" });
}

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

export function patchJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit) {
  return apiFetch<TRes>(path, { ...(init ?? {}), method: "PATCH", body: JSON.stringify(body) });
}
