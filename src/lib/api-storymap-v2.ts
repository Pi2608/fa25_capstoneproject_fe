/**
 * StoryMap API v2 - Aligned with Backend Architecture
 * 
 * Changes from v1:
 * - Segment: Added cameraState, autoAdvance, durationMs
 * - Zone: Master data pattern (select from library, not create geometry)
 * - TimelineStep → TimelineTransition (camera animation between segments)
 * - POI → Location (rename for consistency)
 * - AnimatedLayer: NEW (GIF/Video overlays)
 * - Story Element Layer: REMOVED (no longer exists)
 */

import { getJson, postJson, putJson, delJson } from "./api-core";

// ================== TYPES ==================

// Camera State
export type CameraState = {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing?: number;
  pitch?: number;
};

// Segment (Slide trong StoryMap)
export type Segment = {
  segmentId: string;
  mapId: string;
  name: string;
  summary?: string;
  storyContent?: string;
  displayOrder: number;
  cameraState: string; // JSON stringify của CameraState
  autoAdvance: boolean;
  durationMs: number;
  requireUserAction: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type CreateSegmentRequest = {
  mapId?: string; // Will be enriched by endpoint
  name: string;
  summary?: string;
  storyContent?: string;
  displayOrder?: number;
  cameraState?: string;
  playbackMode?: "Auto" | "Manual" | "Timed";
};

export type UpdateSegmentRequest = {
  name: string;
  summary?: string;
  storyContent?: string;
  displayOrder?: number;
  cameraState?: string;
  playbackMode?: "Auto" | "Manual" | "Timed";
};

// Zone (Master Data - Administrative boundaries)
export type Zone = {
  zoneId: string;
  externalId?: string;
  zoneCode?: string;
  name: string;
  zoneType: string; // "Country", "Province", "District", "Ward"
  adminLevel?: number;
  parentZoneId?: string;
  geometry: string; // GeoJSON
  simplifiedGeometry?: string;
  centroid?: string;
  boundingBox?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
};

// SegmentZone (Link Segment → Zone với highlight config)
export type SegmentZone = {
  segmentZoneId: string;
  segmentId: string;
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
  
  // Animation
  entryDelayMs?: number;
  entryDurationMs?: number;
  exitDelayMs?: number;
  exitDurationMs?: number;
  entryEffect?: string;
  exitEffect?: string;
  
  fitBoundsOnEntry: boolean;
  cameraOverride?: string;
  createdAt: string;
};

export type CreateSegmentZoneRequest = {
  segmentId?: string; // Will be enriched
  zoneId: string; // ⭐ Select from Zone master data
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
  entryDelayMs?: number;
  entryDurationMs?: number;
  entryEffect?: string;
  fitBoundsOnEntry?: boolean;
};

export type UpdateSegmentZoneRequest = CreateSegmentZoneRequest;

// SegmentLayer (Link Segment → Layer)
export type SegmentLayer = {
  segmentLayerId: string;
  segmentId: string;
  layerId: string;
  displayOrder: number;
  isVisible: boolean;
  opacity: number;
  zIndex: number;
  entryDelayMs?: number;
  entryDurationMs?: number;
  exitDelayMs?: number;
  exitDurationMs?: number;
  entryEffect?: string;
  exitEffect?: string;
  styleOverride?: string;
  createdAt: string;
};

export type AttachLayerRequest = {
  layerId: string;
  displayOrder?: number;
  isVisible?: boolean;
  opacity?: number;
  zIndex?: number;
};

// Location (POI markers)
export type Location = {
  locationId: string;
  segmentId: string;
  title: string;
  subtitle?: string;
  description?: string;
  locationType: "POI" | "Marker" | "Annotation";
  markerGeometry: string; // GeoJSON Point
  iconType?: string;
  iconUrl?: string;
  iconColor?: string;
  iconSize?: number;
  displayOrder: number;
  showTooltip: boolean;
  tooltipContent?: string;
  openPopupOnClick: boolean;
  popupContent?: string;
  mediaUrls?: string;
  playAudioOnClick: boolean;
  audioUrl?: string;
  entryDelayMs?: number;
  entryDurationMs?: number;
  exitDelayMs?: number;
  exitDurationMs?: number;
  entryEffect?: string;
  exitEffect?: string;
  linkedSegmentId?: string;
  linkedLocationId?: string;
  externalUrl?: string;
  isVisible: boolean;
  zIndex: number;
  createdAt: string;
};

// TimelineTransition (Camera animation between segments)
export type TimelineTransition = {
  timelineTransitionId: string;
  mapId: string;
  fromSegmentId: string;
  toSegmentId: string;
  transitionName?: string;
  durationMs: number;
  transitionType: "Jump" | "Ease" | "Linear";
  animateCamera: boolean;
  cameraAnimationType: "Jump" | "Ease" | "Fly";
  cameraAnimationDurationMs: number;
  showOverlay: boolean;
  overlayContent?: string;
  autoTrigger: boolean;
  requireUserAction: boolean;
  triggerButtonText?: string;
  createdAt: string;
};

export type CreateTransitionRequest = {
  mapId?: string; // Will be enriched
  fromSegmentId: string;
  toSegmentId: string;
  transitionName?: string;
  durationMs?: number;
  transitionType?: "Jump" | "Ease" | "Linear";
  animateCamera?: boolean;
  cameraAnimationType?: "Jump" | "Ease" | "Fly";
  cameraAnimationDurationMs?: number;
  showOverlay?: boolean;
  overlayContent?: string;
  autoTrigger?: boolean;
  requireUserAction?: boolean;
};

// AnimatedLayer (GIF/Video overlays)
export type AnimatedLayer = {
  animatedLayerId: string;
  layerId?: string;
  segmentId?: string;
  name: string;
  description?: string;
  displayOrder: number;
  mediaType: "GIF" | "Video" | "Lottie";
  sourceUrl: string;
  thumbnailUrl?: string;
  coordinates?: string; // GeoJSON for map overlay
  isScreenOverlay: boolean;
  screenPosition?: string;
  rotationDeg: number;
  scale: number;
  opacity: number;
  zIndex: number;
  cssFilter?: string;
  autoPlay: boolean;
  loop: boolean;
  playbackSpeed: number;
  startTimeMs?: number;
  endTimeMs?: number;
  entryDelayMs?: number;
  entryDurationMs?: number;
  entryEffect?: string;
  exitDelayMs?: number;
  exitDurationMs?: number;
  exitEffect?: string;
  enableClick: boolean;
  onClickAction?: string;
  isVisible: boolean;
  createdAt: string;
};

export type AnimatedLayerPreset = {
  animatedLayerPresetId: string;
  name: string;
  description?: string;
  category: string; // "Weather", "Effects", "Nature"
  tags?: string;
  mediaType: "GIF" | "Video" | "Lottie";
  sourceUrl: string;
  thumbnailUrl?: string;
  defaultCoordinates?: string;
  defaultIsScreenOverlay: boolean;
  defaultScreenPosition?: string;
  defaultScale: number;
  defaultOpacity: number;
  defaultAutoPlay: boolean;
  defaultLoop: boolean;
  isSystemPreset: boolean;
  isPublic: boolean;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
};

// ================== SEGMENT APIs ==================

export async function getSegments(mapId: string): Promise<Segment[]> {
  const response = await getJson<Segment[]>(`/storymaps/${mapId}/segments`);
  return response || [];
}

export async function getSegment(mapId: string, segmentId: string): Promise<Segment> {
  return await getJson<Segment>(`/storymaps/${mapId}/segments/${segmentId}`);
}

export async function createSegment(mapId: string, data: CreateSegmentRequest): Promise<Segment> {
  return await postJson<CreateSegmentRequest, Segment>(`/storymaps/${mapId}/segments`, data);
}

export async function updateSegment(mapId: string, segmentId: string, data: UpdateSegmentRequest): Promise<Segment> {
  return await putJson<UpdateSegmentRequest, Segment>(`/storymaps/${mapId}/segments/${segmentId}`, data);
}

export async function deleteSegment(mapId: string, segmentId: string): Promise<void> {
  await delJson<void>(`/storymaps/${mapId}/segments/${segmentId}`);
}

export async function duplicateSegment(mapId: string, segmentId: string): Promise<Segment> {
  return await postJson<{}, Segment>(`/storymaps/${mapId}/segments/${segmentId}/duplicate`, {});
}

export async function reorderSegments(mapId: string, segmentIds: string[]): Promise<Segment[]> {
  return await postJson<string[], Segment[]>(`/storymaps/${mapId}/segments/reorder`, segmentIds);
}

// ================== ZONE APIs (Master Data) ==================

export async function getZones(): Promise<Zone[]> {
  return await getJson<Zone[]>(`/zones`);
}

export async function getZonesByParent(parentZoneId?: string): Promise<Zone[]> {
  const url = parentZoneId 
    ? `/zones/parent/${parentZoneId}`
    : `/zones/parent`;
  return await getJson<Zone[]>(url);
}

export async function searchZones(searchTerm: string): Promise<Zone[]> {
  return await getJson<Zone[]>(`/zones/search?q=${encodeURIComponent(searchTerm)}`);
}

export async function createZone(data: any): Promise<Zone> {
  return await postJson<any, Zone>(`/zones`, data);
}

// ================== SEGMENT ZONE APIs ==================

export async function getSegmentZones(mapId: string, segmentId: string): Promise<SegmentZone[]> {
  const response = await getJson<SegmentZone[]>(`/storymaps/${mapId}/segments/${segmentId}/zones`);
  return response || [];
}

export async function createSegmentZone(
  mapId: string, 
  segmentId: string, 
  data: CreateSegmentZoneRequest
): Promise<SegmentZone> {
  return await postJson<CreateSegmentZoneRequest, SegmentZone>(`/storymaps/${mapId}/segments/${segmentId}/zones`, data);
}

export async function updateSegmentZone(
  mapId: string,
  segmentId: string,
  zoneId: string,
  data: UpdateSegmentZoneRequest
): Promise<SegmentZone> {
  return await putJson<UpdateSegmentZoneRequest, SegmentZone>(`/storymaps/${mapId}/segments/${segmentId}/zones/${zoneId}`, data);
}

export async function deleteSegmentZone(mapId: string, segmentId: string, zoneId: string): Promise<void> {
  await delJson<void>(`/storymaps/${mapId}/segments/${segmentId}/zones/${zoneId}`);
}

// ================== SEGMENT LAYER APIs ==================

export async function getSegmentLayers(mapId: string, segmentId: string): Promise<SegmentLayer[]> {
  const response = await getJson<SegmentLayer[]>(`/storymaps/${mapId}/segments/${segmentId}/layers`);
  return response || [];
}

export async function attachLayerToSegment(
  mapId: string,
  segmentId: string,
  data: AttachLayerRequest
): Promise<SegmentLayer> {
  return await postJson<AttachLayerRequest, SegmentLayer>(`/storymaps/${mapId}/segments/${segmentId}/layers`, data);
}

export async function detachLayerFromSegment(
  mapId: string,
  segmentId: string,
  layerId: string
): Promise<void> {
  await delJson<void>(`/storymaps/${mapId}/segments/${segmentId}/layers/${layerId}`);
}

// ================== LOCATION (POI) APIs ==================

export async function getSegmentLocations(mapId: string, segmentId: string): Promise<Location[]> {
  const response = await getJson<Location[]>(`/storymaps/${mapId}/segments/${segmentId}/locations`);
  return response || [];
}

// ================== TIMELINE TRANSITION APIs ==================

export async function getTimelineTransitions(mapId: string): Promise<TimelineTransition[]> {
  return await getJson<TimelineTransition[]>(`/timeline-transitions/${mapId}`);
}

export async function createTimelineTransition(
  mapId: string,
  data: CreateTransitionRequest
): Promise<TimelineTransition> {
  return await postJson<CreateTransitionRequest, TimelineTransition>(`/timeline-transitions/${mapId}`, data);
}

export async function generateTransition(
  mapId: string,
  fromSegmentId: string,
  toSegmentId: string
): Promise<TimelineTransition> {
  return await postJson<{ fromSegmentId: string; toSegmentId: string }, TimelineTransition>(
    `/timeline-transitions/${mapId}/generate`,
    { fromSegmentId, toSegmentId }
  );
}

export async function deleteTimelineTransition(mapId: string, transitionId: string): Promise<void> {
  await delJson<void>(`/timeline-transitions/${mapId}/${transitionId}`);
}

// ================== ANIMATED LAYER APIs ==================

export async function getAnimatedLayers(mapId: string): Promise<AnimatedLayer[]> {
  return await getJson<AnimatedLayer[]>(`/animated-layers/map/${mapId}`);
}

export async function getAnimatedLayersBySegment(mapId: string, segmentId: string): Promise<AnimatedLayer[]> {
  return await getJson<AnimatedLayer[]>(`/animated-layers/segment/${segmentId}`);
}

export async function createAnimatedLayer(data: any): Promise<AnimatedLayer> {
  return await postJson<any, AnimatedLayer>(`/animated-layers`, data);
}

export async function updateAnimatedLayer(layerId: string, data: any): Promise<AnimatedLayer> {
  return await putJson<any, AnimatedLayer>(`/animated-layers/${layerId}`, data);
}

export async function deleteAnimatedLayer(layerId: string): Promise<void> {
  await delJson<void>(`/animated-layers/${layerId}`);
}

// ================== ANIMATED LAYER PRESET APIs ==================

export async function getAnimatedLayerPresets(): Promise<AnimatedLayerPreset[]> {
  return await getJson<AnimatedLayerPreset[]>(`/animated-layer-presets`);
}

export async function getPresetsByCategory(category: string): Promise<AnimatedLayerPreset[]> {
  return await getJson<AnimatedLayerPreset[]>(`/animated-layer-presets/category/${category}`);
}

export async function searchPresets(searchTerm: string): Promise<AnimatedLayerPreset[]> {
  return await getJson<AnimatedLayerPreset[]>(`/animated-layer-presets/search?q=${encodeURIComponent(searchTerm)}`);
}

export async function createAnimatedLayerFromPreset(
  presetId: string,
  layerId?: string,
  segmentId?: string
): Promise<AnimatedLayer> {
  return await postJson<{ layerId?: string; segmentId?: string }, AnimatedLayer>(`/animated-layer-presets/${presetId}/create`, {
    layerId,
    segmentId
  });
}

// ================== HELPER FUNCTIONS ==================

export function parseCameraState(cameraStateJson: string): CameraState | null {
  try {
    return JSON.parse(cameraStateJson);
  } catch {
    return null;
  }
}

export function stringifyCameraState(cameraState: CameraState): string {
  return JSON.stringify(cameraState);
}

export function getCurrentCameraState(map: any): CameraState {
  return {
    center: [map.getCenter().lng, map.getCenter().lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

export function applyCameraState(map: any, cameraState: CameraState, options?: any) {
  map.flyTo({
    center: cameraState.center,
    zoom: cameraState.zoom,
    bearing: cameraState.bearing || 0,
    pitch: cameraState.pitch || 0,
    ...options,
  });
}
