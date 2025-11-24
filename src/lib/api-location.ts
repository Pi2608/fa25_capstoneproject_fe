import { getJson, postJson, putJson, delJson } from "./api-core";
import type { LocationType } from "@/types";

const LOCATION_PREFIX = "/locations";


// ===== Locations =====
// Re-export LocationType for convenience
export type { LocationType };

export type CreateLocationReq = {
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
  linkedLocationId?: string;
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


export function createMapLocation(mapId: string, body: CreateLocationReq) {
  // Ensure LocationType is set (required by backend)
  const payload: CreateLocationReq = {
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
  return postJson<CreateLocationReq, MapLocation>(`${LOCATION_PREFIX}/${mapId}`, payload);
}

export function getSegmentLocations(mapId: string, segmentId: string) {
  return getJson<SegmentLocation[]>(`${LOCATION_PREFIX}/${mapId}/segments/${segmentId}`);
}

export function createSegmentLocation(mapId: string, segmentId: string, body: CreateLocationReq) {
  // Ensure LocationType is set (required by backend)
  const payload: CreateLocationReq = {
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
  return postJson<CreateLocationReq, SegmentLocation>(`${LOCATION_PREFIX}/${mapId}/segments/${segmentId}`, payload);
}

export function updateLocation(locationId: string, body: UpdateLocationReq) {
  return putJson<UpdateLocationReq, MapLocation>(`${LOCATION_PREFIX}/${locationId}`, body);
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

