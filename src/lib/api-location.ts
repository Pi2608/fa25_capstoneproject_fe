import { getJson, postJson, putJson, delJson, postFormData, apiFetch } from "./api-core";
import type { LocationType } from "@/types";

const LOCATION_PREFIX = "/locations";


// ===== Locations =====
// Re-export LocationType for convenience
export type { LocationType };

export type CreateLocationReq = {
  mapId: string;
  zoneId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  locationType: LocationType; // Required in backend
  markerGeometry: string;
  mediaResources?: string;
  displayOrder?: number;
  rotation: string;
  iconType?: string;
  iconColor?: string;
  iconSize?: number; // Default: 32
  zIndex?: number; // Default: 100
  showTooltip?: boolean; // Default: true
  tooltipContent?: string;
  iconUrl?: string;
  audioUrl?: string;
  openPopupOnClick?: boolean; // Default: false
  popupContent?: string;
  playAudioOnClick?: boolean; // Default: false
  entryDelayMs?: number; // Default: 0
  entryDurationMs?: number; // Default: 400
  exitDelayMs?: number; // Default: 0
  exitDurationMs?: number; // Default: 400
  entryEffect?: string; // Default: "fade"
  exitEffect?: string; // Default: "fade"
  linkedLocationId?: string;
  externalUrl?: string;
  isVisible?: boolean; // Default: true
  audioFile?: File | Blob;
  iconFile?: File | Blob;
};

export type UpdateLocationReq = Partial<CreateLocationReq>;

export type MapLocation = {
  locationId: string;
  mapId: string;
  segmentId?: string;
  zoneId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  locationType?: LocationType;
  markerGeometry: string;
  storyContent?: string;

  // Icon configuration
  iconType?: string; // Emoji or text
  iconUrl?: string; // Custom icon image URL
  iconColor?: string; // Color for emoji/text icons
  iconSize?: number; // Size in pixels

  // Display
  displayOrder?: number;
  isVisible?: boolean;
  zIndex?: number;
  rotation: string;

  // Tooltip & Popup
  showTooltip?: boolean;
  tooltipContent?: string;
  openSlideOnClick?: boolean;
  slideContent?: string;

  // Media & Audio
  mediaResources?: string; // URLs separated by newlines
  playAudioOnClick?: boolean;
  audioUrl?: string;

  // Animation effects
  entryEffect?: string; // fade, scale, slide-up, bounce, none
  exitEffect?: string;
  entryDelayMs?: number;
  entryDurationMs?: number;
  exitDelayMs?: number;
  exitDurationMs?: number;

  // Links
  linkedLocationId?: string;
  externalUrl?: string;

  // Other
  highlightOnEnter?: boolean;
  effectType?: string;
  associatedLayerId?: string;
  animationPresetId?: string;
  animationOverrides?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;

  // Legacy fields for backward compatibility
  shouldPin?: boolean; // Maps to highlightOnEnter
};

export type SegmentLocation = MapLocation & {
  segmentId: string;
};

export function getMapLocations(mapId: string) {
  return getJson<MapLocation[]>(`${LOCATION_PREFIX}/${mapId}`);
}

