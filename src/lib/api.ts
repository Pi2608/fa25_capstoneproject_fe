import { Workspace, WorkspaceAccess } from "@/types/workspace";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiErrorShape {
  status: number;
  message: string;
}

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const STORYMAP_PREFIX = "/story-map";
const POI_PREFIX = "/points-of-interest";

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

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const response = await postJson<LoginRequest, LoginResponse>("/auth/login", req);
  
  if (response.token ) {
    setAuthTokens({
      token: response.token,
      refreshToken: response.refreshToken
    });
  }
  
  return response;
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
  defaultBounds?: string; // GeoJSON Polygon or null
  viewState?: string; // JSON object {"center":[lat,lng],"zoom":zoom}
  baseMapProvider?: BaseMapProvider;
}

export interface CreateMapResponse {
  mapId: string;
  message?: string;
  createdAt?: string;
}

export function createMap(req: CreateMapRequest) {
  let center: [number, number] = [10.78, 106.69];
  let zoom = 13;

  if (req.viewState) {
    try {
      const vs = JSON.parse(req.viewState) as Partial<ViewState>;
      const c = vs?.center;
      const z = vs?.zoom;
      if (
        Array.isArray(c) &&
        c.length === 2 &&
        typeof c[0] === "number" &&
        typeof c[1] === "number"
      ) {
        center = [c[0], c[1]];
      }
      if (typeof z === "number") {
        zoom = z;
      }
    } catch {

    }
  }

  const body = {
    OrgId: req.orgId,
    OrganizationId: req.orgId,
    ProjectId: (req as any).projectId ?? undefined,
    Name: req.name,
    Description: req.description ?? null,
    IsPublic: req.isPublic,
    ViewState: JSON.stringify({ Center: center, Zoom: zoom }),
    BaseMapProvider: req.baseMapProvider ?? "OSM",
    GeographicBounds: req.defaultBounds ?? null,
  };

  return postJson<typeof body, CreateMapResponse>("/maps", body);
}

/** ===================== PROJECTS ===================== */

export type CreateWorkspaceRequest = {
  orgId: string;
  workspaceName: string;
  description?: string | null;
  icon?: string | null;
  access?: WorkspaceAccess;
};

export type CreateWorkspaceResponse = { result?: string };

export function createWorkspace(req: CreateWorkspaceRequest) {
  const body = {
    OrgId: req.orgId,
    WorkspaceName: req.workspaceName,
    Description: req.description ?? null,
    Icon: req.icon ?? null,
    Access: req.access ?? "Private",
  };
  return postJson<typeof body, CreateWorkspaceResponse>("/workspaces", body);
}

// Backward compatibility aliases
export type CreateProjectRequest = CreateWorkspaceRequest;
export const createProject = createWorkspace;



export type GetWorkspacesByOrgResponse = { workspaces: Workspace[] } | Workspace[];

export async function getWorkspacesByOrganization(orgId: string): Promise<Workspace[]> {
  const res = await getJson<GetWorkspacesByOrgResponse>(`/workspaces/organization/${orgId}`);
  return Array.isArray(res) ? res : (res.workspaces ?? []);
}

export type AddMapToWorkspaceRequest = { mapId: string };
export type AddMapToWorkspaceResponse = { result?: string };

export function addMapToWorkspace(workspaceId: string, req: AddMapToWorkspaceRequest) {
  const body = { MapId: req.mapId };
  return postJson<typeof body, AddMapToWorkspaceResponse>(`/workspaces/${workspaceId}/maps`, body);
}

export function getWorkspaceById(workspaceId: string) {
  return getJson<Workspace>(`/workspaces/${workspaceId}`);
}

export function updateWorkspace(workspaceId: string, req: { workspaceName: string; description?: string }) {
  const body = {
    WorkspaceName: req.workspaceName,
    Description: req.description ?? null,
  };
  return putJson<typeof body, Workspace>(`/workspaces/${workspaceId}`, body);
}

export function deleteWorkspace(workspaceId: string) {
  return delJson(`/workspaces/${workspaceId}`);
}

export function getWorkspaceMaps(workspaceId: string) {
  return getJson<MapDto[]>(`/workspaces/${workspaceId}/maps`);
}

export function removeMapFromWorkspace(workspaceId: string, mapId: string) {
  return delJson(`/workspaces/${workspaceId}/maps/${mapId}`);
}

