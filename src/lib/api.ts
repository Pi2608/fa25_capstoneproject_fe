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

/** ===== Core fetch (auto Authorization, error normalization) ===== */
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
        if (hasString(body, "detail") || hasString(body, "title")) {
          const d = hasString(body, "detail") ? String(body.detail).trim() : "";
          const t = hasString(body, "title") ? String(body.title).trim() : "";
          return d || t || defaultByStatus(res.status);
        }
        if ("errors" in body && typeof body.errors === "object" && body.errors !== null) {
          const errorsObj = body.errors as Record<string, unknown>;
          const keys = Object.keys(errorsObj);
          if (keys.length) {
            const first = errorsObj[keys[0]];
            if (Array.isArray(first) && typeof first[0] === "string" && first[0].trim()) {
              return first[0].trim();
            }
          }
          return defaultByStatus(400);
        }
        if (hasString(body, "message") && String(body.message).trim()) {
          return String(body.message).trim();
        }
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

/** ===== TEMPLATES (không liên quan maps) ===== */
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

// ==== ACCESS TOOLS – USER (types “raw” từ BE) ====
export type RawAccessTool = {
  accessToolId?: number | string;
  accessToolName?: string;
  accessToolDescription?: string;
  iconUrl?: string;
  requiredMembership?: boolean;
};

export type RawUserAccessTool = {
  userAccessToolId?: number | string;
  id?: number | string;
  accessToolId?: number | string;
  accessTool?: RawAccessTool | null;
  expiredAt?: string;
  isActive?: boolean;
};

export type UserAccessTool = {
  id: string;
  accessToolId: string;
  name: string;
  description?: string;
  expiredAt: string;
  isActive: boolean;
  iconUrl?: string;
};

function mapUserAccessTool(raw: RawUserAccessTool): UserAccessTool {
  return {
    id: String(raw.userAccessToolId ?? raw.id ?? ""),
    accessToolId: String(raw.accessToolId ?? raw.accessTool?.accessToolId ?? ""),
    name: raw.accessTool?.accessToolName ?? "Unknown tool",
    description: raw.accessTool?.accessToolDescription,
    expiredAt: raw.expiredAt ?? "",
    isActive: typeof raw.isActive === "boolean" ? raw.isActive : true,
    iconUrl: raw.accessTool?.iconUrl,
  };
}

export async function getUserAccessTools(): Promise<UserAccessTool[]> {
  const data = await getJson<RawUserAccessTool[]>("/user-access-tool/get-all");
  return (data ?? []).map(mapUserAccessTool);
}

export async function getActiveUserAccessTools(): Promise<UserAccessTool[]> {
  const data = await getJson<RawUserAccessTool[]>("/user-access-tool/get-active");
  return (data ?? []).map(mapUserAccessTool);
}


/** ===== MEMBERSHIP ===== */
export type MembershipResponse = {
  membershipId: string;
  status: "active" | "expired" | "pending" | string;
};

function isApiError(x: unknown): x is ApiErrorShape {
  return Boolean(
    x &&
    typeof x === "object" &&
    "status" in x &&
    "message" in x &&
    typeof (x as { status: unknown }).status === "number" &&
    typeof (x as { message: unknown }).message === "string"
  );
}

function mentionsMissingBody(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("implicit body inferred") || m.includes("no body was provided");
}

function mentionsInvalidMembership(msg: string): boolean {
  return msg.toLowerCase().includes("invalid membership request");
}


export async function createOrRenewMembership(payload: { planId: number }) {
  try {
    return await postJson<typeof payload, MembershipResponse>(
      "/membership/create-or-renew",
      payload
    );
  } catch (err1: unknown) {
    if (!isApiError(err1)) throw err1;

    if (err1.status === 400 || err1.status === 422 || mentionsInvalidMembership(err1.message)) {
      const bodySnake = { plan_id: payload.planId };
      try {
        return await postJson<typeof bodySnake, MembershipResponse>(
          "/membership/create-or-renew",
          bodySnake
        );
      } catch (err2: unknown) {
        if (!isApiError(err2)) throw err2;

        if (mentionsMissingBody(err2.message)) {
          const url = `/membership/create-or-renew?planId=${encodeURIComponent(payload.planId)}`;
          return await apiFetch<MembershipResponse>(url, { method: "POST" });
        }
        throw err2;
      }
    }

    if (mentionsMissingBody(err1.message)) {
      const url = `/membership/create-or-renew?planId=${encodeURIComponent(payload.planId)}`;
      return await apiFetch<MembershipResponse>(url, { method: "POST" });
    }

    throw err1;
  }
}


/** ===== Forgot / Reset Password ===== */
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
  return postJson<ResetPasswordReq, ResetPasswordRes>("/auth/reset-password", req);
}

/** ===== Transactions / Payments ===== */
export type PaymentGateway = "PayOS" | "PayPal";