// Helper function to build FormData from CreateLocationReq
function buildLocationFormData(payload: CreateLocationReq): FormData {
  const formData = new FormData();

  // Required fields
  formData.append("mapId", payload.mapId);
  formData.append("title", payload.title);
  formData.append("locationType", payload.locationType);
  formData.append("markerGeometry", payload.markerGeometry);

  // Optional string fields
  if (payload.zoneId) formData.append("zoneId", payload.zoneId);
  if (payload.subtitle) formData.append("subtitle", payload.subtitle);
  if (payload.description) formData.append("description", payload.description);
  if (payload.mediaResources) formData.append("mediaResources", payload.mediaResources);
  if (payload.iconType) formData.append("iconType", payload.iconType);
  if (payload.iconColor) formData.append("iconColor", payload.iconColor);
  if (payload.tooltipContent) formData.append("tooltipContent", payload.tooltipContent);
  if (payload.iconUrl) formData.append("iconUrl", payload.iconUrl);
  if (payload.audioUrl) formData.append("audioUrl", payload.audioUrl);
  if (payload.popupContent) formData.append("popupContent", payload.popupContent);
  if (payload.entryEffect) formData.append("entryEffect", payload.entryEffect);
  if (payload.exitEffect) formData.append("exitEffect", payload.exitEffect);
  if (payload.linkedLocationId) formData.append("linkedLocationId", payload.linkedLocationId);
  if (payload.externalUrl) formData.append("externalUrl", payload.externalUrl);

  // Optional number fields
  if (payload.displayOrder !== undefined) formData.append("displayOrder", String(payload.displayOrder));
  if (payload.iconSize !== undefined) formData.append("iconSize", String(payload.iconSize));
  if (payload.zIndex !== undefined) formData.append("zIndex", String(payload.zIndex));
  if (payload.entryDelayMs !== undefined) formData.append("entryDelayMs", String(payload.entryDelayMs));
  if (payload.entryDurationMs !== undefined) formData.append("entryDurationMs", String(payload.entryDurationMs));
  if (payload.exitDelayMs !== undefined) formData.append("exitDelayMs", String(payload.exitDelayMs));
  if (payload.exitDurationMs !== undefined) formData.append("exitDurationMs", String(payload.exitDurationMs));

  // Optional boolean fields
  if (payload.showTooltip !== undefined) formData.append("showTooltip", String(payload.showTooltip));
  if (payload.openPopupOnClick !== undefined) formData.append("openPopupOnClick", String(payload.openPopupOnClick));
  if (payload.playAudioOnClick !== undefined) formData.append("playAudioOnClick", String(payload.playAudioOnClick));
  if (payload.isVisible !== undefined) formData.append("isVisible", String(payload.isVisible));

  // File uploads
  if (payload.audioFile) formData.append("audioFile", payload.audioFile);
  if (payload.iconFile) formData.append("iconFile", payload.iconFile);

  return formData;
}

export function createMapLocation(mapId: string, body: Omit<CreateLocationReq, 'mapId'>) {
  // Ensure required fields are set with defaults from backend
  if (!body.locationType) {
    throw new Error("locationType is required when creating a location");
  }
  
  const payload: CreateLocationReq = {
    ...body,
    mapId,
    locationType: body.locationType,
    displayOrder: body.displayOrder ?? 0,
    rotation:body.rotation ?? "",
    zIndex: body.zIndex ?? 100,
    showTooltip: body.showTooltip ?? true,
    iconSize: body.iconSize ?? 32,
    isVisible: body.isVisible ?? true,
    openPopupOnClick: body.openPopupOnClick ?? false,
    playAudioOnClick: body.playAudioOnClick ?? false,
    entryDelayMs: body.entryDelayMs ?? 0,
    entryDurationMs: body.entryDurationMs ?? 400,
    exitDelayMs: body.exitDelayMs ?? 0,
    exitDurationMs: body.exitDurationMs ?? 400,
    entryEffect: body.entryEffect ?? "fade",
    exitEffect: body.exitEffect ?? "fade",
  };

  const formData = buildLocationFormData(payload);
  return postFormData<MapLocation>(`${LOCATION_PREFIX}/${mapId}`, formData);
}

export function getSegmentLocations(mapId: string, segmentId: string) {
  return getJson<SegmentLocation[]>(`${LOCATION_PREFIX}/${mapId}/segments/${segmentId}`);
}

export function createSegmentLocation(mapId: string, segmentId: string, body: Omit<CreateLocationReq, 'mapId'>) {
  // Ensure required fields are set with defaults from backend
  if (!body.locationType) {
    throw new Error("locationType is required when creating a location");
  }
  
  const payload: CreateLocationReq = {
    ...body,
    mapId,
    locationType: body.locationType,
    displayOrder: body.displayOrder ?? 0,
    zIndex: body.zIndex ?? 100,
    showTooltip: body.showTooltip ?? true,
    iconSize: body.iconSize ?? 32,
    isVisible: body.isVisible ?? true,
    openPopupOnClick: body.openPopupOnClick ?? false,
    playAudioOnClick: body.playAudioOnClick ?? false,
    entryDelayMs: body.entryDelayMs ?? 0,
    entryDurationMs: body.entryDurationMs ?? 400,
    exitDelayMs: body.exitDelayMs ?? 0,
    exitDurationMs: body.exitDurationMs ?? 400,
    entryEffect: body.entryEffect ?? "fade",
    exitEffect: body.exitEffect ?? "fade",
  };

  const formData = buildLocationFormData(payload);
  return postFormData<SegmentLocation>(`${LOCATION_PREFIX}/${mapId}/segments/${segmentId}`, formData);
}

