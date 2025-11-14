import { getJson, postJson, putJson, delJson } from "./api-core";
import type { LocationType } from "@/types";

const POI_PREFIX = "/points-of-interest";


// ===== POIs (Points of Interest) =====
// Re-export LocationType for convenience
export type { LocationType };

export type CreatePoiReq = {
  mapId?: string; // Optional, will be set from route if not provided
  segmentId?: string;
  zoneId?: string;
  title: string;
  subtitle?: string;
  locationType?: LocationType;
  markerGeometry: string; 
  storyContent?: string;
  mediaResources?: string;
  displayOrder?: number;
  highlightOnEnter?: boolean;
  showTooltip?: boolean;
  tooltipContent?: string;
  effectType?: string;
  openSlideOnClick?: boolean;
  slideContent?: string;
  linkedPoiId?: string;
  playAudioOnClick?: boolean;
  audioUrl?: string;
  externalUrl?: string;
  associatedLayerId?: string;
  animationPresetId?: string;
  animationOverrides?: string;
  isVisible?: boolean;
  zIndex?: number;
  // Legacy fields for backward compatibility
  shouldPin?: boolean; // Maps to highlightOnEnter
  storyContext?: string; // Maps to storyContent
  layerUrl?: string; // Maps to associatedLayerId
};

export type UpdatePoiReq = Partial<CreatePoiReq>;

export type MapPoi = {
  poiId: string;
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
  linkedPoiId?: string;
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

export type SegmentPoi = MapPoi & {
  segmentId: string;
};

export function getMapPois(mapId: string) {
  return getJson<MapPoi[]>(`${POI_PREFIX}/${mapId}`);
}

export function createMapPoi(mapId: string, body: CreatePoiReq) {
  // Ensure LocationType is set (required by backend)
  const payload: CreatePoiReq = {
    ...body,
    mapId,
    locationType: body.locationType || "PointOfInterest",
    displayOrder: body.displayOrder ?? 0,
    highlightOnEnter: body.highlightOnEnter ?? false,
    showTooltip: body.showTooltip ?? true,
    isVisible: body.isVisible ?? true,
    zIndex: body.zIndex ?? 0,
  };
  // Remove legacy fields
  delete (payload as any).shouldPin;
  delete (payload as any).storyContext;
  delete (payload as any).layerUrl;
  return postJson<CreatePoiReq, MapPoi>(`${POI_PREFIX}/${mapId}`, payload);
}

export function getSegmentPois(mapId: string, segmentId: string) {
  return getJson<SegmentPoi[]>(`${POI_PREFIX}/${mapId}/segments/${segmentId}`);
}

export function createSegmentPoi(mapId: string, segmentId: string, body: CreatePoiReq) {
  // Ensure LocationType is set (required by backend)
  const payload: CreatePoiReq = {
    ...body,
    mapId,
    segmentId,
    locationType: body.locationType || "PointOfInterest",
    displayOrder: body.displayOrder ?? 0,
    highlightOnEnter: body.highlightOnEnter ?? false,
    showTooltip: body.showTooltip ?? true,
    isVisible: body.isVisible ?? true,
    zIndex: body.zIndex ?? 0,
  };
  // Remove legacy fields
  delete (payload as any).shouldPin;
  delete (payload as any).storyContext;
  delete (payload as any).layerUrl;
  return postJson<CreatePoiReq, SegmentPoi>(`${POI_PREFIX}/${mapId}/segments/${segmentId}`, payload);
}

export function updatePoi(poiId: string, body: UpdatePoiReq) {
  return putJson<UpdatePoiReq, MapPoi>(`${POI_PREFIX}/${poiId}`, body);
}

export function deletePoi(poiId: string) {
  return delJson<void>(`${POI_PREFIX}/${poiId}`);
}

// ===== POI Display / Interaction Config =====
export type UpdatePoiDisplayConfigReq = {
  isVisible?: boolean;
  zIndex?: number;
  showTooltip?: boolean;
  tooltipContent?: string | null;
};

export type UpdatePoiInteractionConfigReq = {
  openSlideOnClick?: boolean;
  playAudioOnClick?: boolean;
  audioUrl?: string | null;
  externalUrl?: string | null;
};

export function updatePoiDisplayConfig(poiId: string, body: UpdatePoiDisplayConfigReq) {
  return putJson<UpdatePoiDisplayConfigReq, MapPoi>(`${POI_PREFIX}/pois/${poiId}/display-config`, body);
}

export function updatePoiInteractionConfig(poiId: string, body: UpdatePoiInteractionConfigReq) {
  return putJson<UpdatePoiInteractionConfigReq, MapPoi>(`${POI_PREFIX}/pois/${poiId}/interaction-config`, body);
}