// Backward compatibility aliases
export const getProjectsByOrganization = getWorkspacesByOrganization;
export const addMapToProject = addMapToWorkspace;
export const getProjectById = getWorkspaceById;
export const updateProject = updateWorkspace;
export const deleteProject = deleteWorkspace;
export const getProjectMaps = getWorkspaceMaps;
export const removeMapFromProject = removeMapFromWorkspace;

export type MapDto = {
  id: string;
  name: string;
  ownerId?: string;
  description?: string;
  previewImageUrl?: string | null;
  createdAt: string;
};

export function getMapById(mapId: string) {
  return getJson<MapDto>(`/maps/${mapId}`);
}

export interface UpdateMapRequest {
  name?: string;
  description?: string;
  previewImageUrl?: string | null;
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
    baseLayer: BaseMapProvider;
    viewState: {
      center?: [number, number];
      zoom?: number;
    } | null;
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
      baseMapProvider: m.baseLayer,
      initialLatitude: m.initialLatitude,
      initialLongitude: m.initialLongitude,
      initialZoom: m.viewState?.zoom ?? m.initialZoom ?? 10,
      layers: m.layers ?? [],
    };
  }

  return res as MapDetail;
}
/* ---------- ZONE OPERATIONS ---------- */

/**
 * Copy a feature/zone from one layer to another
 */
export async function copyZoneToLayer(
  mapId: string,
  sourceLayerId: string,
  targetLayerId: string,
  featureIndex: number
): Promise<boolean> {
  try {
    const response = await postJson(
      `/maps/${mapId}/layers/${sourceLayerId}/copy-feature`,
      {
        targetLayerId,
        featureIndex
      }
    );
    return true;
  } catch (error) {
    console.error('Failed to copy zone to layer:', error);
    return false;
  }
}

/**
 * Delete a feature/zone from a layer's GeoJSON data
 */
export async function deleteZoneFromLayer(
  mapId: string,
  layerId: string,
  featureIndex: number
): Promise<boolean> {
  try {
    await delJson(`/maps/${mapId}/layers/${layerId}/features/${featureIndex}`);
    return true;
  } catch (error) {
    console.error('Failed to delete zone from layer:', error);
    return false;
  }
}

/**
 * Update layer data (for manual GeoJSON updates)
 */
export async function updateLayerData(
  mapId: string,
  layerId: string,
  geoJsonData: GeoJSON.FeatureCollection
): Promise<boolean> {
  try {
    await putJson(`/maps/${mapId}/layers/${layerId}/data`, {
      layerData: JSON.stringify(geoJsonData)
    });
    return true;
  } catch (error) {
    console.error('Failed to update layer data:', error);
    return false;
  }
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
  customName: string;
  customDescription?: string;
  isPublic?: boolean;
  customInitialLatitude?: number;
  customInitialLongitude?: number;
  customInitialZoom?: number;
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

// Upload GeoJSON file to map
export interface UploadGeoJsonToMapResponse {
  layerId: string;
  message: string;
  featuresAdded: number;
  dataSize: number;
}

export async function uploadGeoJsonToMap(
  mapId: string,
  file: File,
  layerName?: string
): Promise<UploadGeoJsonToMapResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (layerName) {
    formData.append("layerName", layerName);
  }

  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");

  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${base}/maps/${mapId}/upload-geojson`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to upload file");
  }

  return response.json();
}

export interface UpdateMapLayerRequest {
  isVisible?: boolean | null;
  zIndex?: number | null;
  customStyle?: string | null;
  filterConfig?: string | null;
}

export interface UpdateMapLayerResponse { message?: string; }

export function updateMapLayer(mapId: string, layerId: string, body: UpdateMapLayerRequest) {
  return patchJson<UpdateMapLayerRequest, UpdateMapLayerResponse>(`/maps/${mapId}/layers/${layerId}`, body);
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
  name: string;
  description?: string | null;
  layerId?: string | null;
  featureCategory: "Data" | "Annotation";
  annotationType?: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video" | null;
  geometryType: "Point" | "LineString" | "Polygon" | "Circle" | "Rectangle";
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
  mapId: string;
  layerId?: string | null;
  name?: string | null;
  description?: string | null;
  featureCategory: "Data" | "Annotation";
  annotationType?: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video" | null;
  geometryType: "Point" | "LineString" | "Polygon" | "Circle" | "Rectangle";
  coordinates: string;
  properties?: string | null;
  style?: string | null;
  isVisible?: boolean | null;
  zIndex?: number | null;
}

export function createMapFeature(mapId: string, body: CreateMapFeatureRequest) {
  const requestBody = { ...body, mapId };
  return postJson<CreateMapFeatureRequest, MapFeatureResponse>(`/maps/${mapId}/features`, requestBody);
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
  geometryType?: "Point" | "LineString" | "Polygon" | "Circle" | "Rectangle" | null;
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

// ====================== USER APIs ======================
export interface UpdateUserPersonalInfoRequest {
  fullName: string;
  phone: string;
}

export interface UpdateUserPersonalInfoResponse {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  updatedAt: string;
}

export async function updateMyPersonalInfo(
  data: UpdateUserPersonalInfoRequest
): Promise<UpdateUserPersonalInfoResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/user/me/personal-info`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to update personal info");
  }

  return res.json();
}

