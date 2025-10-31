/**
 * Maps, Templates, Layers, Features & Publishing API
 */

import { getJson, postJson, putJson, delJson, patchJson, apiFetch, getToken, ApiErrorShape } from "./api-core";

// ===== TYPES =====
export type ViewState = { center: [number, number]; zoom: number };
export type BaseMapProvider = "OSM" | "Satellite" | "Dark";
export type MapStatus = "Draft" | "UnderReview" | "Published" | "Unpublished" | "Archived";

export type MapDto = {
  id: string;
  name: string;
  ownerId?: string;
  description?: string;
  previewImageUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

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
  status?: MapStatus;
  publishedAt?: string;
  isPublic?: boolean;
  isActive?: boolean;
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

// ===== MAP CRUD =====
export interface CreateMapRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  defaultBounds?: string;
  viewState?: string;
  baseMapProvider?: BaseMapProvider;
  workspaceId?: string | null;
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
      // ignore malformed view state input
    }
  }

  const finalViewState =
    req.viewState ??
    JSON.stringify({
      center,
      zoom,
    });

  const body = {
    Name: req.name,
    Description: req.description ?? null,
    IsPublic: req.isPublic,
    DefaultBounds: req.defaultBounds ?? null,
    ViewState: finalViewState,
    BaseMapProvider: req.baseMapProvider ?? "OSM",
    WorkspaceId: req.workspaceId ?? null,
  };

  return postJson<typeof body, CreateMapResponse>("/maps", body);
}

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
export interface PublishMapResponse {
  success: boolean;
  message?: string;
}

export function publishMap(mapId: string) {
  return postJson<void, PublishMapResponse>(`/maps/${mapId}/publish`, undefined);
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
  } catch {}
  
  try {
    const res = await getJson<MapViewsResponse | number>(`/maps/${mapId}/stats`);
    if (typeof res === "number") return res;
    if (res && typeof res === "object") {
      if (typeof res.views === "number") return res.views;
      if (typeof res.viewsMonthly === "number") return res.viewsMonthly;
      if (typeof res.total === "number") return res.total;
      if (typeof res.month === "number") return res.month;
    }
  } catch {}
  
  try {
    const res = await getJson<MapViewsResponse | number>(`/analytics/maps/${mapId}/views`);
    if (typeof res === "number") return res;
    if (res && typeof res === "object") {
      if (typeof res.views === "number") return res.views;
      if (typeof res.viewsMonthly === "number") return res.viewsMonthly;
      if (typeof res.total === "number") return res.total;
      if (typeof res.month === "number") return res.month;
    }
  } catch {}
  
  try {
    const res = await getJson<MapViewsResponse | number>(`/analytics/map-views?mapId=${encodeURIComponent(mapId)}`);
    if (typeof res === "number") return res;
    if (res && typeof res === "object") {
      if (typeof res.views === "number") return res.views;
      if (typeof res.viewsMonthly === "number") return res.viewsMonthly;
      if (typeof res.total === "number") return res.total;
      if (typeof res.month === "number") return res.month;
    }
  } catch {}
  
  return 0;
}

export async function getMultipleMapViews(mapIds: string[]): Promise<number[]> {
  const results = await Promise.allSettled(mapIds.map(id => getMapViews(id)));
  return results.map(result => result.status === "fulfilled" ? result.value : 0);
}