// Build FormData for update (all fields optional)
function buildLocationUpdateFormData(payload: UpdateLocationReq): FormData {
  const formData = new FormData();

  // Optional fields (strings)
  if (payload.mapId) formData.append("mapId", payload.mapId as any);
  if (payload.title) formData.append("title", payload.title);
  if (payload.zoneId) formData.append("zoneId", payload.zoneId);
  if (payload.subtitle) formData.append("subtitle", payload.subtitle);
  if (payload.description) formData.append("description", payload.description);
  if (payload.mediaResources) formData.append("mediaResources", payload.mediaResources);
  if (payload.iconType) formData.append("iconType", payload.iconType);
  if (payload.iconColor) formData.append("iconColor", payload.iconColor);
  if (payload.tooltipContent) formData.append("tooltipContent", payload.tooltipContent);
  if (payload.iconUrl) formData.append("iconUrl", payload.iconUrl);
  if (payload.audioUrl) formData.append("audioUrl", payload.audioUrl);
  if (payload.popupContent) formData.append("popupContent", payload.popupContent);
  if (payload.entryEffect) formData.append("entryEffect", payload.entryEffect);
  if (payload.exitEffect) formData.append("exitEffect", payload.exitEffect);
  if (payload.linkedLocationId) formData.append("linkedLocationId", payload.linkedLocationId);
  if (payload.externalUrl) formData.append("externalUrl", payload.externalUrl);
  if (payload.markerGeometry) formData.append("markerGeometry", payload.markerGeometry);
  if (payload.locationType) formData.append("locationType", payload.locationType);

  // Optional numbers
  if (payload.displayOrder !== undefined) formData.append("displayOrder", String(payload.displayOrder));
  if (payload.iconSize !== undefined) formData.append("iconSize", String(payload.iconSize));
  if (payload.zIndex !== undefined) formData.append("zIndex", String(payload.zIndex));
  if (payload.entryDelayMs !== undefined) formData.append("entryDelayMs", String(payload.entryDelayMs));
  if (payload.entryDurationMs !== undefined) formData.append("entryDurationMs", String(payload.entryDurationMs));
  if (payload.exitDelayMs !== undefined) formData.append("exitDelayMs", String(payload.exitDelayMs));
  if (payload.exitDurationMs !== undefined) formData.append("exitDurationMs", String(payload.exitDurationMs));

  // Optional booleans
  if (payload.showTooltip !== undefined) formData.append("showTooltip", String(payload.showTooltip));
  if (payload.openPopupOnClick !== undefined) formData.append("openPopupOnClick", String(payload.openPopupOnClick));
  if (payload.playAudioOnClick !== undefined) formData.append("playAudioOnClick", String(payload.playAudioOnClick));
  if (payload.isVisible !== undefined) formData.append("isVisible", String(payload.isVisible));

  // File uploads
  if (payload.audioFile) formData.append("audioFile", payload.audioFile);
  if (payload.iconFile) formData.append("iconFile", payload.iconFile);

  return formData;
}

export function updateLocation(locationId: string, body: UpdateLocationReq) {
  const formData = buildLocationUpdateFormData(body);
  return apiFetch<MapLocation>(`${LOCATION_PREFIX}/${locationId}`, {
    method: "PUT",
    body: formData,
  });
}

export function deleteLocation(locationId: string) {
  return delJson<void>(`${LOCATION_PREFIX}/${locationId}`);
}

// ===== POI Display / Interaction Config =====
export type UpdateLocationDisplayConfigReq = {
  isVisible?: boolean;
  zIndex?: number;
  showTooltip?: boolean;
  tooltipContent?: string | null;
};

export type UpdateLocationInteractionConfigReq = {
  openSlideOnClick?: boolean;
  playAudioOnClick?: boolean;
  audioUrl?: string | null;
  externalUrl?: string | null;
};

export function updateLocationDisplayConfig(locationId: string, body: UpdateLocationDisplayConfigReq) {
  return putJson<UpdateLocationDisplayConfigReq, MapLocation>(`${LOCATION_PREFIX}/${locationId}/display-config`, body);
}

export function updateLocationInteractionConfig(locationId: string, body: UpdateLocationInteractionConfigReq) {
  return putJson<UpdateLocationInteractionConfigReq, MapLocation>(`${LOCATION_PREFIX}/${locationId}/interaction-config`, body);
}

