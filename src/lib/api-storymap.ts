import { getJson, postJson, putJson, delJson } from "./api-core";
import type { LocationType } from "@/types";

// ================== TYPES ==================

// Camera State
export type CameraState = {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing?: number;
  pitch?: number;
};

// ===== Story Content cho Segment =====

export type TravelStoryContent = {
  type: "travel";
  mode: "plane" | "car";
  pathType: "straight" | "route";

  from: {
    kind: "location" | "zone";
    locationId: string;
    zoneId?: string | null;
  };

  to: {
    kind: "location" | "zone";
    locationId: string;
    zoneId?: string | null;
  };
};

export type BasicStoryContent = {
  type: "basic";
};

export type StoryContent = TravelStoryContent | BasicStoryContent | null;

// Segment (Slide trong StoryMap)
export type Segment = {
  segmentId: string;
  mapId: string;
  name: string;
  description?: string;
  displayOrder: number;
  cameraState: CameraState; // JSON stringify của CameraState
  autoAdvance: boolean;
  durationMs: number;
  requireUserAction: boolean;
  zones: SegmentZone[]; // Backend already includes these
  layers: SegmentLayer[]; // Backend already includes these
  locations: Location[]; // Backend already includes these (PoiDto)
  storyContent?: StoryContent | string | null;
  routeAnimations?: any[]; // Optional: RouteAnimation[] - loaded on frontend, defined later in file
};

export type CreateSegmentRequest = {
  mapId?: string; // Will be enriched by endpoint
  name: string;
  description?: string;
  displayOrder?: number;
  cameraState?: string; // JSON stringified CameraState
  autoAdvance?: boolean;
  durationMs?: number;
  requireUserAction?: boolean;
  playbackMode?: "Auto" | "Manual" | "Timed";
  storyContent?: string | null;
};

export type UpdateSegmentRequest = {
  name: string;
  description?: string;
  storyContent?: string | null;
  displayOrder?: number;
  cameraState?: string;
  autoAdvance?: boolean;
  durationMs?: number;
  requireUserAction?: boolean;
  playbackMode?: "Auto" | "Manual" | "Timed";
};