export type ProcessPaymentReq = {
  paymentGateway: PaymentGateway;
  total: number;
  purpose: string;
  membershipId?: string;
};

export type ApprovalUrlResponse = {
  approvalUrl: string;
  paymentGateway: PaymentGateway;
  sessionId?: string;
  paymentId?: string;
  orderCode?: string;
};

export function processPayment(req: ProcessPaymentReq) {
  return postJson<ProcessPaymentReq, ApprovalUrlResponse>("/transaction/process-payment", req);
}

export type ConfirmPaymentWithContextReq = {
  transactionId?: string;
  paymentGateway: PaymentGateway;
  paymentId?: string;
  orderCode?: string;
  signature?: string;
  purpose: string;
};

export function confirmPaymentWithContext(req: ConfirmPaymentWithContextReq) {
  return postJson<ConfirmPaymentWithContextReq, unknown>("/transaction/confirm-payment-with-context", req);
}

export type CancelPaymentWithContextReq = {
  paymentGateway: PaymentGateway;
  paymentId?: string;
  payerId?: string;
  token?: string;
  intent?: string;
  secret?: string;
  orderCode?: string;
  signature?: string;
  transactionId?: string;
};

export type CancelPaymentResponse = { status: string; gateway: string; };

export function cancelPaymentWithContext(req: CancelPaymentWithContextReq) {
  return postJson<CancelPaymentWithContextReq, CancelPaymentResponse>("/transaction/cancel-payment", req);
}

export type Transaction = {
  transactionId: string;
  amount: number;
  status: string;
  paymentGatewayId: string;
  purpose: string;
};

export function getTransactionById(id: string) {
  return getJson<Transaction>(`/transaction/${id}`);
}

/** =========================================================
 * ========== MAPS / TEMPLATES / LAYERS / FEATURES ==========
 * ======================================================= */

/* ---------- Map core ---------- */
export type Map = {
  id: string;
  name: string;
  ownerId: string;
  description?: string;
  createdAt: string;
};

export interface CreateMapRequest {
  mapName: string;
  description?: string;
  isPublic?: boolean;
}
export interface CreateMapResponse { mapId: string; }

export function createMap(body: CreateMapRequest) {
  return postJson<CreateMapRequest, CreateMapResponse>("/maps/", body);
}

export function getMapById(mapId: string) {
  return getJson<Map>(`/maps/${mapId}`);
}

export interface UpdateMapRequest {
  mapName?: string;
  description?: string;
  isPublic?: boolean;
}
export type UpdateMapResponse = Map;

export function updateMap(mapId: string, body: UpdateMapRequest) {
  return putJson<UpdateMapRequest, UpdateMapResponse>(`/maps/${mapId}`, body);
}

export interface DeleteMapResponse { deleted?: boolean }
export function deleteMap(mapId: string) {
  return delJson<DeleteMapResponse>(`/maps/${mapId}`);
}

export interface GetMyMapsResponse { maps: Map[] }
export async function getMyMaps(): Promise<Map[]> {
  const res = await getJson<GetMyMapsResponse | Map[]>("/maps/my");
  return Array.isArray(res) ? res : (res.maps ?? []);
}

export interface GetOrganizationMapsResponse { maps: Map[] }
export async function getOrganizationMaps(orgId: string): Promise<Map[]> {
  const res = await getJson<GetOrganizationMapsResponse | Map[]>(`/maps/organization/${orgId}`);
  return Array.isArray(res) ? res : (res.maps ?? []);
}

/* ---------- Map templates ---------- */
export interface MapTemplate {
  templateId: string;
  templateName: string;
  description: string;
  category: string; // enum -> string
  isPublic: boolean;
  previewImageUrl?: string | null;
  layerCount?: number | null;
  featureCount?: number | null;
}
export interface GetMapTemplatesResponse { templates: MapTemplate[]; }

export async function getMapTemplates(): Promise<MapTemplate[]> {
  const res = await getJson<GetMapTemplatesResponse | MapTemplate[]>("/maps/templates");
  return Array.isArray(res) ? res : (res.templates ?? []);
}

export type GetMapTemplateByIdResponse = MapTemplate;
export function getMapTemplateById(templateId: string) {
  return getJson<GetMapTemplateByIdResponse>(`/maps/templates/${templateId}`);
}

export interface MapTemplateWithDetails extends MapTemplate {
  layers?: Array<{ layerId: string; layerName: string; geometryType?: string }>;
}
export function getMapTemplateWithDetails(templateId: string) {
  return getJson<MapTemplateWithDetails>(`/maps/templates/${templateId}/details`);
}

export function getMapTemplateLayerData(templateId: string, layerId: string) {
  return getJson<{ layerData: unknown }>(`/maps/templates/${templateId}/layers/${layerId}/data`);
}