/* ------------------ Map Layer Operations ------------------ */

export type LayerInfo = {
  layerId: string;
  layerName: string;
  description?: string;
  layerType: string;
  featureCount: number;
  isVisible: boolean;
  zIndex: number;
};

export type CopyFeatureToLayerRequest = {
  targetLayerId?: string; // For existing layer
  newLayerName?: string; // For new layer
  featureIndex: number;
};

export type CopyFeatureToLayerResponse = {
  success: boolean;
  message: string;
  targetLayerId: string;
  targetLayerName: string;
  targetLayerFeatureCount: number;
  newLayerCreated: boolean;
};

export async function getMapLayers(mapId: string): Promise<LayerInfo[]> {
  const res = await getJson<LayerInfo[]>(`/maps/${mapId}/layers`);
  return res || [];
}

export async function copyFeatureToLayer(
  mapId: string,
  sourceLayerId: string,
  request: CopyFeatureToLayerRequest
): Promise<CopyFeatureToLayerResponse> {
  console.log("🌐 API call: copyFeatureToLayer");
  console.log("📍 URL:", `/maps/${mapId}/layers/${sourceLayerId}/copy-feature`);
  console.log("📦 Request body:", request);

  const res = await postJson<CopyFeatureToLayerRequest, CopyFeatureToLayerResponse>(
    `/maps/${mapId}/layers/${sourceLayerId}/copy-feature`,
    request
  );

  console.log("✅ API response:", res);
  return res;
}

export async function deleteFeatureFromLayer(
  mapId: string,
  layerId: string,
  featureIndex: number
): Promise<void> {
  await delJson(`/maps/${mapId}/layers/${layerId}/features/${featureIndex}`);
}

/*  USAGE / QUOTA (per-user in org)  */

export type UsageResourceType =
  | "Maps"
  | "Layers"
  | "Members"
  | "StorageBytes"
  | string;

export interface CheckQuotaRequest {
  resourceType: UsageResourceType;
  requestedAmount: number;
}

export interface CheckQuotaResponse {
  isAllowed: boolean;
  resourceType?: UsageResourceType;
  requestedAmount?: number;
  remaining?: number;
  limit?: number | null;
  message?: string;
}

export interface UserUsageResponse {
  userId?: string;
  orgId?: string;
  period?: string | null;
  lastReset?: string | null;

  mapsUsed?: number;
  mapsLimit?: number | null;
  layersUsed?: number;
  layersLimit?: number | null;
  membersUsed?: number;
  membersLimit?: number | null;
  storageUsedBytes?: number;
  storageLimitBytes?: number | null;

  [k: string]: unknown;
}

export function getUserUsage(orgId: string) {
  return getJson<UserUsageResponse>(`/usage/user/${encodeURIComponent(orgId)}`);
}

export function checkUserQuota(orgId: string, req: CheckQuotaRequest) {
  return postJson<CheckQuotaRequest, CheckQuotaResponse>(
    `/usage/user/${encodeURIComponent(orgId)}/check-quota`,
    req
  );
}

export function consumeUserQuota(
  orgId: string,
  req: CheckQuotaRequest
) {
  return postJson<CheckQuotaRequest, { success: true; message?: string }>(
    `/usage/user/${encodeURIComponent(orgId)}/consume`,
    req
  );
}

/* (Notifications)*/

export type NotificationType =
  | "Info"
  | "Warning"
  | "Success"
  | "Error"
  | string;

export interface NotificationItem {
  notificationId: number;
  title?: string;
  message?: string;
  type?: NotificationType;
  isRead?: boolean;
  createdAt?: string;
  linkUrl?: string | null;
  orgId?: string | null;
}

export interface GetUserNotificationsResponse {
  notifications: NotificationItem[];
  page: number;
  pageSize: number;
  totalItems?: number;
  totalPages?: number;
}

