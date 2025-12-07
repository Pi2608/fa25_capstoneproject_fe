/**
 * Maps, Templates, Layers, Features & Publishing API
 */

import { Feature, FeatureCollection, Geometry } from "geojson";
import { getJson, postJson, putJson, delJson, patchJson, apiFetch, getToken, ApiErrorShape } from "./api-core";

// ===== TYPES =====
export type ViewState = { center: [number, number]; zoom: number };
export type BaseLayer =
  | "OSM"
  | "Satellite"
  | "Dark"
  | "Positron"
  | "DarkMatter"
  | "Terrain"
  | "Toner"
  | "Watercolor"
  | "Topo";
export type MapStatus = "Draft" | "Published" | "Archived";

export type MapDto = {
  id: string;
  name: string;
  ownerId?: string;
  ownerName?: string;
  description?: string;
  isPublic: boolean;
  previewImage?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  lastActivityAt?: string | null;
  status?: MapStatus;
  isOwner: boolean;
  workspaceName?: string | null;
};


export type DefaultBounds = {
  type: string;
  coordinates: number[];
}


export type LayerStyle = {
  color?: string;
  weight?: number;
  fillColor?: string;
  fillOpacity?: number;
  opacity?: number;
  dashArray?: string;
  dashOffset?: string;
  lineCap?: string;
  lineJoin?: string;
  lineMiterLimit?: number;
  lineWidth?: number;
  radius?: number;
  stroke?: boolean;
  [key: string]: unknown;
}


export type LayerDTO = {
  id: string;
  layerName: string;
  layerType: string;
  sourceType: string;
  filePath: string;
  layerData: FeatureCollection | Record<string, unknown>;
  layerStyle: LayerStyle | Record<string, unknown>;
  isVisible: boolean;
  featureCount: number;
  dataSizeKB: number;
  dataBounds: string;
  createdAt: string;
  updatedAt: string;
}


export interface MapDetail {
  id: string;
  name: string;
  description?: string;
  previewImage?: string;
  defaultBounds?: DefaultBounds;
  baseLayer: BaseLayer;
  viewState?: ViewState;
  isPublic?: boolean;
  status?: MapStatus;
  isStoryMap?: boolean;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  layers: LayerDTO[];
}

// ===== MAP CRUD =====
export interface CreateMapRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  defaultBounds?: string;
  viewState?: string;
  baseLayer?: BaseLayer;
  workspaceId?: string | null;
  isStoryMap?: boolean;
}

export interface CreateMapResponse {
  mapId: string;
  message?: string;
  createdAt?: string;
}

// ===== MAP UTILITIES =====
/**
 * Calculate default bounds as a Polygon from center and zoom level
 */
export function createDefaultBounds(center: { lat: number; lng: number }, zoom: number): string {
  const latDiff = 180 / Math.pow(2, zoom);
  const lngDiff = 360 / Math.pow(2, zoom);
  return JSON.stringify({
    type: "Polygon",
    coordinates: [[
      [center.lng - lngDiff / 2, center.lat - latDiff / 2],
      [center.lng + lngDiff / 2, center.lat - latDiff / 2],
      [center.lng + lngDiff / 2, center.lat + latDiff / 2],
      [center.lng - lngDiff / 2, center.lat + latDiff / 2],
      [center.lng - lngDiff / 2, center.lat - latDiff / 2],
    ]],
  });
}

/**
 * Create viewState JSON string from center and zoom
 * Format: { center: [lat, lng], zoom: number }
 */
export function createViewState(center: { lat: number; lng: number }, zoom: number): string {
  return JSON.stringify({ center: [center.lat, center.lng], zoom });
}

/**
 * Create both defaultBounds and viewState from center and zoom
 */
export function createMapViewData(center: { lat: number; lng: number }, zoom: number): {
  defaultBounds: string;
  viewState: string;
} {
  return {
    defaultBounds: createDefaultBounds(center, zoom),
    viewState: createViewState(center, zoom),
  };
}

