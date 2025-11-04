import { getJson, postJson, putJson, delJson } from "./api-core";

const POI_PREFIX = "/points-of-interest";


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