export interface MarkNotificationReadResponse {
  ok?: boolean;
  notificationId?: number;
  message?: string;
}

export interface MarkAllNotificationsReadResponse {
  ok?: boolean;
  affected?: number;
  message?: string;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function unwrapNotificationsEnvelope(res: unknown): GetUserNotificationsResponse {
  const base: GetUserNotificationsResponse = {
    notifications: [],
    page: 1,
    pageSize: 20,
    totalItems: undefined,
    totalPages: undefined,
  };

  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    const list =
      (Array.isArray(o.notifications) ? (o.notifications as unknown[]) :
        Array.isArray(o.items) ? (o.items as unknown[]) :
          Array.isArray(o.data) ? (o.data as unknown[]) : []) as unknown[];

    const mapped: NotificationItem[] = list.map((x) => {
      const it = (x ?? {}) as Record<string, unknown>;
      const id =
        asNumber(it.notificationId) ??
        asNumber(it.id) ??
        0;
      return {
        notificationId: id ?? 0,
        title: typeof it.title === "string" ? it.title : undefined,
        message: typeof it.message === "string" ? it.message : undefined,
        type: typeof it.type === "string" ? it.type : undefined,
        isRead: typeof it.isRead === "boolean" ? it.isRead : undefined,
        createdAt: typeof it.createdAt === "string" ? it.createdAt : undefined,
        linkUrl: typeof it.linkUrl === "string" ? it.linkUrl : null,
        orgId: typeof it.orgId === "string" ? it.orgId : null,
      };
    });

    const page = asNumber(o.page) ?? 1;
    const pageSize = asNumber(o.pageSize) ?? 20;
    const totalItems = asNumber(o.totalItems) ?? asNumber(o.total);
    const totalPages = asNumber(o.totalPages);

    return {
      notifications: mapped,
      page,
      pageSize,
      totalItems: totalItems ?? undefined,
      totalPages: totalPages ?? undefined,
    };
  }

  return base;
}

export async function getUserNotifications(page = 1, pageSize = 20): Promise<GetUserNotificationsResponse> {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
  const res = await getJson<unknown>(`/notifications?${q}`);
  return unwrapNotificationsEnvelope(res);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await getJson<unknown>(`/notifications/unread-count`);
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    const n = o.unreadCount;
    if (typeof n === "number" && Number.isFinite(n)) return n;
    if (typeof n === "string" && n.trim() !== "" && !Number.isNaN(Number(n))) return Number(n);
  }
  return 0;
}

export function markNotificationAsRead(notificationId: number) {
  return apiFetch<MarkNotificationReadResponse>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PUT",
  });
}

export function markAllNotificationsAsRead() {
  return apiFetch<MarkAllNotificationsReadResponse>(`/notifications/mark-all-read`, {
    method: "PUT",
  });
}

// PAYMENT API //
export type PaymentGateway = "vnPay" | "payOS" | "stripe" | "payPal";
export type PaymentPurpose = "membership" | "addon" | "upgrade";

// Subscribe to a plan
export interface SubscribeRequest {
  userId: string;
  orgId: string;
  planId: number;
  paymentMethod: PaymentGateway;
  autoRenew: boolean;
}

export interface SubscribeResponse {
  transactionId: string;
  paymentUrl: string;
  status: string;
  message: string;
  paymentGateway: PaymentGateway;
  qrCode?: string;
  orderCode?: string;
}

export function subscribeToPlan(body: SubscribeRequest) {
  return postJson<SubscribeRequest, SubscribeResponse>(
    "/payment/subscribe",
    body
  );
}

// Upgrade to a different plan
export interface UpgradeRequest {
  userId: string;
  orgId: string;
  newPlanId: number;
  paymentMethod: PaymentGateway;
  autoRenew: boolean;
}

export interface UpgradeResponse {
  transactionId: string;
  paymentUrl: string;
  status: string;
  message: string;
  proRatedAmount?: number;
  paymentGateway: PaymentGateway;
  qrCode?: string;
  orderCode?: string;
}

export function upgradePlan(body: UpgradeRequest) {
  return postJson<UpgradeRequest, UpgradeResponse>(
    "/payment/upgrade",
    body
  );
}

// Confirm payment (webhook/callback)
export interface PaymentConfirmationRequest {
  paymentGateway: PaymentGateway;
  purpose: string;
  transactionId: string;
  status: "success" | "failed" | "cancelled";
  paymentId: string;
  orderCode?: string;
}

