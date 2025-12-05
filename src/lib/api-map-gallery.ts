import { getJson, postJson, putJson, delJson } from "./api-core";

export type MapTemplateCategoryEnum = 
  | "General" 
  | "Business" 
  | "Planning" 
  | "Logistics" 
  | "Research" 
  | "Operations" 
  | "Education";

export type MapGalleryStatusEnum = "Pending" | "Approved" | "Rejected";

export type MapGallerySummaryResponse = {
  id: string;
  mapId: string;
  mapName: string;
  description?: string;
  previewImage?: string;
  category?: MapTemplateCategoryEnum;
  tags: string[];
  authorName?: string;
  status: MapGalleryStatusEnum;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  publishedAt?: string;
};

export type MapGalleryDetailResponse = {
  id: string;
  mapId: string;
  userId: string;
  mapName: string;
  description?: string;
  previewImage?: string;
  category?: MapTemplateCategoryEnum;
  tags: string[];
  authorName?: string;
  authorEmail?: string;
  status: MapGalleryStatusEnum;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  publishedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

export type MapGallerySubmitRequest = {
  mapId: string;
  mapName: string;
  description?: string;
  previewImage?: string;
  category?: MapTemplateCategoryEnum;
  tags: string[];
};

export type MapGalleryUpdateRequest = {
  mapName?: string;
  description?: string;
  previewImage?: string;
  category?: MapTemplateCategoryEnum;
  tags?: string[];
};

export type MapGalleryApprovalRequest = {
  status: MapGalleryStatusEnum;
  rejectionReason?: string;
  isFeatured?: boolean;
};

// Public APIs
export function getPublishedMaps(params?: {
  category?: MapTemplateCategoryEnum;
  search?: string;
  featured?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params?.category) qs.append("category", params.category);
  if (params?.search) qs.append("search", params.search);
  if (params?.featured !== undefined) qs.append("featured", String(params.featured));
  
  const query = qs.toString();
  return getJson<MapGallerySummaryResponse[]>(
    `/map-gallery/maps${query ? `?${query}` : ""}`
  );
}

export function getPublishedMapById(id: string) {
  return getJson<MapGalleryDetailResponse>(`/map-gallery/maps/${id}`);
}

export function getPublishedMapByMapId(mapId: string) {
  return getJson<MapGalleryDetailResponse>(`/map-gallery/maps/by-map-id/${mapId}`);
}

// User APIs
export function submitMap(request: MapGallerySubmitRequest) {
  return postJson<MapGallerySubmitRequest, MapGalleryDetailResponse>(
    `/map-gallery/submit`,
    request
  );
}

export function getMySubmission(mapId: string) {
  return getJson<MapGalleryDetailResponse>(`/map-gallery/my-submission/${mapId}`);
}

export function updateMySubmission(id: string, request: MapGalleryUpdateRequest) {
  return putJson<MapGalleryUpdateRequest, MapGalleryDetailResponse>(
    `/map-gallery/my-submission/${id}`,
    request
  );
}

// Admin APIs
export function adminGetAllSubmissions(status?: MapGalleryStatusEnum) {
  const qs = status ? `?status=${status}` : "";
  return getJson<MapGallerySummaryResponse[]>(
    `/map-gallery/admin/submissions${qs}`
  );
}

export function adminGetSubmissionById(id: string) {
  return getJson<MapGalleryDetailResponse>(`/map-gallery/admin/submissions/${id}`);
}

export function adminApproveOrRejectSubmission(
  id: string,
  request: MapGalleryApprovalRequest
) {
  return postJson<MapGalleryApprovalRequest, MapGalleryDetailResponse>(
    `/map-gallery/admin/submissions/${id}/approve`,
    request
  );
}

export function adminDeleteSubmission(id: string) {
  return delJson(`/map-gallery/admin/submissions/${id}`);
}

