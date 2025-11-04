import type { Map as LMap, Layer, LatLng, LatLngBounds } from "leaflet";
import type { Position } from "geojson";

export type BaseKey = "osm" | "sat" | "dark";

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
  };
};

export type PMCreateEvent = { layer: Layer };

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
  _mRadius?: number;                                // Circle
  _latlng?: LatLng;                                 // Marker
  _latlngs?: LatLng[] | LatLng[][] | LatLng[][][];  // Polyline / Polygon / MultiPolygon
  _bounds?: LatLngBounds;                           // Rectangle
}

export type ZoneContextMenuDetail = {
  visible: boolean;
  x: number;
  y: number;
  feature: GeoJSON.Feature | null;
  layerId: string | null;
  layerName: string | null;
  leafletLayer: Layer | null;
};

export type CopyFeatureDialogState = {
  isOpen: boolean;
  sourceLayerId: string;
  sourceLayerName: string;
  featureIndex: number;
  copyMode: "existing" | "new";
};

export type SelectedFeatureState = {
  layerId: string;
  featureIndex: number;
} | null;