/**
 * Default map center (Vietnam)
 */
export const DEFAULT_MAP_CENTER = { lat: 14.4879, lng: 110.8740 };
export const DEFAULT_MAP_ZOOM = 6;

export function createMap(req: CreateMapRequest) {
  const body = {
    Name: req.name,
    Description: req.description ?? null,
    IsPublic: req.isPublic,
    DefaultBounds: req.defaultBounds ?? null,
    ViewState: req.viewState ?? null,
    BaseLayer: req.baseLayer ?? "OSM",
    WorkspaceId: req.workspaceId ?? null,
    IsStoryMap: req.isStoryMap ?? false,
  };

  return postJson<typeof body, CreateMapResponse>("/maps", body);
}

export async function createDefaultMap(options?: {
  name?: string;
  description?: string;
  isPublic?: boolean;
  baseLayer?: BaseLayer;
  workspaceId?: string | null;
  center?: { lat: number; lng: number };
  zoom?: number;
  isStoryMap?: boolean;
}): Promise<CreateMapResponse> {
  const center = options?.center ?? DEFAULT_MAP_CENTER;
  const zoom = options?.zoom ?? DEFAULT_MAP_ZOOM;
  const { defaultBounds, viewState } = createMapViewData(center, zoom);

  return createMap({
    name: options?.name ?? "Untitled Map",
    description: options?.description ?? "",
    isPublic: options?.isPublic ?? false,
    defaultBounds,
    viewState,
    baseLayer: options?.baseLayer ?? "OSM",
    workspaceId: options?.workspaceId ?? null,
    isStoryMap: options?.isStoryMap ?? false,
  });
}

export function getMapById(mapId: string) {
  return getJson<MapDto>(`/maps/${mapId}`);
}

