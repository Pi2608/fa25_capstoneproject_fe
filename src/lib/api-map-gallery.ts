import { getJson, putJson, delJson, postJson } from "./api-core";

export type MapGalleryCategory =
  | "general"
  | "business"
  | "planning"
  | "logistics"
  | "research"
  | "operations"
  | "education";

export type MapGalleryStatus = "pending" | "approved" | "rejected" | string;

export type MapGalleryStatusEnum = "Pending" | "Approved" | "Rejected";

export type MapGallerySummaryResponse = {
  id: string;
  mapId: string;
  mapName: string;
  description: string;
  previewImage: string | null;
  category: MapGalleryCategory;
  tags: string[];
  authorName: string;
  status: MapGalleryStatusEnum | MapGalleryStatus;
  isFeatured: boolean;
  isStoryMap: boolean;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  publishedAt: string | null;
};

export type MapGalleryDetailResponse = {
  id: string;
  mapId: string;
  userId: string;
  mapName: string;
  description: string;
  previewImage: string | null;
  category: MapGalleryCategory;
  tags: string[];
  authorName: string;
  authorEmail: string;
  status: MapGalleryStatusEnum | MapGalleryStatus;
  isFeatured: boolean;
  isStoryMap: boolean;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  publishedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type MapGallerySubmitRequest = {
  mapId: string;
  mapName: string;
  description: string;
  previewImage: string | null;
  category: MapGalleryCategory;
  tags: string[];
};

export type MapGalleryUpdateRequest = {
  mapName: string;
  description: string;
  previewImage: string | null;
  category: MapGalleryCategory;
  tags: string[];
};

export type MapGalleryAdminApprovalRequest = {
  status: MapGalleryStatus;
  rejectionReason?: string | null;
  isFeatured?: boolean;
};

export type MapGalleryApprovalRequest = {
  status: MapGalleryStatusEnum;
  rejectionReason?: string | null;
  isFeatured?: boolean;
};

export type MapGalleryDuplicateRequest = {
  customName?: string;
  customDescription?: string;
  isPublic?: boolean;
  workspaceId?: string;
  customInitialLatitude?: number;
  customInitialLongitude?: number;
  customInitialZoom?: number;
};

export type MapGalleryDuplicateResponse = {
  mapId: string;
  mapName: string;
  sourceMapName: string;
  layersCreated: number;
  imagesCreated: number;
  createdAt: string;
  message: string;
};

export async function getPublishedGalleryMaps(params?: {
  category?: MapGalleryCategory;
  search?: string;
  featured?: boolean;
  isStoryMap?: boolean;
}): Promise<MapGallerySummaryResponse[]> {
  const sp = new URLSearchParams();
  if (params?.category) sp.set("category", params.category);
  if (params?.search) sp.set("search", params.search);
  if (typeof params?.featured === "boolean") {
    sp.set("featured", String(params.featured));
  }
  if (typeof params?.isStoryMap === "boolean") {
    sp.set("isStoryMap", String(params.isStoryMap));
  }
  const qs = sp.toString();
  const url = qs ? `/map-gallery/maps?${qs}` : `/map-gallery/maps`;
  return getJson<MapGallerySummaryResponse[]>(url);
}

export async function getPublishedGalleryMapById(
  id: string
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/maps/${encodeURIComponent(id)}`;
  return getJson<MapGalleryDetailResponse>(url);
}

export async function getPublishedGalleryMapByMapId(
  mapId: string
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/maps/by-map-id/${encodeURIComponent(mapId)}`;
  return getJson<MapGalleryDetailResponse>(url);
}

export async function submitMapToGallery(
  payload: MapGallerySubmitRequest
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/submit`;
    return postJson(url, payload);
}

export async function getMyGallerySubmission(
  mapId: string
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/my-submission/${encodeURIComponent(mapId)}`;
  return getJson<MapGalleryDetailResponse>(url);
}

export async function updateMyGallerySubmission(
  id: string,
  payload: MapGalleryUpdateRequest
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/my-submission/${encodeURIComponent(id)}`;
    return putJson(url, payload);
}

export async function adminGetGallerySubmissions(params?: {
  status?: MapGalleryStatus;
}): Promise<MapGallerySummaryResponse[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  const qs = sp.toString();
  const url = qs
    ? `/map-gallery/admin/submissions?${qs}`
    : `/map-gallery/admin/submissions`;
  return getJson<MapGallerySummaryResponse[]>(url);
}

export async function adminGetAllSubmissions(
  status?: MapGalleryStatusEnum
): Promise<MapGallerySummaryResponse[]> {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  const qs = sp.toString();
  const url = qs
    ? `/map-gallery/admin/submissions?${qs}`
    : `/map-gallery/admin/submissions`;
  return getJson<MapGallerySummaryResponse[]>(url);
}

export async function adminGetGallerySubmissionById(
  id: string
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/admin/submissions/${encodeURIComponent(id)}`;
  return getJson<MapGalleryDetailResponse>(url);
}

export async function adminDeleteGallerySubmission(id: string): Promise<void> {
  const url = `/map-gallery/admin/submissions/${encodeURIComponent(id)}`;
  await delJson<void>(url);
}

export async function adminDeleteSubmission(id: string): Promise<void> {
  const url = `/map-gallery/admin/submissions/${encodeURIComponent(id)}`;
  await delJson<void>(url);
}

export async function adminApproveOrRejectGallerySubmission(
  id: string,
  payload: MapGalleryAdminApprovalRequest
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/admin/submissions/${encodeURIComponent(
    id
  )}/approve`;
    return putJson(url, payload);
}

export async function adminApproveOrRejectSubmission(
  id: string,
  payload: MapGalleryApprovalRequest
): Promise<MapGalleryDetailResponse> {
  const url = `/map-gallery/admin/submissions/${encodeURIComponent(
    id
  )}/approve`;
  return putJson(url, payload);
}

export async function duplicateMapFromGallery(
  galleryId: string,
  payload: MapGalleryDuplicateRequest
): Promise<MapGalleryDuplicateResponse> {
  const url = `/map-gallery/maps/${encodeURIComponent(galleryId)}/duplicate`;
  return postJson<MapGalleryDuplicateRequest, MapGalleryDuplicateResponse>(url, payload);
}

export async function incrementGalleryMapView(galleryId: string): Promise<void> {
  const url = `/map-gallery/maps/${encodeURIComponent(galleryId)}/view`;
  await postJson(url, {});
}

export async function toggleGalleryMapLike(galleryId: string): Promise<{ success: boolean; isLiked: boolean }> {
  const url = `/map-gallery/maps/${encodeURIComponent(galleryId)}/like`;
  return postJson(url, {});
}