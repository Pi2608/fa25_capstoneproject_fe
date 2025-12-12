export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorShape {
  status: number;
  message: string;
}

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function getToken(): string | null {
  if (!isClient()) return null;
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthTokens(args: { accessToken?: string; refreshToken?: string }): void {
  if (!isClient()) return;

  const { accessToken, refreshToken } = args;

  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if ("refreshToken" in args) {
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  window.dispatchEvent(new Event("auth-changed"));
}

export function clearAuth(): void {
  if (!isClient()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

function getErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: "Yêu cầu không hợp lệ.",
    401: "Bạn chưa đăng nhập hoặc phiên đã hết hạn.",
    403: "Bạn không có quyền thực hiện hành động này.",
    404: "Không tìm thấy tài nguyên.",
    409: "Xung đột dữ liệu. Vui lòng thử lại.",
    422: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
    429: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  };

  if (status >= 500) return "Lỗi hệ thống. Vui lòng thử lại sau.";
  return messages[status] || `Yêu cầu thất bại (HTTP ${status}).`;
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractErrorMessage(body: unknown, status: number): string {
  if (!body || typeof body !== "object") return getErrorMessage(status);

  const obj = body as Record<string, unknown>;

  if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim();
  if (typeof obj.title === "string" && obj.title.trim()) return obj.title.trim();

  if (obj.errors && typeof obj.errors === "object") {
    const errors = obj.errors as Record<string, unknown>;
    const firstKey = Object.keys(errors)[0];
    const firstError = errors[firstKey];
    if (Array.isArray(firstError) && typeof firstError[0] === "string" && firstError[0].trim()) {
      return firstError[0].trim();
    }
    return getErrorMessage(400);
  }

  const message =
    (typeof obj.message === "string" && obj.message.trim()) ||
    (typeof obj.error === "string" && obj.error.trim()) ||
    (typeof obj.detail === "string" && obj.detail.trim()) ||
    "";

  return message || getErrorMessage(status);
}

function normalizeErrorMessage(response: Response, rawText: string): string {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json") && rawText) {
    const body = parseJson<unknown>(rawText);
    if (body) return extractErrorMessage(body, response.status);
  }

  if (!contentType.includes("application/json") && rawText) {
    const cleanText = rawText.replace(/<[^>]+>/g, "").trim();
    if (cleanText) {
      return cleanText.length > 180 ? cleanText.slice(0, 179) + "…" : cleanText;
    }
  }

  return getErrorMessage(response.status);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { method?: ApiMethod } = {}
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");
  }

  const token = getToken();
  const hasBody = typeof options.body !== "undefined";
  const isFormData = options.body instanceof FormData;

  const defaultHeaders: Record<string, string> = {
    Accept: "application/json",
  };

  if (hasBody && !isFormData) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  const headers = {
    ...defaultHeaders,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  const rawText = await response.text();

  if (!response.ok) {
    const message = normalizeErrorMessage(response, rawText);
    throw { status: response.status, message } as ApiErrorShape;
  }

  if (!rawText) {
    return undefined as unknown as T;
  }

  return parseJson<T>(rawText) as T;
}

export function fetchJSON<T>(path: string, init?: RequestInit & { method?: ApiMethod }): Promise<T> {
  return apiFetch<T>(path, init ?? { method: "GET" });
}

export function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: "GET" });
}

export function postJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit): Promise<TRes> {
  return apiFetch<TRes>(path, { ...init, method: "POST", body: JSON.stringify(body) });
}

export function putJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit): Promise<TRes> {
  return apiFetch<TRes>(path, { ...init, method: "PUT", body: JSON.stringify(body) });
}

export function delJson<TRes>(path: string, init?: RequestInit): Promise<TRes> {
  return apiFetch<TRes>(path, { ...init, method: "DELETE" });
}

export function patchJson<TReq, TRes>(path: string, body: TReq, init?: RequestInit): Promise<TRes> {
  return apiFetch<TRes>(path, { ...init, method: "PATCH", body: JSON.stringify(body) });
}

export function postFormData<TRes>(path: string, formData: FormData, init?: RequestInit): Promise<TRes> {
  return apiFetch<TRes>(path, { ...init, method: "POST", body: formData });
}