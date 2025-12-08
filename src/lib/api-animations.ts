import { apiFetch, getJson, putJson, delJson } from "./api-core";

export type AnimationId = string;
export type LayerId = string;

export interface LayerAnimationDto {
  layerAnimationId: string;
  layerId: string;
  name: string;
  sourceUrl: string;
  coordinates: string;
  rotationDeg: number;
  scale: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
  is_visible: boolean;
}

// ============ GET ============

// GET /api/v1/animations/layers/{layerId}
export function getAnimationsByLayer(
  layerId: LayerId
): Promise<LayerAnimationDto[]> {
  return getJson<LayerAnimationDto[]>(
    `/animations/layers/${encodeURIComponent(layerId)}`
  );
}

// GET /api/v1/animations/{animationId}
export function getAnimationById(
  animationId: AnimationId
): Promise<LayerAnimationDto> {
  return getJson<LayerAnimationDto>(
    `/animations/${encodeURIComponent(animationId)}`
  );
}

// GET /api/v1/animations/active
export function getActiveAnimations(): Promise<LayerAnimationDto[]> {
  return getJson<LayerAnimationDto[]>("/animations/active");
}

// ============ CREATE ============

export interface CreateAnimationRequest {
  layerId: string;
  name: string;
  animationFile: File;
  coordinates?: string;
  rotationDeg?: number;
  scale?: number;
  zIndex?: number;
  is_visible?: boolean;
}

// POST /api/v1/animations  (multipart/form-data)
export function createAnimation(
  payload: CreateAnimationRequest
): Promise<LayerAnimationDto> {
  const formData = new FormData();

  formData.append("layerId", payload.layerId);
  formData.append("name", payload.name);
  formData.append("animationFile", payload.animationFile);

  if (payload.coordinates !== undefined) {
    formData.append("coordinates", payload.coordinates);
  }
  if (payload.rotationDeg !== undefined) {
    formData.append("rotationDeg", String(payload.rotationDeg));
  }
  if (payload.scale !== undefined) {
    formData.append("scale", String(payload.scale));
  }
  if (payload.zIndex !== undefined) {
    formData.append("zIndex", String(payload.zIndex));
  }
  if (payload.is_visible !== undefined) {
    formData.append("is_visible", String(payload.is_visible));
  }

  return apiFetch<LayerAnimationDto>("/animations", {
    method: "POST",
    body: formData,
  });
}

// ============ UPDATE ============

export interface UpdateAnimationRequest {
  name?: string;
  animationFile?: string;
  coordinates?: string;
  rotationDeg?: number;
  scale?: number;
  zIndex?: number;
  is_visible?: boolean;
}

// PUT /api/v1/animations/{animationId}
export function updateAnimation(
  animationId: AnimationId,
  payload: UpdateAnimationRequest
): Promise<LayerAnimationDto> {
  return putJson<UpdateAnimationRequest, LayerAnimationDto>(
    `/animations/${encodeURIComponent(animationId)}`,
    payload
  );
}

// ============ DELETE ============

// DELETE /api/v1/animations/{animationId}
export function deleteAnimation(animationId: AnimationId): Promise<void> {
  return delJson<void>(`/animations/${encodeURIComponent(animationId)}`);
}
