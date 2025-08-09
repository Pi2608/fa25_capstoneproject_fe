export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:5233";

type ApiInit = Omit<RequestInit, "body" | "headers"> & {
  headers?: Record<string, string>;
  body?: any;
};

function isFormLike(body: any) {
  return (
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    body instanceof ArrayBuffer ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
  );
}

export async function apiFetch<T = any>(path: string, options: ApiInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const isStringBody = typeof options.body === "string";
  const formLike = isFormLike(options.body);

  const headers: Record<string, string> = {
    ...(formLike ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const body =
    options.body == null
      ? undefined
      : formLike
      ? options.body
      : isStringBody
      ? options.body
      : JSON.stringify(options.body);

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: options.credentials ?? "omit",
    cache: "no-store",
    signal: options.signal,
    mode: options.mode,
    redirect: options.redirect,
    referrerPolicy: options.referrerPolicy,
  });

  if (res.status === 204) return undefined as T;

  const ctype = res.headers.get("content-type") || "";
  const isJson = ctype.includes("application/json");
  const parse = async () => (isJson ? await res.json() : await res.text());

  if (!res.ok) {
    try {
      const data = await parse();
      if (isJson) {
        const msg =
          (data as any)?.message ||
          (data as any)?.error ||
          (data as any)?.title ||
          res.statusText;
        throw new Error(msg);
      }
      throw new Error(typeof data === "string" && data ? data : `HTTP ${res.status}`);
    } catch (err) {
      throw new Error(res.statusText || `HTTP ${res.status}`);
    }
  }

  try {
    const data = await parse();
    return (isJson ? data : (data as unknown)) as T;
  } catch {
    return undefined as T;
  }
}