// Zone (Master Data - Administrative boundaries)
export type Zone = {
  zoneId: string;
  externalId?: string;
  zoneCode?: string;
  name: string;
  state: string;
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
  updatedAt?: string;
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
  updatedAt?: string;
  // Full layer data with GeoJSON and style
  layer?: {
    id: string;
    layerName: string;
    layerType: string;
    sourceType: string;
    filePath: string;
    layerData: any; // GeoJSON FeatureCollection
    layerStyle: any; // Layer style object
    isVisible: boolean;
    featureCount: number;
    dataSizeKB: number;
    dataBounds: string;
    createdAt: string;
    updatedAt?: string;
  };
  // Map features (annotations, markers, etc.) associated with this layer
  mapFeatures?: Array<{
    featureId: string;
    mapId: string;
    layerId: string;
    name?: string;
    description?: string;
    featureCategory: string;
    annotationType?: string;
    geometryType: string;
    coordinates: string; // GeoJSON string
    properties?: string; // JSON string
    style?: string; // JSON string
    featureStyle?: string;
    useIndividualStyle: boolean;
    isVisible: boolean;
    zIndex: number;
    createdBy: string;
    createdAt: string;
    updatedAt?: string;
  }>;
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
  mapId: string;
  segmentId?: string;
  zoneId?: string;
  title: string;
  subtitle?: string;
  locationType: LocationType;
  markerGeometry?: string; // GeoJSON Point
  storyContent?: string;
  mediaResources?: string;
  displayOrder: number;
  highlightOnEnter: boolean;
  showTooltip: boolean;
  tooltipContent?: string;
  effectType?: string;
  openSlideOnClick: boolean;
  slideContent?: string;
  linkedLocationId?: string;
  playAudioOnClick: boolean;
  audioUrl?: string;
  externalUrl?: string;
  associatedLayerId?: string;
  animationPresetId?: string;
  animationOverrides?: string;
  isVisible: boolean;
  zIndex: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  // Legacy/computed fields for UI
  iconType?: string;
  iconUrl?: string;
  iconColor?: string;
  iconSize?: number;
  rotation?: string; // Icon rotation angle in degrees
  openPopupOnClick?: boolean;
  popupContent?: string;
  description?: string;
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

export type TransitionType = "Linear" | "Ease" | "EaseIn" | "EaseOut" | "EaseInOut";

// Backend enum values (matching C# backend)
export type BackendTransitionType = "Linear" | "Ease" | "EaseIn" | "EaseOut" | "EaseInOut";

// Frontend uses "Jump" for instant (no animation) transitions
export type FrontendTransitionType = "Jump" | "Linear" | "Ease" | "EaseIn" | "EaseOut" | "EaseInOut";

export function mapToBackendTransitionType(frontendType?: FrontendTransitionType): BackendTransitionType | undefined {
  if (!frontendType) return undefined;
  if (frontendType === "Jump") return "Linear";
  return frontendType as BackendTransitionType;
}

export function mapFromBackendTransitionType(backendType?: string): FrontendTransitionType {
  if (!backendType) return "Ease";
  const normalized = backendType.charAt(0).toUpperCase() + backendType.slice(1).toLowerCase();

  if (normalized === "Easein") return "EaseIn";
  if (normalized === "Easeout") return "EaseOut";
  if (normalized === "Easeinout") return "EaseInOut";

  return normalized as FrontendTransitionType;
}

export type CreateTransitionRequest = {
  mapId?: string; // Will be enriched
  fromSegmentId: string;
  toSegmentId: string;
  transitionName?: string;
  durationMs?: number;
  transitionType?: BackendTransitionType;
  animateCamera?: boolean;
  cameraAnimationType?: "Jump" | "Ease" | "Fly";
  cameraAnimationDurationMs?: number;
  showOverlay?: boolean;
  overlayContent?: string;
  autoTrigger?: boolean;
  requireUserAction?: boolean;
};

// RouteAnimation (Route animation between two locations)
export type RouteAnimation = {
  routeAnimationId: string;
  segmentId: string;
  mapId: string;

  // Route information (matching backend DTO structure)
  fromLat: number;
  fromLng: number;
  fromName?: string;
  toLat: number;
  toLng: number;
  toName?: string;
  toLocationId?: string; // Link to Location at destination point
  routePath: string; // GeoJSON LineString as string
  waypoints?: string; // JSON array of waypoints

  // Icon configuration
  iconType: "car" | "walking" | "bike" | "plane" | "bus" | "train" | "motorcycle" | "boat" | "truck" | "helicopter" | "custom";
  iconUrl?: string;
  iconWidth: number;
  iconHeight: number;

  // Route styling
  routeColor: string; // Color for unvisited route
  visitedColor: string; // Color for visited route
  routeWidth: number;

  // Animation settings
  durationMs: number;
  startDelayMs?: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  autoPlay: boolean;
  loop: boolean;

  // Display settings
  isVisible: boolean;
  zIndex: number;
  displayOrder: number;

  // Timing relative to segment
  startTimeMs?: number;
  endTimeMs?: number;

  // Camera state transitions (JSON stringified CameraState)
  cameraStateBefore?: string; // Camera state before route starts
  cameraStateAfter?: string; // Camera state after route completes

  // Location info display settings
  showLocationInfoOnArrival: boolean; // Auto-show location popup when route completes
  locationInfoDisplayDurationMs?: number; // Duration to show location info popup

  // Camera follow settings
  followCamera: boolean; // Whether camera should follow the moving icon
  followCameraZoom?: number; // Zoom level when following (null = keep current zoom)

  createdAt: string;
  updatedAt?: string;
};

export type CreateRouteAnimationRequest = {
  segmentId: string;
  fromLat: number;
  fromLng: number;
  fromName?: string;
  toLat: number;
  toLng: number;
  toName?: string;
  toLocationId?: string; // Link to Location at destination point
  routePath: string; // GeoJSON LineString
  waypoints?: string; // JSON array of waypoints
  iconType: "car" | "walking" | "bike" | "plane" | "bus" | "train" | "motorcycle" | "boat" | "truck" | "helicopter" | "custom";
  iconFile?: File; // Upload custom icon image
  iconUrl?: string;
  iconWidth?: number;
  iconHeight?: number;
  routeColor?: string;
  visitedColor?: string;
  routeWidth?: number;
  durationMs: number;
  startDelayMs?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  autoPlay?: boolean;
  loop?: boolean;
  isVisible?: boolean;
  zIndex?: number;
  displayOrder?: number;
  startTimeMs?: number;
  endTimeMs?: number;
  cameraStateBefore?: string; // Camera state before route starts (JSON)
  cameraStateAfter?: string; // Camera state after route completes (JSON)
  showLocationInfoOnArrival?: boolean; // Auto-show location popup when route completes
  locationInfoDisplayDurationMs?: number; // Duration to show location info popup
  followCamera?: boolean; // Whether camera should follow the moving icon
  followCameraZoom?: number; // Zoom level when following (null = keep current zoom)
};

export type UpdateRouteAnimationRequest = Partial<CreateRouteAnimationRequest>;

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

export async function moveLocationToSegment(
  mapId: string,
  fromSegmentId: string,
  locationId: string,
  toSegmentId: string
): Promise<void> {
  await postJson<{}, { success: boolean; message: string }>(
    `/storymaps/${mapId}/segments/${fromSegmentId}/locations/${locationId}/move-to/${toSegmentId}`,
    {}
  );
}

export async function moveZoneToSegment(
  mapId: string,
  fromSegmentId: string,
  segmentZoneId: string,
  toSegmentId: string
): Promise<void> {
  await postJson<{}, { success: boolean; message: string }>(
    `/storymaps/${mapId}/segments/${fromSegmentId}/zones/${segmentZoneId}/move-to/${toSegmentId}`,
    {}
  );
}

export async function moveLayerToSegment(
  mapId: string,
  fromSegmentId: string,
  segmentLayerId: string,
  toSegmentId: string
): Promise<void> {
  await postJson<{}, { success: boolean; message: string }>(
    `/storymaps/${mapId}/segments/${fromSegmentId}/layers/${segmentLayerId}/move-to/${toSegmentId}`,
    {}
  );
}

export async function moveRouteToSegment(
  mapId: string,
  fromSegmentId: string,
  routeAnimationId: string,
  toSegmentId: string
): Promise<void> {
  await postJson<{}, { success: boolean; message: string }>(
    `/storymaps/${mapId}/segments/${fromSegmentId}/route-animations/${routeAnimationId}/move-to/${toSegmentId}`,
    {}
  );
}

// ================== ZONE APIs (Master Data) ==================

export async function getZones(): Promise<Zone[]> {
  return await getJson<Zone[]>(`/storymaps/zones`);
}

export async function getZonesByParent(parentZoneId?: string): Promise<Zone[]> {
  const url = parentZoneId
    ? `/storymaps/zones/parent/${parentZoneId}`
    : `/storymaps/zones`;
  return await getJson<Zone[]>(url);
}

export type ZoneSearchParams = {
  name: string;
  city: string;
  state: string;
  country: string;
};

export async function searchZones(paramsInput: Partial<ZoneSearchParams>): Promise<Zone[]> {
  const params = new URLSearchParams({
    name: paramsInput.name ?? "",
    city: paramsInput.city ?? "",
    state: paramsInput.state ?? "",
    country: paramsInput.country ?? "",
  });

  return await getJson<Zone[]>(`/storymaps/zones/search?${params.toString()}`);
}


export async function searchRoutes(from: string, to: string): Promise<Zone[]> {
  return await getJson<Zone[]>(`/storymaps/routes/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

export async function searchRouteBetweenLocations(
  fromLocationId: string,
  toLocationId: string,
  routeType: "road" | "straight" = "road"
): Promise<{ routePath: string }> {
  return await getJson<{ routePath: string }>(
    `/storymaps/routes/between-locations?fromLocationId=${fromLocationId}&toLocationId=${toLocationId}&routeType=${routeType}`
  );
}

export async function searchRouteWithMultipleLocations(
  locationIds: string[],
  routeType: "road" | "straight" = "road"
): Promise<{ routePath: string }> {
  return await postJson<{ locationIds: string[]; routeType?: string }, { routePath: string }>(
    `/storymaps/routes/multiple-locations`,
    { locationIds, routeType }
  );
}

export async function createZone(data: any): Promise<Zone> {
  return await postJson<any, Zone>(`/storymaps/zones`, data);
}

export async function createZoneFromOsm(data: {
  osmType: string;
  osmId: number;
  displayName: string;
  lat: number;
  lon: number;
  geoJson: string;
  category?: string;
  type?: string;
  adminLevel?: number;
  parentZoneId?: string;
}): Promise<Zone> {
  return await postJson<any, Zone>(`/storymaps/zones/from-osm`, data);
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
  segmentZoneId: string,
  data: UpdateSegmentZoneRequest
): Promise<SegmentZone> {
  return await putJson<UpdateSegmentZoneRequest, SegmentZone>(`/storymaps/${mapId}/segments/${segmentId}/zones/${segmentZoneId}`, data);
}

export async function deleteSegmentZone(mapId: string, segmentId: string, segmentZoneId: string): Promise<void> {
  await delJson<void>(`/storymaps/${mapId}/segments/${segmentId}/zones/${segmentZoneId}`);
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

export type CreateLocationRequest = {
  segmentId?: string;
  zoneId?: string;
  title: string;
  subtitle?: string;
  locationType: LocationType;
  markerGeometry?: string; // GeoJSON Point
  storyContent?: string;
  mediaResources?: string; // JSON string of media resources
  displayOrder: number;
  highlightOnEnter: boolean; // Required field
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
  // Media file uploads
  iconFile?: File | Blob;
  audioFile?: File | Blob;
  iconType?: string; // Preset icon key (e.g., "plane", "car")
  iconUrl?: string; // Custom icon URL
  iconSize?: number;
  rotation?: string; // Icon rotation angle in degrees
};

export async function getSegmentLocations(mapId: string, segmentId: string): Promise<Location[]> {
  const response = await getJson<Location[]>(`/storymaps/${mapId}/segments/${segmentId}/locations`);
  return response || [];
}

export async function getMapLocations(mapId: string): Promise<Location[]> {
  const response = await getJson<Location[]>(`/storymaps/${mapId}/locations`);
  return response || [];
}

export async function createLocation(
  mapId: string,
  segmentId: string,
  data: CreateLocationRequest
): Promise<Location> {
  const formData = new FormData();

  // Required fields - always append
  formData.append('MapId', mapId);
  formData.append('Title', data.title);
  formData.append('LocationType', data.locationType);
  formData.append('DisplayOrder', data.displayOrder.toString());
  formData.append('HighlightOnEnter', data.highlightOnEnter.toString());

  const effectiveSegmentId = data.segmentId || segmentId;
  if (effectiveSegmentId) formData.append('SegmentId', effectiveSegmentId);
  if (data.zoneId) formData.append('ZoneId', data.zoneId);
  if (data.subtitle) formData.append('Subtitle', data.subtitle);
  if (data.markerGeometry) formData.append('MarkerGeometry', data.markerGeometry);
  if (data.storyContent) formData.append('StoryContent', data.storyContent);
  if (data.mediaResources) formData.append('MediaResources', data.mediaResources);

  // Boolean fields with defaults
  if (data.showTooltip !== undefined) formData.append('ShowTooltip', data.showTooltip.toString());
  if (data.openSlideOnClick !== undefined) formData.append('OpenSlideOnClick', data.openSlideOnClick.toString());
  if (data.playAudioOnClick !== undefined) formData.append('PlayAudioOnClick', data.playAudioOnClick.toString());
  if (data.isVisible !== undefined) formData.append('IsVisible', data.isVisible.toString());

  // Other optional string fields
  if (data.tooltipContent) formData.append('TooltipContent', data.tooltipContent);
  if (data.effectType) formData.append('EffectType', data.effectType);
  if (data.slideContent) formData.append('SlideContent', data.slideContent);
  if (data.audioUrl) formData.append('AudioUrl', data.audioUrl);
  if (data.externalUrl) formData.append('ExternalUrl', data.externalUrl);
  if (data.animationOverrides) formData.append('AnimationOverrides', data.animationOverrides);

  // Optional Guid fields
  if (data.linkedLocationId) formData.append('LinkedLocationId', data.linkedLocationId);
  if (data.associatedLayerId) formData.append('AssociatedLayerId', data.associatedLayerId);
  if (data.animationPresetId) formData.append('AnimationPresetId', data.animationPresetId);

  // Optional number field
  if (data.zIndex !== undefined) formData.append('ZIndex', data.zIndex.toString());
  if (data.iconSize !== undefined) formData.append('IconSize', data.iconSize.toString());
  if (data.rotation !== undefined) formData.append('Rotation', data.rotation);

  // Media file fields
  if (data.iconFile) formData.append('IconFile', data.iconFile);
  if (data.audioFile) formData.append('AudioFile', data.audioFile);
  if (data.iconType) formData.append('IconType', data.iconType); // Preset icon key
  if (data.iconUrl) formData.append('IconUrl', data.iconUrl); // Custom icon URL

  const { postFormData } = await import('./api-core');
  return await postFormData<Location>(`/storymaps/${mapId}/segments/${segmentId}/locations`, formData);
}

export async function updateLocation(
  mapId: string,
  segmentId: string,
  locationId: string,
  data: Partial<CreateLocationRequest>
): Promise<Location> {
  const formData = new FormData();

  // Add all fields that are present in data
  if (data.segmentId !== undefined) formData.append('SegmentId', data.segmentId);
  if (data.zoneId !== undefined) formData.append('ZoneId', data.zoneId);
  if (data.title !== undefined) formData.append('Title', data.title);
  if (data.subtitle !== undefined) formData.append('Subtitle', data.subtitle);
  if (data.locationType !== undefined) formData.append('LocationType', data.locationType);
  if (data.markerGeometry !== undefined) formData.append('MarkerGeometry', data.markerGeometry);
  if (data.storyContent !== undefined) formData.append('StoryContent', data.storyContent);
  if (data.mediaResources !== undefined) formData.append('MediaResources', data.mediaResources);
  if (data.displayOrder !== undefined) formData.append('DisplayOrder', data.displayOrder.toString());
  if (data.highlightOnEnter !== undefined) formData.append('HighlightOnEnter', data.highlightOnEnter.toString());
  if (data.showTooltip !== undefined) formData.append('ShowTooltip', data.showTooltip.toString());
  if (data.tooltipContent !== undefined) formData.append('TooltipContent', data.tooltipContent);
  if (data.effectType !== undefined) formData.append('EffectType', data.effectType);
  if (data.openSlideOnClick !== undefined) formData.append('OpenSlideOnClick', data.openSlideOnClick.toString());
  if (data.slideContent !== undefined) formData.append('SlideContent', data.slideContent);
  if (data.linkedLocationId !== undefined) formData.append('LinkedLocationId', data.linkedLocationId);
  if (data.playAudioOnClick !== undefined) formData.append('PlayAudioOnClick', data.playAudioOnClick.toString());
  if (data.audioUrl !== undefined) formData.append('AudioUrl', data.audioUrl);
  if (data.externalUrl !== undefined) formData.append('ExternalUrl', data.externalUrl);
  if (data.associatedLayerId !== undefined) formData.append('AssociatedLayerId', data.associatedLayerId);
  if (data.animationPresetId !== undefined) formData.append('AnimationPresetId', data.animationPresetId);
  if (data.animationOverrides !== undefined) formData.append('AnimationOverrides', data.animationOverrides);
  if (data.isVisible !== undefined) formData.append('IsVisible', data.isVisible.toString());
  if (data.zIndex !== undefined) formData.append('ZIndex', data.zIndex.toString());
  if (data.iconType !== undefined) formData.append('IconType', data.iconType);
  if (data.iconUrl !== undefined) formData.append('IconUrl', data.iconUrl);
  if (data.iconSize !== undefined) formData.append('IconSize', data.iconSize.toString());
  if (data.rotation !== undefined) formData.append('Rotation', data.rotation);

  // Add file uploads
  if (data.iconFile) formData.append('IconFile', data.iconFile);
  if (data.audioFile) formData.append('AudioFile', data.audioFile);

  const { putFormData } = await import('./api-core');
  return await putFormData<Location>(
    `/storymaps/${mapId}/segments/${segmentId}/locations/${locationId}`,
    formData
  );
}

export async function deleteLocation(
  mapId: string,
  segmentId: string,
  locationId: string
): Promise<void> {
  await delJson<void>(`/storymaps/${mapId}/segments/${segmentId}/locations/${locationId}`);
}

// ================== TIMELINE TRANSITION APIs ==================

export async function getTimelineTransitions(mapId: string): Promise<TimelineTransition[]> {
  return await getJson<TimelineTransition[]>(`/storymaps/${mapId}/timeline-transitions`);
}

export async function createTimelineTransition(
  mapId: string,
  data: Omit<CreateTransitionRequest, 'transitionType'> & {
    transitionType?: FrontendTransitionType;
  }
): Promise<TimelineTransition> {
  const backendData: CreateTransitionRequest = {
    ...data,
    transitionType: mapToBackendTransitionType(data.transitionType),
  };
  return await postJson<CreateTransitionRequest, TimelineTransition>(
    `/storymaps/${mapId}/timeline-transitions`,
    backendData
  );
}

export async function generateTransition(
  mapId: string,
  fromSegmentId: string,
  toSegmentId: string
): Promise<TimelineTransition> {
  return await postJson<{ fromSegmentId: string; toSegmentId: string }, TimelineTransition>(
    `/storymaps/${mapId}/timeline-transitions/generate`,
    { fromSegmentId, toSegmentId }
  );
}

export type UpdateTransitionRequest = {
  transitionName?: string;
  durationMs?: number;
  transitionType?: BackendTransitionType;
  animateCamera?: boolean;
  cameraAnimationType?: "Jump" | "Ease" | "Fly";
  cameraAnimationDurationMs?: number;
  showOverlay?: boolean;
  overlayContent?: string;
  autoTrigger?: boolean;
  requireUserAction?: boolean;
  triggerButtonText?: string;
};

export async function updateTimelineTransition(
  mapId: string,
  transitionId: string,
  data: Omit<UpdateTransitionRequest, 'transitionType'> & {
    transitionType?: FrontendTransitionType;
  }
): Promise<TimelineTransition> {
  // Map frontend type to backend type before sending to API
  const backendData: UpdateTransitionRequest = {
    ...data,
    transitionType: mapToBackendTransitionType(data.transitionType),
  };
  return await putJson<UpdateTransitionRequest, TimelineTransition>(
    `/storymaps/${mapId}/timeline-transitions/${transitionId}`,
    backendData
  );
}

export async function deleteTimelineTransition(mapId: string, transitionId: string): Promise<void> {
  await delJson<void>(`/storymaps/${mapId}/timeline-transitions/${transitionId}`);
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

// ================== ROUTE ANIMATION APIs ==================

export async function getRouteAnimationsBySegment(
  mapId: string,
  segmentId: string
): Promise<RouteAnimation[]> {
  return await getJson<RouteAnimation[]>(
    `/storymaps/${mapId}/segments/${segmentId}/route-animations`
  );
}

export async function createRouteAnimation(
  mapId: string,
  segmentId: string,
  data: CreateRouteAnimationRequest
): Promise<RouteAnimation> {
  // Always use FormData because backend expects [FromForm]
  const formData = new FormData();

  // Required fields
  formData.append('SegmentId', segmentId);
  formData.append('FromLat', data.fromLat.toString());
  formData.append('FromLng', data.fromLng.toString());
  formData.append('ToLat', data.toLat.toString());
  formData.append('ToLng', data.toLng.toString());
  formData.append('RoutePath', data.routePath);
  formData.append('IconType', data.iconType);
  formData.append('DurationMs', data.durationMs.toString());

  // Optional string fields
  if (data.fromName) formData.append('FromName', data.fromName);
  if (data.toName) formData.append('ToName', data.toName);
  if (data.toLocationId) formData.append('ToLocationId', data.toLocationId);
  if (data.waypoints) formData.append('Waypoints', data.waypoints);
  if (data.routeColor) formData.append('RouteColor', data.routeColor);
  if (data.visitedColor) formData.append('VisitedColor', data.visitedColor);
  if (data.easing) formData.append('Easing', data.easing);
  if (data.cameraStateBefore) formData.append('CameraStateBefore', data.cameraStateBefore);
  if (data.cameraStateAfter) formData.append('CameraStateAfter', data.cameraStateAfter);

  // Optional number fields (use != null to catch both null and undefined)
  if (data.iconWidth != null) formData.append('IconWidth', data.iconWidth.toString());
  if (data.iconHeight != null) formData.append('IconHeight', data.iconHeight.toString());
  if (data.routeWidth != null) formData.append('RouteWidth', data.routeWidth.toString());
  if (data.startDelayMs != null) formData.append('StartDelayMs', data.startDelayMs.toString());
  if (data.zIndex != null) formData.append('ZIndex', data.zIndex.toString());
  if (data.displayOrder != null) formData.append('DisplayOrder', data.displayOrder.toString());
  if (data.startTimeMs != null) formData.append('StartTimeMs', data.startTimeMs.toString());
  if (data.endTimeMs != null) formData.append('EndTimeMs', data.endTimeMs.toString());
  if (data.locationInfoDisplayDurationMs != null) formData.append('LocationInfoDisplayDurationMs', data.locationInfoDisplayDurationMs.toString());
  if (data.followCameraZoom != null) formData.append('FollowCameraZoom', data.followCameraZoom.toString());

  // Optional boolean fields (use != null to catch both null and undefined)
  if (data.autoPlay != null) formData.append('AutoPlay', data.autoPlay.toString());
  if (data.loop != null) formData.append('Loop', data.loop.toString());
  if (data.isVisible != null) formData.append('IsVisible', data.isVisible.toString());
  if (data.showLocationInfoOnArrival != null) formData.append('ShowLocationInfoOnArrival', data.showLocationInfoOnArrival.toString());
  if (data.followCamera != null) formData.append('FollowCamera', data.followCamera.toString());

  // Media files
  if (data.iconFile) formData.append('IconFile', data.iconFile);
  if (data.iconUrl) formData.append('IconUrl', data.iconUrl);

  const { postFormData } = await import('./api-core');
  return await postFormData<RouteAnimation>(`/storymaps/${mapId}/segments/${segmentId}/route-animations`, formData);
}

export async function updateRouteAnimation(
  mapId: string,
  segmentId: string,
  routeAnimationId: string,
  data: UpdateRouteAnimationRequest
): Promise<RouteAnimation> {
  // Always use FormData because backend expects [FromForm]
  const formData = new FormData();

  // Only append fields that are present (partial update - use != null to catch both null and undefined)
  if (data.fromLat != null) formData.append('FromLat', data.fromLat.toString());
  if (data.fromLng != null) formData.append('FromLng', data.fromLng.toString());
  if (data.toLat != null) formData.append('ToLat', data.toLat.toString());
  if (data.toLng != null) formData.append('ToLng', data.toLng.toString());
  if (data.routePath) formData.append('RoutePath', data.routePath);
  if (data.iconType) formData.append('IconType', data.iconType);
  if (data.durationMs != null) formData.append('DurationMs', data.durationMs.toString());

  // Optional string fields
  if (data.fromName) formData.append('FromName', data.fromName);
  if (data.toName) formData.append('ToName', data.toName);
  if (data.toLocationId) formData.append('ToLocationId', data.toLocationId);
  if (data.waypoints) formData.append('Waypoints', data.waypoints);
  if (data.routeColor) formData.append('RouteColor', data.routeColor);
  if (data.visitedColor) formData.append('VisitedColor', data.visitedColor);
  if (data.easing) formData.append('Easing', data.easing);
  if (data.cameraStateBefore) formData.append('CameraStateBefore', data.cameraStateBefore);
  if (data.cameraStateAfter) formData.append('CameraStateAfter', data.cameraStateAfter);

  // Optional number fields (use != null to catch both null and undefined)
  if (data.iconWidth != null) formData.append('IconWidth', data.iconWidth.toString());
  if (data.iconHeight != null) formData.append('IconHeight', data.iconHeight.toString());
  if (data.routeWidth != null) formData.append('RouteWidth', data.routeWidth.toString());
  if (data.startDelayMs != null) formData.append('StartDelayMs', data.startDelayMs.toString());
  if (data.zIndex != null) formData.append('ZIndex', data.zIndex.toString());
  if (data.displayOrder != null) formData.append('DisplayOrder', data.displayOrder.toString());
  if (data.startTimeMs != null) formData.append('StartTimeMs', data.startTimeMs.toString());
  if (data.endTimeMs != null) formData.append('EndTimeMs', data.endTimeMs.toString());
  if (data.locationInfoDisplayDurationMs != null) formData.append('LocationInfoDisplayDurationMs', data.locationInfoDisplayDurationMs.toString());
  if (data.followCameraZoom != null) formData.append('FollowCameraZoom', data.followCameraZoom.toString());

  // Optional boolean fields (use != null to catch both null and undefined)
  if (data.autoPlay != null) formData.append('AutoPlay', data.autoPlay.toString());
  if (data.loop != null) formData.append('Loop', data.loop.toString());
  if (data.isVisible != null) formData.append('IsVisible', data.isVisible.toString());
  if (data.showLocationInfoOnArrival != null) formData.append('ShowLocationInfoOnArrival', data.showLocationInfoOnArrival.toString());
  if (data.followCamera != null) formData.append('FollowCamera', data.followCamera.toString());

  // Media files
  if (data.iconFile) formData.append('IconFile', data.iconFile);
  if (data.iconUrl) formData.append('IconUrl', data.iconUrl);

  const { putFormData } = await import('./api-core');
  return await putFormData<RouteAnimation>(`/storymaps/${mapId}/segments/${segmentId}/route-animations/${routeAnimationId}`, formData);
}

export async function deleteRouteAnimation(
  mapId: string,
  segmentId: string,
  routeAnimationId: string
): Promise<void> {
  await delJson<void>(
    `/storymaps/${mapId}/segments/${segmentId}/route-animations/${routeAnimationId}`
  );
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
  // Validate map instance has required methods
  if (!map || typeof map.getCenter !== 'function' || typeof map.getZoom !== 'function') {
    throw new Error('Invalid map instance: missing required methods');
  }

  return {
    center: [map.getCenter().lng, map.getCenter().lat],
    zoom: map.getZoom(),
    bearing: typeof map.getBearing === 'function' ? map.getBearing() : 0,
    pitch: typeof map.getPitch === 'function' ? map.getPitch() : 0,
  };
}

export function applyCameraState(map: any, cameraState: CameraState, options?: any) {
  if (!map || !cameraState) {
    console.error("applyCameraState: map or cameraState is null/undefined");
    return;
  }

  if (!cameraState.center || !Array.isArray(cameraState.center) || cameraState.center.length < 2) {
    console.error("applyCameraState: invalid cameraState.center", cameraState.center);
    return;
  }

  // CameraState.center is [lng, lat], but Leaflet needs [lat, lng]
  const [lng, lat] = cameraState.center;
  const center: [number, number] = [lat, lng];
  const zoom = cameraState.zoom || 10;

  // Use flyTo if available (from Leaflet plugins), otherwise use setView
  if (typeof map.flyTo === 'function') {
    const flyOptions: any = {
      duration: options?.duration || 1.0,
    };
    map.flyTo(center, zoom, flyOptions);
  } else if (typeof map.setView === 'function') {
    const viewOptions: any = {
      animate: options?.duration ? true : false,
    };
    if (options?.duration) {
      viewOptions.duration = options.duration;
    }
    map.setView(center, zoom, viewOptions);
  } else {
    console.error("applyCameraState: map does not have flyTo or setView method");
  }
}