/** Tạo Map từ Template (auth) */
export interface CreateMapFromTemplateRequest {
  templateId: string;
  mapName?: string;
  description?: string;
  isPublic?: boolean;
}
export interface CreateMapFromTemplateResponse { mapId: string; }
export function createMapFromTemplate(body: CreateMapFromTemplateRequest) {
  return postJson<CreateMapFromTemplateRequest, CreateMapFromTemplateResponse>("/maps/from-template", body);
}

/** Upload GeoJSON -> tạo MapTemplate (auth, multipart) */
export interface CreateMapTemplateFromGeoJsonResult {
  templateId: string;
  message?: string;
  warning?: string | null;
}
export async function createMapTemplateFromGeoJson(args: {
  geoJsonFile: File;
  templateName?: string;
  description?: string;
  layerName?: string;
  category?: string;
  isPublic?: boolean;
}) {
  const form = new FormData();
  form.append("geoJsonFile", args.geoJsonFile);
  if (args.templateName) form.append("templateName", args.templateName);
  if (args.description) form.append("description", args.description);
  if (args.layerName) form.append("layerName", args.layerName);
  if (args.category) form.append("category", args.category);
  form.append("isPublic", String(!!args.isPublic));

  return apiFetch<CreateMapTemplateFromGeoJsonResult>("/maps/create-template", {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" }, // KHÔNG set Content-Type
  });
}

/* ---------- Map layers (auth) ---------- */
export interface AddLayerToMapRequest {
  layerId?: string;
  layerName?: string;
  sourceType?: string;
  styleJson?: unknown;
}
export interface AddLayerToMapResponse { mapLayerId: string; }

export function addLayerToMap(mapId: string, body: AddLayerToMapRequest) {
  return postJson<AddLayerToMapRequest, AddLayerToMapResponse>(`/maps/${mapId}/layers`, body);
}

export interface UpdateMapLayerRequest {
  layerName?: string;
  styleJson?: unknown;
  visible?: boolean;
  opacity?: number;
}
export interface UpdateMapLayerResponse { mapLayerId: string; }
export function updateMapLayer(mapId: string, layerId: string, body: UpdateMapLayerRequest) {
  return putJson<UpdateMapLayerRequest, UpdateMapLayerResponse>(`/maps/${mapId}/layers/${layerId}`, body);
}

export interface RemoveLayerFromMapResponse { removed?: boolean; }
export function removeLayerFromMap(mapId: string, layerId: string) {
  return delJson<RemoveLayerFromMapResponse>(`/maps/${mapId}/layers/${layerId}`);
}

/* ---------- Map sharing (auth) ---------- */
export interface ShareMapRequest {
  mapId: string;
  targetUserId: string;
  permission?: "View" | "Edit";
}
export interface ShareMapResponse { shared: boolean; }
export function shareMap(body: ShareMapRequest) {
  return postJson<ShareMapRequest, ShareMapResponse>("/maps/share", body);
}

export interface UnshareMapRequest { mapId: string; targetUserId: string; }
export interface UnshareMapResponse { removed: boolean; }
/** DELETE with body */
export function unshareMap(body: UnshareMapRequest) {
  return delJson<UnshareMapResponse>("/maps/share", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  } as RequestInit);
}

/* ---------- Map features (auth) ---------- */
export interface MapFeatureResponse {
  featureId: string;
  mapId: string;
  layerId?: string | null;
  category?: string | null;
  geometry?: unknown; // GeoJSON geometry
  properties?: Record<string, unknown>;
}

export interface CreateMapFeatureRequest {
  mapId?: string; // BE sẽ override từ route
  layerId?: string;
  category?: string;
  geometry: unknown; // GeoJSON geometry
  properties?: Record<string, unknown>;
}
export function createMapFeature(mapId: string, body: CreateMapFeatureRequest) {
  return postJson<CreateMapFeatureRequest, MapFeatureResponse>(`/maps/${mapId}/features`, body);
}

export function getMapFeatures(mapId: string) {
  return getJson<MapFeatureResponse[]>(`/maps/${mapId}/features`);
}

export function getMapFeaturesByCategory(mapId: string, category: string) {
  return getJson<MapFeatureResponse[]>(`/maps/${mapId}/features/by-category/${category}`);
}

export function getMapFeaturesByLayer(mapId: string, layerId: string) {
  return getJson<MapFeatureResponse[]>(`/maps/${mapId}/features/by-layer/${layerId}`);
}

export interface UpdateMapFeatureRequest {
  layerId?: string;
  category?: string;
  geometry?: unknown;
  properties?: Record<string, unknown>;
}
export function updateMapFeature(mapId: string, featureId: string, body: UpdateMapFeatureRequest) {
  return putJson<UpdateMapFeatureRequest, MapFeatureResponse>(`/maps/${mapId}/features/${featureId}`, body);
}

export function deleteMapFeature(mapId: string, featureId: string) {
  return delJson<{ deleted: boolean }>(`/maps/${mapId}/features/${featureId}`);
}
