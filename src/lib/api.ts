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

export type Plan = {
  planId: number;
  planName: string;
  description: string;
  priceMonthly: number;
};

export function getPlans() {
  return getJson<Plan[]>("/membership-plan/active");
}

export type Template = {
  id: string;
  title: string;
  tag: string;
  description?: string;
};

export function getTemplates() {
  return getJson<Template[]>("/templates");
}

export type MeRaw = {
  user: {
    userId: string
    email: string
    fullName: string
    phone?: string | null
    role: string
    accountStatus?: string | null
    createdAt?: string | null
    lastLogin?: string | null
  }
}

export type Me = {
  userId: string
  email: string
  fullName: string
  phone?: string | null
  role: string
  accountStatus?: string | null
  createdAt?: string | null
  lastLogin?: string | null
}

export async function getMe(): Promise<Me> {
  const r = await getJson<MeRaw | Me>("/user/me");
  if (r && typeof r === "object" && "user" in r) {
    return (r as MeRaw).user;
  }
  return r as Me;
}


export type CurrentMembershipDto = {
  membershipId: string
  userId: string
  orgId: string
  orgName: string
  planId: number
  planName: string
  startDate?: string | null
  endDate?: string | null
  status: string
  autoRenew?: boolean
  lastResetDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type GetCurrentMembershipResponse = { membership: CurrentMembershipDto }

export async function getMyMembership(orgId: string): Promise<CurrentMembershipDto | null> {
  const res = await getJson<GetCurrentMembershipResponse | CurrentMembershipDto>(
    `/user/me/membership/${orgId}`
  );
  if (res && typeof res === "object" && "membership" in res) {
    return (res as GetCurrentMembershipResponse).membership;
  }
  return res as CurrentMembershipDto;
}


export interface CurrentMembership {
  membershipId: string
  userId: string
  orgId: string
  orgName: string
  planId: number
  planName: string
  startDate: string
  endDate: string
  status: string
  autoRenew: boolean
}

export async function getMyOrgMembership(orgId: string) {
  return getJson<{ membership: CurrentMembership }>(`/user/me/membership/${orgId}`)
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

export type CancelPaymentWithContextReq = {
  paymentGateway: PaymentGateway;
  purpose?: {
    userId?: string;
    planId?: number;
    email?: string;
    [k: string]: unknown;
  };
  paymentId?: string;
  payerId?: string;
  token?: string;
  intent?: string;
  secret?: string;
  orderCode?: string;
  signature?: string;
  transactionId?: string;
};


export type CancelPaymentRes = {
  ok: boolean;
  message?: string;
};

export async function cancelPaymentWithContext(
  payload: CancelPaymentWithContextReq
) {
  console.log("cancelPaymentWithContext", payload);
  return postJson<CancelPaymentWithContextReq, CancelPaymentRes>(
    `/Transaction/cancel-payment-with-context?`,
    payload
  );
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
  const body = { plan_id: payload.planId };

  try {
    return await postJson<typeof body, MembershipResponse>(
      "/membership/create-or-renew",
      body
    );
  } catch (err) {
    if (!isApiError(err)) throw err;

    if (mentionsMissingBody(err.message)) {
      const url = `/membership/create-or-renew?planId=${encodeURIComponent(payload.planId)}`;
      return await apiFetch<MembershipResponse>(url, { method: "POST" });
    }

    throw err;
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


// ==== Transactions (PayPal) ====
// export interface ProcessPaymentReq {
//   paymentGateway: "PayPal" | "payOS";
//   purpose: "membership" | "order";
//   total?: number;           
//   currency?: string;        
//   returnUrl?: string;
//   successUrl: string;
//   cancelUrl: string;
//   context?: {
//     PlanId?: number; 
//     OrgId?: string;
//     AutoRenew?: boolean;
//     MembershipId?: string;
//     AddonKey?: string;
//     Quantity?: number;
//     UserId?: string;
//   };
// }

// ==== Transactions (PayOS) ====

export type PaymentGateway = "vnPay" | "payOS" | "stripe";
export type PaymentPurpose = "membership" | "order";
export interface ProcessPaymentReq {
  paymentGateway: PaymentGateway;
  purpose: PaymentPurpose;
  total?: number;
  PlanId?: number;
  UserId?: string;
  OrgId?: string;
  AutoRenew?: boolean;
  MembershipId?: string;
  AddonKey?: string;
  Quantity?: number;
}

// Response trả về khi tạo giao dịch
export interface ProcessPaymentRes {
  approvalUrl: string;
  transactionId?: string;
  provider?: string;

  paymentGateway?: PaymentGateway;
  sessionId: string;
  qrCode?: string;
  orderCode: string;
}

export function processPayment(body: ProcessPaymentReq) {
  return postJson<ProcessPaymentReq, ProcessPaymentRes>(
    "/transaction/process-payment",
    body
  );
}

export interface ConfirmPaymentReq {
  transactionId: string;
  token: string;
  payerId: string;
  paymentId: string;
}

export interface ConfirmPaymentRes {
  success: boolean;
  message?: string;
}

export function confirmPayment(body: ConfirmPaymentReq) {
  return postJson<ConfirmPaymentReq, ConfirmPaymentRes>(
    "/transaction/confirm-payment",
    body
  );
}

// export interface ConfirmPaymentWithContextReq {
//   transactionId: string;
//   token: string;
//   payerId: string;
//   paymentId: string;
//   paymentGateway: PaymentGateway;
//   purpose: PaymentPurpose;
//   membershipContext: {
//     userId: string;
//     planId: number;
//     email?: string;
//   };
// }

export interface ConfirmPaymentWithContextReq {
  paymentGateway: PaymentGateway,
  paymentId: string,
  orderCode: string,
  purpose: string,
  transactionId: string,
  userId: string,
  orgId: string,
  planId: number,
  autoRenew: true
}

export interface ConfirmPaymentWithContextRes {
  membershipId: string,
  transactionId: string,
  accessToolsGranted: true
}

export function confirmPaymentWithContext(body: ConfirmPaymentWithContextReq) {
  console.log("confirmPaymentWithContext", body);
  return postJson<ConfirmPaymentWithContextReq, ConfirmPaymentWithContextRes>(
    "/transaction/confirm-payment-with-context",
    body
  );
}

export function getTransactionById(transactionId: string) {
  return getJson(`/transaction/${transactionId}`);
}

export interface Transaction {
  transactionId: string;
  amount: number;
  status: string;
  purpose: string;
  paymentGatewayId?: string;
  transactionReference?: string;
  transactionDate?: string;
  createdAt?: string;
}


/** =========================================================
MAPS / TEMPLATES / LAYERS / FEATURES
*/
export type ViewState = { center: [number, number]; zoom: number };
export type BaseMapProvider = "OSM" | "Satellite" | "Dark";

// ==== MAPS ====
export interface CreateMapRequest {
  orgId?: string;
  name: string;
  description?: string;
  isPublic: boolean;
  initialLatitude: number;
  initialLongitude: number;
  initialZoom: number;
  baseMapProvider: BaseMapProvider;
}

export interface CreateMapResponse {
  mapId: string;
  message?: string;
  createdAt?: string;
}

export function createMap(req: CreateMapRequest) {
  const body = {
    OrgId: req.orgId,
    OrganizationId: req.orgId,
    orgId: req.orgId,
    Name: req.name,
    Description: req.description,
    IsPublic: req.isPublic,
    InitialLatitude: req.initialLatitude,
    InitialLongitude: req.initialLongitude,
    InitialZoom: req.initialZoom,
    BaseMapProvider: req.baseMapProvider,
  };
  console.log("createMap: ", body);
  return postJson<typeof body, CreateMapResponse>("/maps", body);
}

export type MapDto = {
  id: string;
  name: string;
  ownerId?: string;
  description?: string;
  createdAt: string;
};

export function getMapById(mapId: string) {
  return getJson<MapDto>(`/maps/${mapId}`);
}

export interface UpdateMapRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
  baseMapProvider?: BaseMapProvider;
  geographicBounds?: string;
  viewState?: string;
}
export interface UpdateMapResponse { message?: string; }
export function updateMap(mapId: string, body: UpdateMapRequest) {
  return putJson<UpdateMapRequest, UpdateMapResponse>(`/maps/${mapId}`, body);
}

export interface DeleteMapResponse { deleted?: boolean }
export function deleteMap(mapId: string) {
  return delJson<DeleteMapResponse>(`/maps/${mapId}`);
}

export interface GetMyMapsResponse { maps: MapDto[] }
export async function getMyMaps(): Promise<MapDto[]> {
  const res = await getJson<GetMyMapsResponse | MapDto[]>("/maps/my");
  return Array.isArray(res) ? res : (res.maps ?? []);
}

export interface GetOrganizationMapsResponse { maps: MapDto[] }
export async function getOrganizationMaps(orgId: string): Promise<MapDto[]> {
  const res = await getJson<GetOrganizationMapsResponse | MapDto[]>(`/maps/organization/${orgId}`);
  return Array.isArray(res) ? res : (res.maps ?? []);
}

// ==== Map detail types ====
export interface RawLayer {
  id: string;
  name: string;
  layerTypeId: number;
  layerTypeName: string;
  layerTypeIcon: string;
  sourceName: string;
  filePath: string;
  layerData: string;
  layerStyle: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string | null;
  ownerId: string;
  ownerName: string;
  mapLayerId: string;
  isVisible: boolean;
  zIndex: number;
  layerOrder: number;
  customStyle: string;
  filterConfig: string;
}

export interface MapDetail {
  id: string;
  mapName: string;
  description?: string;
  baseMapProvider: BaseMapProvider;
  initialLatitude: number;
  initialLongitude: number;
  initialZoom: number;
  layers: RawLayer[];
}

type MapDetailRawWrapped = {
  map: {
    id: string;
    name: string;
    description?: string | null;
    baseMapProvider: BaseMapProvider;
    initialLatitude: number;
    initialLongitude: number;
    initialZoom: number;
    layers: RawLayer[];
  };
};

export async function getMapDetail(mapId: string): Promise<MapDetail> {
  const res = await getJson<MapDetailRawWrapped | MapDetail>(`/maps/${mapId}`);

  if (res && typeof res === "object" && "map" in res) {
    const m = (res as MapDetailRawWrapped).map;
    return {
      id: m.id,
      mapName: m.name,
      description: m.description ?? "",
      baseMapProvider: m.baseMapProvider,
      initialLatitude: m.initialLatitude,
      initialLongitude: m.initialLongitude,
      initialZoom: m.initialZoom,
      layers: m.layers,
    };
  }

  return res as MapDetail;
}

/* ---------- TEMPLATES ---------- */
export interface MapTemplate {
  templateId: string;
  templateName: string;
  description: string;
  category: string;
  isPublic: boolean;
  previewImageUrl?: string | null;
  layerCount?: number | null;
  featureCount?: number | null;
}

export interface MapTemplateLayer {
  layerId: string;
  layerName: string;
  featureCount?: number;
}

export interface MapTemplateDetails extends MapTemplate {
  layers: MapTemplateLayer[];
  annotations?: unknown[];
  images?: string[];
}

export interface GetMapTemplatesResponse {
  templates: MapTemplate[];
}

export async function getMapTemplates(): Promise<MapTemplate[]> {
  const res = await getJson<GetMapTemplatesResponse | MapTemplate[]>("/maps/templates");
  return Array.isArray(res) ? res : (res.templates ?? []);
}

export function getMapTemplateById(templateId: string) {
  return getJson<MapTemplate>(`/maps/templates/${templateId}`);
}

export function getMapTemplateWithDetails(templateId: string) {
  return getJson<MapTemplateDetails>(`/maps/templates/${templateId}/details`);
}

export function getMapTemplateLayerData(templateId: string, layerId: string) {
  return getJson<{ layerData: unknown }>(`/maps/templates/${templateId}/layers/${layerId}/data`);
}

export interface CreateMapFromTemplateRequest {
  templateId: string;
  mapName?: string;
  description?: string;
  isPublic?: boolean;
}

export interface CreateMapFromTemplateResponse {
  mapId: string;
}

export function createMapFromTemplate(body: CreateMapFromTemplateRequest) {
  return postJson<CreateMapFromTemplateRequest, CreateMapFromTemplateResponse>(
    "/maps/from-template",
    body
  );
}

export interface CreateMapTemplateResponse {
  templateId: string;
  message?: string;
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
  async function formDataToObject(form: FormData) {
    const obj: Record<string, string | { name: string; size: number; type: string }> = {};
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        obj[key] = {
          name: value.name,
          size: value.size,
          type: value.type,
        };
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }
  
  return apiFetch<CreateMapTemplateResponse>("/maps/create-template", {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
}

export type FavoriteTemplate = {
  templateId: string;
  favoriteAt?: string;
};

export async function getMyFavoriteTemplates(): Promise<string[]> {
  const res = await getJson<{ templates: FavoriteTemplate[] } | FavoriteTemplate[]>(
    "/user-favorite-templates/my"
  );
  if (Array.isArray(res)) return res.map(x => x.templateId);
  return res.templates?.map(x => x.templateId) ?? [];
}

export async function toggleFavoriteTemplate(templateId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    await postJson<{ templateId: string }, { ok?: boolean }>("/user-favorite-templates", { templateId });
  } else {
    await delJson<{ ok?: boolean }>(`/user-favorite-templates/${templateId}`);
  }
}

/* ---------- LAYERS ---------- */
export interface AddLayerToMapRequest {
  layerId: string;
  isVisible?: boolean;
  zIndex?: number;
  customStyle?: string | null;
  filterConfig?: string | null;
}
export interface AddLayerToMapResponse { mapLayerId: string; }
export function addLayerToMap(mapId: string, body: AddLayerToMapRequest) {
  return postJson<AddLayerToMapRequest, AddLayerToMapResponse>(`/maps/${mapId}/layers`, body);
}

export interface UpdateMapLayerRequest {
  isVisible?: boolean | null;
  zIndex?: number | null;
  customStyle?: string | null;
  filterConfig?: string | null;
}

export interface UpdateMapLayerResponse { message?: string; }

export function updateMapLayer(mapId: string, layerId: string, body: UpdateMapLayerRequest) {
  return putJson<UpdateMapLayerRequest, UpdateMapLayerResponse>(`/maps/${mapId}/layers/${layerId}`, body);
}

export interface RemoveLayerFromMapResponse { message?: string; }

export function removeLayerFromMap(mapId: string, layerId: string) {
  return delJson<RemoveLayerFromMapResponse>(`/maps/${mapId}/layers/${layerId}`);
}

/* ---------- SHARE ---------- */
export interface ShareMapRequest { mapId: string; targetUserId: string; permission?: "View" | "Edit"; }
export interface ShareMapResponse { shared: boolean; }
export function shareMap(mapId: string, body: ShareMapRequest) {
  return postJson<ShareMapRequest, ShareMapResponse>(`/maps/${mapId}/share`, body);
}
export interface UnshareMapRequest { mapId: string; targetUserId: string; }
export interface UnshareMapResponse { removed: boolean; }
export function unshareMap(mapId: string, body: UnshareMapRequest) {
  return delJson<UnshareMapResponse>(`/maps/${mapId}/share`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  } as RequestInit);
}

/* ---------- FEATURES ---------- */
export interface MapFeatureResponse {
  featureId: string;
  mapId: string;
  layerId?: string | null;
  name?: string | null;
  description?: string | null;
  featureCategory: "Data" | "Annotation";
  annotationType?: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video" | null;
  geometryType: "Point" | "LineString" | "Polygon" | "Circle";
  coordinates: string;
  properties?: string | null;
  style?: string | null;
  isVisible: boolean;
  zIndex: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateMapFeatureRequest {
  layerId?: string | null;
  name?: string | null;
  description?: string | null;
  featureCategory: "Data" | "Annotation";
  annotationType?: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video" | null;
  geometryType: "Point" | "LineString" | "Polygon" | "Circle";
  coordinates: string;
  properties?: string | null;
  style?: string | null;
  isVisible?: boolean | null;
  zIndex?: number | null;
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
  name?: string | null;
  description?: string | null;
  featureCategory?: "Data" | "Annotation" | null;
  annotationType?: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video" | null;
  geometryType?: "Point" | "LineString" | "Polygon" | "Circle" | null;
  coordinates?: string | null;
  properties?: string | null;
  style?: string | null;
  isVisible?: boolean | null;
  zIndex?: number | null;
  layerId?: string | null;
}
export function updateMapFeature(mapId: string, featureId: string, body: UpdateMapFeatureRequest) {
  return putJson<UpdateMapFeatureRequest, MapFeatureResponse>(`/maps/${mapId}/features/${featureId}`, body);
}
export function deleteMapFeature(mapId: string, featureId: string) {
  return delJson<{ deleted: boolean }>(`/maps/${mapId}/features/${featureId}`);
}

export function getMapFeatureById(mapId: string, featureId: string) {
  return getJson<MapFeatureResponse>(`/maps/${mapId}/features/${featureId}`);
}

export type OrganizationReqDto = {

  orgName: string;
  abbreviation: string;
  description?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
};

export type OrganizationResDto = { result?: string };

export type OrganizationDetailDto = {
  orgId: string;
  orgName: string;
  abbreviation: string;
  description?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  createdAt?: string;
  isActive?: boolean;
};

export type GetAllOrganizationsResDto = { organizations: OrganizationDetailDto[] };
export type GetOrganizationByIdResDto = { organization: OrganizationDetailDto };
export type UpdateOrganizationResDto = { result?: string };
export type DeleteOrganizationResDto = { result?: string };

export type MyOrganizationDto = {
  orgId: string;
  orgName: string;
  abbreviation: string;
  myRole: "Owner" | "Admin" | "Member" | string;
  joinedAt?: string;
  logoUrl?: string | null;
};
export type GetMyOrganizationsResDto = { organizations: MyOrganizationDto[] };

export type InvitationDto = {
  invitationId: string;
  orgId: string;
  orgName: string;
  email: string;
  inviterEmail: string;
  memberType: "Admin" | "Member" | "Viewer" | string;
  invitedAt: string;
  isAccepted: boolean;
  acceptedAt?: string | null;
};
export type GetInvitationsResDto = { invitations: InvitationDto[] };

export type MemberDto = {
  memberId: string;
  email: string;
  fullName: string;
  role: "Owner" | "Admin" | "Member" | "Viewer" | string;
  joinedAt: string;
  isActive: boolean;
};
export type GetOrganizationMembersResDto = { members: MemberDto[] };

export type InviteMemberOrganizationReqDto = {
  orgId: string;
  memberEmail: string;
  memberType: "Admin" | "Member" | "Viewer" | string;
};
export type InviteMemberOrganizationResDto = { result?: string };

export type AcceptInviteOrganizationReqDto = { invitationId: string };
export type AcceptInviteOrganizationResDto = { result?: string };

export type RejectInviteOrganizationReqDto = { invitationId: string };
export type RejectInviteOrganizationResDto = { result?: string };

export type CancelInviteOrganizationReqDto = { invitationId: string };
export type CancelInviteOrganizationResDto = { result?: string };

export type UpdateMemberRoleReqDto = {
  orgId: string;
  memberId: string;
  newRole: "Owner" | "Admin" | "Member" | "Viewer" | string;
};
export type UpdateMemberRoleResDto = { result?: string };

export type RemoveMemberReqDto = { orgId: string; memberId: string };
export type RemoveMemberResDto = { result?: string };

export type TransferOwnershipReqDto = { orgId: string; newOwnerId: string };
export type TransferOwnershipResDto = { result?: string };

/* ------------------ CRUD Organization ------------------ */
export function createOrganization(body: OrganizationReqDto) {
  return postJson<OrganizationReqDto, OrganizationResDto>("/organizations", body);
}
export function getOrganizations() {
  return getJson<GetAllOrganizationsResDto>("/organizations");
}
export function getOrganizationById(orgId: string) {
  return getJson<GetOrganizationByIdResDto>(`/organizations/${orgId}`);
}
export function updateOrganization(orgId: string, body: OrganizationReqDto) {
  return putJson<OrganizationReqDto, UpdateOrganizationResDto>(`/organizations/${orgId}`, body);
}
export function deleteOrganization(orgId: string) {
  return delJson<DeleteOrganizationResDto>(`/organizations/${orgId}`);
}

/* ------------------ My orgs & invitations ------------------ */
export function getMyOrganizations() {
  return getJson<GetMyOrganizationsResDto>("/organizations");
}
export function getMyInvitations() {
  return getJson<GetInvitationsResDto>("/organizations/my-invitations");
}

/* ------------------ Members ------------------ */
export function getOrganizationMembers(orgId: string) {
  return getJson<GetOrganizationMembersResDto>(`/organizations/${orgId}/members`);
}
export function updateMemberRole(body: UpdateMemberRoleReqDto) {
  return apiFetch<UpdateMemberRoleResDto>("/organizations/members/role", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export function removeMember(body: RemoveMemberReqDto) {
  return delJson<RemoveMemberResDto>("/organizations/members/remove", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  } as RequestInit);
}

/* ------------------ Invitations ops ------------------ */
export function inviteMember(body: InviteMemberOrganizationReqDto) {
  return postJson<InviteMemberOrganizationReqDto, InviteMemberOrganizationResDto>(
    "/organizations/invite-member",
    body
  );
}
export function acceptInvite(body: AcceptInviteOrganizationReqDto) {
  return postJson<AcceptInviteOrganizationReqDto, AcceptInviteOrganizationResDto>(
    "/organizations/accept-invite",
    body
  );
}
export function rejectInvite(body: RejectInviteOrganizationReqDto) {
  return postJson<RejectInviteOrganizationReqDto, RejectInviteOrganizationResDto>(
    "/organizations/invites/reject",
    body
  );
}
export function cancelInvite(body: CancelInviteOrganizationReqDto) {
  return postJson<CancelInviteOrganizationReqDto, CancelInviteOrganizationResDto>(
    "/organizations/invites/cancel",
    body
  );
}

/* ------------------ Transfer ownership ------------------ */
export function transferOwnership(body: TransferOwnershipReqDto) {
  return postJson<TransferOwnershipReqDto, TransferOwnershipResDto>(
    "/organizations/transfer-ownership",
    body
  );
}

export type FaqItem = {
  faqId: number;
  question: string;
  answer: string;
  category: string;
  createdAt: string;
};

export async function searchFaqs(q: string): Promise<FaqItem[]> {
  const res = await getJson<FaqItem[] | { items: FaqItem[] }>(`/faqs/search?q=${encodeURIComponent(q)}`);
  return Array.isArray(res) ? res : (res.items ?? []);
}

export async function getFaqSuggestions(limit = 8): Promise<string[]> {
  try {
    const res = await getJson<FaqItem[] | { items: FaqItem[] }>(`/faqs?limit=${limit}`);
    const arr = Array.isArray(res) ? res : (res.items ?? []);
    return arr.slice(0, limit).map((x) => x.question);
  } catch {
    return [];
  }
}

export type AIMessage = { role: "user" | "assistant" | "system"; content: string };
export type AIAnswer = { answer: string };

export async function askAI(messages: AIMessage[]): Promise<string | null> {
  const aiBase = process.env.NEXT_PUBLIC_AI_ENDPOINT?.replace(/\/+$/, "");
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  const url = aiBase ? `${aiBase}/chat` : `${base}/ai/chat`;
  try {
    const res = await apiFetch<AIAnswer>(url.replace(/([^:]\/)\/+/g, "$1"), {
      method: "POST",
      body: JSON.stringify({ messages }),
      headers: { "Content-Type": "application/json" },
    });
    return res?.answer ?? null;
  } catch {
    return null;
  }
}