export interface PaymentConfirmationResponse {
  transactionId: string;
  status: string;
  message: string;
  membershipUpdated: boolean;
  notificationSent: boolean;
}

export function confirmPayment(body: PaymentConfirmationRequest) {
  return postJson<PaymentConfirmationRequest, PaymentConfirmationResponse>(
    "/payment/confirm",
    body
  );
}

// Cancel payment
export interface CancelPaymentRequest {
  paymentGateway: PaymentGateway;
  paymentId: string;
  orderCode: string;
  transactionId: string;
}

export interface CancelPaymentResponse {
  status: string;
  gatewayName: string;
}

export function cancelPayment(body: CancelPaymentRequest) {
  return postJson<CancelPaymentRequest, CancelPaymentResponse>(
    "/payment/cancel",
    body
  );
}

// Get payment history
export interface PaymentHistoryItem {
  transactionId: string;
  amount: number;
  status: string;
  purpose: string;
  transactionDate: string;
  createdAt: string;
  transactionReference?: string;
  paymentGateway?: {
    gatewayId: string;
    name: string;
  };
  membership?: {
    membershipId: string;
    startDate: string;
    endDate?: string;
    status: string;
    autoRenew: boolean;
    plan?: {
      planId: number;
      planName: string;
      description: string;
      priceMonthly: number;
      durationMonths: number;
    };
    organization?: {
      orgId: string;
      orgName: string;
      abbreviation: string;
    };
  };
}