export interface UpdateMapRequest {
  name?: string;
  description?: string;
  previewImageUrl?: string | null;
  isPublic?: boolean;
  baseLayer?: BaseLayer;
  defaultBounds?: string;
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

export async function getMyRecentMaps(limit = 20): Promise<MapDto[]> {
  const res = await getJson<GetMyMapsResponse | MapDto[]>(`/maps/my/recents?limit=${encodeURIComponent(String(limit))}`);
  return Array.isArray(res) ? res : (res.maps ?? []);
}

export async function getMyDraftMaps(): Promise<MapDto[]> {
  const res = await getJson<GetMyMapsResponse | MapDto[]>("/maps/my/drafts");
  return Array.isArray(res) ? res : (res.maps ?? []);
}

export interface GetOrganizationMapsResponse { maps: MapDto[] }

export async function getOrganizationMaps(orgId: string): Promise<MapDto[]> {
  const res = await getJson<GetOrganizationMapsResponse | MapDto[]>(`/maps/organization/${orgId}`);
  return Array.isArray(res) ? res : (res.maps ?? []);
}

export async function getMapDetail(mapId: string): Promise<MapDetail> {
  const res = await getJson<MapDetail | MapDetail>(`/maps/${mapId}`);
  return res as MapDetail;
}

// ===== ZONE OPERATIONS =====
export async function copyZoneToLayer(
  mapId: string,
  sourceLayerId: string,
  targetLayerId: string,
  featureIndex: number
): Promise<boolean> {
  try {
    await postJson(
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

// ===== TEMPLATES =====
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
  workspaceId?: string | null;
}

export interface CreateMapFromTemplateResponse {
  mapId: string;
}

export function createMapFromTemplate(body: CreateMapFromTemplateRequest) {
  const payload = {
    TemplateId: body.templateId,
    CustomName: body.customName,
    CustomDescription: body.customDescription ?? null,
    IsPublic: body.isPublic ?? false,
    CustomInitialLatitude: body.customInitialLatitude ?? null,
    CustomInitialLongitude: body.customInitialLongitude ?? null,
    CustomInitialZoom: body.customInitialZoom ?? null,
    WorkspaceId: body.workspaceId ?? null,
  };
  return postJson<typeof payload, CreateMapFromTemplateResponse>("/maps/from-template", payload);
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

// ===== LAYERS =====
export interface AddLayerToMapRequest {
  layerId?: string;
  layerName?: string;
  layerData?: string;
  layerTypeId?: string;
  layerStyle?: string;
  isVisible?: boolean;
  zIndex?: number;
  customStyle?: string | null;
  filterConfig?: string | null;
}

export interface AddLayerToMapResponse { mapLayerId: string; }

export function addLayerToMap(mapId: string, body: AddLayerToMapRequest) {
  return postJson<AddLayerToMapRequest, AddLayerToMapResponse>(`/maps/${mapId}/layers`, body);
}

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
  layerName?: string | null;
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

export type LayerInfo = {
  layerId: string;
  layerName: string;
  description?: string;
  layerType: string;
  featureCount: number;
  isVisible: boolean;
  zIndex: number;
};

export async function getMapLayers(mapId: string): Promise<LayerInfo[]> {
  return getJson<LayerInfo[]>(`/maps/${mapId}/layers`);
}

export type CopyFeatureToLayerRequest = {
  targetLayerId?: string;
  newLayerName?: string;
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

export async function copyFeatureToLayer(
  mapId: string,
  sourceLayerId: string,
  request: CopyFeatureToLayerRequest
): Promise<CopyFeatureToLayerResponse> {
  return postJson<CopyFeatureToLayerRequest, CopyFeatureToLayerResponse>(
    `/maps/${mapId}/layers/${sourceLayerId}/copy-feature`,
    request
  );
}

export async function deleteFeatureFromLayer(
  mapId: string,
  layerId: string,
  featureIndex: number
): Promise<void> {
  await delJson(`/maps/${mapId}/layers/${layerId}/features/${featureIndex}`);
}

// ===== SHARE =====
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

// ===== FEATURES =====
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

// ===== PUBLISHING =====
export interface PublishMapRequest {
  isStoryMap?: boolean;  // true = publish as storymap (can create sessions), false = view-only
}

export interface PublishMapResponse {
  success: boolean;
  message?: string;
}

export function publishMap(mapId: string, request?: PublishMapRequest) {
  return postJson<PublishMapRequest | undefined, PublishMapResponse>(
    `/maps/${mapId}/publish`,
    request || { isStoryMap: false }
  );
}

export function unpublishMap(mapId: string) {
  return postJson<void, PublishMapResponse>(`/maps/${mapId}/unpublish`, undefined);
}

export function archiveMap(mapId: string) {
  return postJson<void, PublishMapResponse>(`/maps/${mapId}/archive`, undefined);
}

export function restoreMap(mapId: string) {
  return postJson<void, PublishMapResponse>(`/maps/${mapId}/restore`, undefined);
}

// ===== EXPORTS =====
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

// ===== MAP ANALYTICS =====
export type MapViewsResponse = {
  views?: number;
  viewsMonthly?: number;
  total?: number;
  month?: number;
};

export async function getMapViews(mapId: string): Promise<number> {
  try {
    const res = await getJson<MapViewsResponse | number>(`/maps/${mapId}/views`);
    if (typeof res === "number") return res;
    if (res && typeof res === "object") {
      if (typeof res.views === "number") return res.views;
      if (typeof res.viewsMonthly === "number") return res.viewsMonthly;
      if (typeof res.total === "number") return res.total;
      if (typeof res.month === "number") return res.month;
    }
  } catch { }

  try {
    const res = await getJson<MapViewsResponse | number>(`/maps/${mapId}/stats`);
    if (typeof res === "number") return res;
    if (res && typeof res === "object") {
      if (typeof res.views === "number") return res.views;
      if (typeof res.viewsMonthly === "number") return res.viewsMonthly;
      if (typeof res.total === "number") return res.total;
      if (typeof res.month === "number") return res.month;
    }
  } catch { }

  try {
    const res = await getJson<MapViewsResponse | number>(`/analytics/maps/${mapId}/views`);
    if (typeof res === "number") return res;
    if (res && typeof res === "object") {
      if (typeof res.views === "number") return res.views;
      if (typeof res.viewsMonthly === "number") return res.viewsMonthly;
      if (typeof res.total === "number") return res.total;
      if (typeof res.month === "number") return res.month;
    }
  } catch { }

  try {
    const res = await getJson<MapViewsResponse | number>(`/analytics/map-views?mapId=${encodeURIComponent(mapId)}`);
    if (typeof res === "number") return res;
    if (res && typeof res === "object") {
      if (typeof res.views === "number") return res.views;
      if (typeof res.viewsMonthly === "number") return res.viewsMonthly;
      if (typeof res.total === "number") return res.total;
      if (typeof res.month === "number") return res.month;
    }
  } catch { }

  return 0;
}

export async function getMultipleMapViews(mapIds: string[]): Promise<number[]> {
  const results = await Promise.allSettled(mapIds.map(id => getMapViews(id)));
  return results.map(result => result.status === "fulfilled" ? result.value : 0);
}

// ================== MAP ZONE (Zone attached to map for non-StoryMap mode) ==================

// Zone type (master data)
export type Zone = {
  zoneId: string;
  externalId?: string;
  zoneCode?: string;
  name: string;
  zoneType: string;
  adminLevel?: number;
  parentZoneId?: string;
  geometry: string;
  simplifiedGeometry?: string;
  centroid?: string;
  boundingBox?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

// MapZone (Link Map → Zone with highlight config for non-StoryMap mode)
export type MapZone = {
  mapZoneId: string;
  mapId: string;
  zoneId: string;
  zone?: Zone; // Populated
  displayOrder: number;
  isVisible: boolean;
  zIndex: number;

  // Highlight config
  highlightBoundary: boolean;
  boundaryColor?: string;
  boundaryWidth?: number;
  fillZone: boolean;
  fillColor?: string;
  fillOpacity?: number;
  showLabel: boolean;
  labelOverride?: string;
  labelStyle?: string;

  createdAt: string;
  updatedAt?: string;
};

export type CreateMapZoneRequest = {
  mapId?: string; // Will be enriched by endpoint
  zoneId: string; // Select from Zone master data
  displayOrder?: number;
  isVisible?: boolean;
  zIndex?: number;
  highlightBoundary?: boolean;
  boundaryColor?: string;
  boundaryWidth?: number;
  fillZone?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  showLabel?: boolean;
  labelOverride?: string;
  labelStyle?: string;
};

export type UpdateMapZoneRequest = Omit<CreateMapZoneRequest, 'mapId' | 'zoneId'>;

/**
 * Get all zones attached to a map (for non-StoryMap mode)
 */
export function getMapZones(mapId: string) {
  return getJson<MapZone[]>(`/maps/${mapId}/zones`);
}

/**
 * Create a new zone attachment for a map
 */
export function createMapZone(mapId: string, data: Omit<CreateMapZoneRequest, 'mapId'>) {
  return postJson<CreateMapZoneRequest, MapZone>(`/maps/${mapId}/zones`, { ...data, mapId });
}

/**
 * Update a map zone's display properties
 */
export function updateMapZone(mapId: string, mapZoneId: string, data: UpdateMapZoneRequest) {
  return putJson<UpdateMapZoneRequest, MapZone>(`/maps/${mapId}/zones/${mapZoneId}`, data);
}

/**
 * Delete a zone from a map
 */
export function deleteMapZone(mapId: string, mapZoneId: string) {
  return delJson<boolean>(`/maps/${mapId}/zones/${mapZoneId}`);
}
