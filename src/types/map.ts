// Map and Leaflet related types

import type L from "leaflet";
import type { Position } from "geojson";

export type LNS = typeof import("leaflet");
export type LMap = L.Map;
export type LLayer = L.Layer;
export type LFeatureGroup = L.FeatureGroup;
export type LTileLayer = L.TileLayer;
export type LatLngTuple = L.LatLngTuple;
export type LeafletEvent = L.LeafletEvent;
export type LatLng = L.LatLng;
export type LatLngBounds = L.LatLngBounds;
export type LeafletIcon = L.Icon;
export type Layer = L.Layer;

// Extended Leaflet types for Polymaps (PM)
export type MapWithPM = LMap & {
  pm: {
    addControls: (opts: {
      position?: string;
      drawMarker?: boolean;
      drawPolyline?: boolean;
      drawRectangle?: boolean;
      drawPolygon?: boolean;
      drawCircle?: boolean;
      drawCircleMarker?: boolean;
      drawText?: boolean;
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      removalMode?: boolean;
      rotateMode?: boolean;
    }) => void;
    enableDraw: (
      shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text"
    ) => void;
    toggleGlobalEditMode: () => void;
    toggleGlobalRemovalMode: () => void;
    toggleGlobalDragMode: () => void;
    enableGlobalCutMode: () => void;
    toggleGlobalRotateMode?: () => void;
    setGlobalOptions: (options: {
      limitMarkersToCount?: number;
      allowSelfIntersection?: boolean;
      finishOn?: string;
      snappable?: boolean;
      snapDistance?: number;
      hideMiddleMarkers?: boolean;
      cursorMarker?: boolean;
      tooltips?: boolean;
    }) => void;
  } & Record<string, any>;
};

export interface PMCreateEvent extends LeafletEvent {
  layer: Layer;
}

export interface GeoJSONLayer extends Layer {
  feature?: {
    type?: string;
    properties?: Record<string, unknown>;
    geometry?: {
      type?: string;
      coordinates?: Position | Position[] | Position[][] | Position[][][];
    };
  };
}

export interface ExtendedLayer extends GeoJSONLayer {
  _mRadius?: number; // Circle
  _latlng?: LatLng; // Marker
  _latlngs?: LatLng[] | LatLng[][] | LatLng[][][]; // Polyline / Polygon / MultiPolygon
  _bounds?: LatLngBounds; // Rectangle
}

export interface CircleLayer extends Layer {
  _mRadius?: number;
  setRadius: (radius: number) => void;
}

export interface MarkerLayer extends Layer {
  _latlng?: LatLng;
}

export interface GeomanLayer extends Layer {
  pm: {
    enable: (options: {
      draggable?: boolean;
      allowEditing?: boolean;
      allowSelfIntersection?: boolean;
    }) => void;
  };
}

export interface LeafletMouseEvent {
  originalEvent: MouseEvent & { shiftKey: boolean };
  target: Layer;
}

export interface LeafletMapClickEvent {
  originalEvent: MouseEvent;
  target: HTMLElement;
}

export interface LayerStyle {
  color?: string;
  weight?: number;
  opacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  dashArray?: string;
  radius?: number;
}

export type LayerWithOptions = Layer & {
  options: LayerStyle & Record<string, unknown>;
}

export type PathLayer = Layer & {
  setStyle: (style: LayerStyle) => void;
  bringToFront?: () => void;
}

export type LayerWithPopup = Layer & { bindPopup: (html: string) => void };
export type LayerWithZIndex = Layer & { setZIndex: (z: number) => void };

// Zone context menu types
export interface ZoneContextMenuDetail {
  visible: boolean;
  x: number;
  y: number;
  feature: GeoJSON.Feature | null;
  layerId: string | null;
  layerName: string | null;
  leafletLayer: Layer | null;
}

// Sample/Preset types
export interface Sample {
  key: string;
  title: string;
  author: string;
  lastViewed: string;
  blurb: string;
  templateId?: string;
  preset?: {
    name: string;
    description?: string;
    baseMapProvider?: "OSM" | "Satellite" | "Dark";
    initialLatitude: number;
    initialLongitude: number;
    initialZoom: number;
  };
}

export interface PresetData {
  name: string;
  description?: string;
  baseMapProvider?: "OSM" | "Satellite" | "Dark";
  initialLatitude: number;
  initialLongitude: number;
  initialZoom: number;
}

export type TemplateCategory = "education" | "urban-planning" | "research" | "other";

export type ToolName = "Marker" | "Line" | "Polygon" | "Circle" | "Text" | "Route" | null;

// Story Element Layer types
export type StoryElementType = "Text" | "Image" | "Video" | "Audio" | "Map" | "Chart" | "Timeline" | "Interactive" | "Embed" | "Custom";

export type StoryElementDisplayMode = "Normal" | "Highlight" | "Dimmed" | "Hidden" | "Outline" | "Fade" | "Popup" | "Overlay" | "Custom";

export type AnimationEasingType = "Linear" | "EaseIn" | "EaseOut" | "EaseInOut" | "Bounce" | "Elastic" | "Custom";

export interface StoryElementLayer {
  storyElementLayerId: string;
  elementId: string;
  elementType: StoryElementType;
  layerId: string;
  zoneId?: string | null;
  expandToZone: boolean;
  highlightZoneBoundary: boolean;
  displayOrder: number;
  delayMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  startOpacity: number;
  endOpacity: number;
  easing: AnimationEasingType;
  animationPresetId?: string | null;
  autoPlayAnimation: boolean;
  repeatCount: number;
  animationOverrides?: string | null;
  metadata?: string | null;
  isVisible: boolean;
  opacity: number;
  displayMode: StoryElementDisplayMode;
  styleOverride?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateStoryElementLayerRequest {
  elementId: string;
  elementType: StoryElementType;
  layerId: string;
  zoneId?: string | null;
  expandToZone: boolean;
  highlightZoneBoundary: boolean;
  displayOrder: number;
  delayMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  startOpacity: number;
  endOpacity: number;
  easing: AnimationEasingType;
  animationPresetId?: string | null;
  autoPlayAnimation: boolean;
  repeatCount: number;
  animationOverrides?: string | null;
  metadata?: string | null;
  isVisible: boolean;
  opacity: number;
  displayMode: StoryElementDisplayMode;
  styleOverride?: string | null;
}

export interface UpdateStoryElementLayerRequest {
  elementType: StoryElementType;
  layerId: string;
  zoneId?: string | null;
  expandToZone: boolean;
  highlightZoneBoundary: boolean;
  displayOrder: number;
  delayMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  startOpacity: number;
  endOpacity: number;
  easing: AnimationEasingType;
  animationPresetId?: string | null;
  autoPlayAnimation: boolean;
  repeatCount: number;
  animationOverrides?: string | null;
  metadata?: string | null;
  isVisible: boolean;
  opacity: number;
  displayMode: StoryElementDisplayMode;
  styleOverride?: string | null;
}