export interface PaymentHistoryResponse {
  payments: PaymentHistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export function getPaymentHistory(page = 1, pageSize = 20) {
  return getJson<PaymentHistoryResponse>(`/payment/history?page=${page}&pageSize=${pageSize}`);
}

// ===== Story Map (Segments) =====
export type Segment = {
  segmentId: string;
  mapId: string;
  name?: string;
  summary?: string;
  storyContent?: string;
  displayOrder?: number;
  isVisible?: boolean;
  createdBy?: string;
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
};

export type CreateSegmentRequest = {
  // mapId được lấy từ route
  name: string;
  summary?: string;
  storyContent?: string;
  displayOrder?: number;
  isVisible?: boolean;
};

export type UpdateSegmentRequest = Partial<CreateSegmentRequest>;

export function getSegments(mapId: string) {
  return getJson<Segment[]>(`${STORYMAP_PREFIX}/${mapId}/segments`);
}

export function createSegment(mapId: string, body: CreateSegmentRequest) {
  return postJson<CreateSegmentRequest, Segment>(
    `${STORYMAP_PREFIX}/${mapId}/segments`,
    body
  );
}

export function updateSegment(
  mapId: string,
  segmentId: string,
  body: UpdateSegmentRequest
) {
  return putJson<UpdateSegmentRequest, Segment>(
    `${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}`,
    body
  );
}

export function deleteSegment(mapId: string, segmentId: string) {
  return delJson<void>(`${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}`);
}

// ===== Segment ↔ Layers =====
export type SegmentLayer = {
  segmentLayerId: string;
  segmentId: string;
  layerId: string;
  isVisible?: boolean;
  zIndex?: number;
};

export function getSegmentLayers(mapId: string, segmentId: string) {
  return getJson<SegmentLayer[]>(`${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/layers`);
}

export function attachLayerToSegment(
  mapId: string,
  segmentId: string,
  payload: { layerId: string; isVisible?: boolean; zIndex?: number }
) {
  return postJson<typeof payload, SegmentLayer>(
    `${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/layers`,
    payload
  );
}

export function updateSegmentLayer(
  mapId: string,
  segmentId: string,
  layerId: string,
  payload: { isVisible?: boolean; zIndex?: number }
) {
  return putJson<typeof payload, SegmentLayer>(
    `${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/layers/${layerId}`,
    payload
  );
}

export function detachLayerFromSegment(mapId: string, segmentId: string, layerId: string) {
  return delJson<void>(`${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/layers/${layerId}`);
}
export type CreatePoiReq = {
  title: string;
  subtitle?: string;
  locationType?: string; 
  markerGeometry: string; 
  storyContext?: string;
  mediaResources?: string;
  displayOrder?: number;
  highlightOnEnter?: boolean;
  shouldPin?: boolean;
  tooltipContent?: string;
  slideContent?: string;
  playAudioOnClick?: boolean;
  audioUrl?: string;
  layerUrl?: string;
  animationOverrides?: string;
};
export type UpdatePoiReq = Partial<CreatePoiReq>;

export type MapPoi = {
  poiId: string;
  mapId: string;
  title: string;
  subtitle?: string;
  markerGeometry: string;      
  highlightOnEnter?: boolean;
  shouldPin?: boolean;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SegmentPoi = MapPoi & {
  segmentId: string;
};
export function getMapPois(mapId: string) {
  return getJson<MapPoi[]>(`${POI_PREFIX}/${mapId}`);
}

export function createMapPoi(mapId: string, body: CreatePoiReq) {
  return postJson<CreatePoiReq, MapPoi>(`${POI_PREFIX}/${mapId}`, body);
}

export function getSegmentPois(mapId: string, segmentId: string) {
  return getJson<SegmentPoi[]>(`${POI_PREFIX}/${mapId}/segments/${segmentId}`);
}
export function createSegmentPoi(mapId: string, segmentId: string, body: CreatePoiReq) {
  return postJson<CreatePoiReq, SegmentPoi>(`${POI_PREFIX}/${mapId}/segments/${segmentId}`, body);
}

export function updatePoi(poiId: string, body: UpdatePoiReq) {
  return putJson<UpdatePoiReq, MapPoi>(`${POI_PREFIX}/${poiId}`, body);
}

export function deletePoi(poiId: string) {
  return delJson<void>(`${POI_PREFIX}/${poiId}`);
}

// ===== Segment Zones =====
export type SegmentZone = {
  segmentZoneId: string;
  segmentId: string;
  name?: string;
  description?: string;
  zoneGeometry?: string;
  focusCameraState?: string;
  displayOrder?: number;
  isPrimary?: boolean;
  isVisible?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSegmentZoneReq = {
  name: string;
  description?: string;
  zoneType: "Area" | "Line" | "Point"; 
  zoneGeometry: string; 
  focusCameraState?: string; 
  displayOrder?: number;
  isPrimary?: boolean;
};


export type UpdateSegmentZoneReq = Partial<CreateSegmentZoneReq>;

export function getSegmentZones(mapId: string, segmentId: string) {
  return getJson<SegmentZone[]>(`${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/zones`);
}
export function createSegmentZone(mapId: string, segmentId: string, body: CreateSegmentZoneReq) {
  return postJson<CreateSegmentZoneReq, SegmentZone>(`${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/zones`, body);
}
export function updateSegmentZone(mapId: string, segmentId: string, zoneId: string, body: UpdateSegmentZoneReq) {
  return putJson<UpdateSegmentZoneReq, SegmentZone>(`${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/zones/${zoneId}`, body);
}
export function deleteSegmentZone(mapId: string, segmentId: string, zoneId: string) {
  return delJson<void>(`${STORYMAP_PREFIX}/${mapId}/segments/${segmentId}/zones/${zoneId}`);
}

// ===== Timeline =====
export type TimelineStep = {
  timelineStepId: string;
  mapId: string;
  segmentId?: string | null;
  title?: string;
  description?: string;
  order?: number;
  viewState?: string; // JSON {"center":[lat,lng], "zoom": n}
  mediaUrl?: string;
};

export type CreateTimelineStepReq = {
  segmentId?: string | null;
  title?: string;
  description?: string;
  order?: number;
  viewState?: string;
  mediaUrl?: string;
};

export type UpdateTimelineStepReq = Partial<CreateTimelineStepReq>;

export function getTimeline(mapId: string) {
  return getJson<TimelineStep[]>(`${STORYMAP_PREFIX}/${mapId}/timeline`);
}
export function createTimelineStep(mapId: string, body: CreateTimelineStepReq) {
  return postJson<CreateTimelineStepReq, TimelineStep>(`${STORYMAP_PREFIX}/${mapId}/timeline`, body);
}
export function updateTimelineStep(mapId: string, stepId: string, body: UpdateTimelineStepReq) {
  return putJson<UpdateTimelineStepReq, TimelineStep>(`${STORYMAP_PREFIX}/${mapId}/timeline/${stepId}`, body);
}
export function deleteTimelineStep(mapId: string, stepId: string) {
  return delJson<void>(`${STORYMAP_PREFIX}/${mapId}/timeline/${stepId}`);
}

// ===== Zone Analytics =====
export type ZoneAnalyticsRequest = Record<string, unknown>;
export type ZoneAnalyticsResponse = Record<string, unknown>; 

export function getZoneAnalytics(mapId: string, body: ZoneAnalyticsRequest) {
  return postJson<ZoneAnalyticsRequest, ZoneAnalyticsResponse>(
    `${STORYMAP_PREFIX}/${mapId}/analytics/zones`,
    body
  );
}

