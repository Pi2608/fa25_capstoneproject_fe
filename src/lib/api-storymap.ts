/**
 * Story Map API (Segments, POIs, Zones, Timeline, Story Elements)
 */

import { getJson, postJson, putJson, delJson } from "./api-core";
import type { StoryElementLayer, CreateStoryElementLayerRequest, UpdateStoryElementLayerRequest } from "@/types/map";

const STORYMAP_PREFIX = "/story-map";
const POI_PREFIX = "/points-of-interest";

// ===== SEGMENTS =====
export type Segment = {
  segmentId: string;
  mapId: string;
  name?: string;
  summary?: string;
  storyContent?: string;
  displayOrder?: number;
  isVisible?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSegmentRequest = {
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

// ===== SEGMENT ↔ LAYERS =====
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

// ===== POIs (Points of Interest) =====
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
  isVisible?: boolean;
  zIndex?: number;
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

// ===== SEGMENT ZONES =====
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

// ===== TIMELINE =====
export type TimelineStep = {
  timelineStepId: string;
  mapId: string;
  segmentId?: string | null;
  title?: string;
  description?: string;
  order?: number;
  viewState?: string;
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

// ===== ZONE ANALYTICS =====
export type ZoneAnalyticsRequest = Record<string, unknown>;
export type ZoneAnalyticsResponse = Record<string, unknown>; 

export function getZoneAnalytics(mapId: string, body: ZoneAnalyticsRequest) {
  return postJson<ZoneAnalyticsRequest, ZoneAnalyticsResponse>(
    `${STORYMAP_PREFIX}/${mapId}/analytics/zones`,
    body
  );
}

// ===== STORY ELEMENT LAYERS =====
export function getStoryElementLayers(elementId: string) {
  return getJson<StoryElementLayer[]>(`${STORYMAP_PREFIX}/story-elements/${elementId}/layers`);
}

export function createStoryElementLayer(body: CreateStoryElementLayerRequest) {
  return postJson<CreateStoryElementLayerRequest, StoryElementLayer>(`${STORYMAP_PREFIX}/story-elements/layers`, body);
}

export function updateStoryElementLayer(storyElementLayerId: string, body: UpdateStoryElementLayerRequest) {
  return putJson<UpdateStoryElementLayerRequest, StoryElementLayer>(`${STORYMAP_PREFIX}/story-elements/layers/${storyElementLayerId}`, body);
}

export function deleteStoryElementLayer(storyElementLayerId: string) {
  return delJson<{ success: boolean }>(`${STORYMAP_PREFIX}/story-elements/layers/${storyElementLayerId}`);
}
