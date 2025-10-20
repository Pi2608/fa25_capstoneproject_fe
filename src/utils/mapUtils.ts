import type {
  Layer,
  LatLng,
  LatLngBounds,
  FeatureGroup,
  Map as LMap,
  LeafletMouseEvent,
  PathOptions,
  Icon,
  IconOptions
} from "leaflet";
import type { Position } from "geojson";
import {
  createMapFeature,
  updateMapFeature,
  deleteMapFeature,
  getMapFeatures,
  type CreateMapFeatureRequest,
  type UpdateMapFeatureRequest,
  type MapFeatureResponse,
  RawLayer,
  MapDetail,
} from "@/lib/api";

// TYPE DEFINITIONS

// Icon interface for proper typing
interface LeafletIcon {
  options: IconOptions;
}

// Layer with radius method for circles
interface CircleLayer extends Layer {
  setRadius(radius: number): void;
}

// Layer with icon methods for markers
interface MarkerLayer extends Layer {
  setIcon(icon: Icon): void;
}

// Extended Layer types
export type ExtendedLayer = Layer & {
  _mRadius?: number;
  _latlng?: LatLng;
  _latlngs?: LatLng[] | LatLng[][] | LatLng[][][];
  _bounds?: LatLngBounds;
  feature?: {
    type?: string;
    properties?: Record<string, unknown>;
    geometry?: {
      type?: string;
      coordinates?: Position | Position[] | Position[][] | Position[][][];
    };
  };
};

export interface FeatureData {
  id: string;
  name: string;
  type: string;
  layer: ExtendedLayer;
  isVisible: boolean;
  featureId?: string;
}

export interface LayerInfo {
  id: string;
  name: string;
  type: string;
  layer: ExtendedLayer;
  isVisible: boolean;
}

interface ParsedLayer
  extends Omit<
    RawLayer,
    "layerData" | "layerStyle" | "filterConfig" | "customStyle"
  > {
  layerData: Record<string, unknown>;
  layerStyle: Record<string, unknown>;
  customStyle?: Record<string, unknown>;
  filterConfig?: Record<string, unknown>;
}

interface ParsedMapData extends Omit<MapDetail, "layers"> {
  layers: ParsedLayer[];
}

type LayerWithPopup = Layer & { bindPopup: (html: string) => void };
function hasBindPopup(l: Layer): l is LayerWithPopup {
  return "bindPopup" in (l as object) &&
    typeof (l as { bindPopup?: unknown }).bindPopup === "function";
}

type LayerWithZIndex = Layer & { setZIndex: (z: number) => void };
function hasSetZIndex(l: Layer): l is LayerWithZIndex {
  return "setZIndex" in (l as object) &&
    typeof (l as { setZIndex?: unknown }).setZIndex === "function";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// UTILITY FUNCTIONS

/**
 * Extract style properties from a Leaflet layer
 */
export function extractLayerStyle(layer: ExtendedLayer): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  
  // Common style properties for all layer types
  if (layer.options) {
    const options = layer.options as Record<string, unknown>;
   
    // Color properties
    if (options.color !== undefined) style.color = options.color;
    if (options.fillColor !== undefined) style.fillColor = options.fillColor;
    if (options.stroke !== undefined) style.stroke = options.stroke;
    if (options.fill !== undefined) style.fill = options.fill;
   
    // Opacity properties
    if (options.opacity !== undefined) style.opacity = options.opacity;
    if (options.fillOpacity !== undefined) style.fillOpacity = options.fillOpacity;
   
    // Weight and size properties
    if (options.weight !== undefined) style.weight = options.weight;
    if (options.radius !== undefined) style.radius = options.radius;
   
    // Line properties
    if (options.dashArray !== undefined) style.dashArray = options.dashArray;
    if (options.lineCap !== undefined) style.lineCap = options.lineCap;
    if (options.lineJoin !== undefined) style.lineJoin = options.lineJoin;
   
    // Icon properties (for markers)
    if (options.icon !== undefined) {
      const icon = options.icon as LeafletIcon;
      if (icon.options) {
        style.iconSize = icon.options.iconSize;
        style.iconAnchor = icon.options.iconAnchor;
        style.popupAnchor = icon.options.popupAnchor;
        style.className = icon.options.className;
      }
    }
  }
  
  // Layer-specific properties
  if ('_mRadius' in layer && layer._mRadius !== undefined) {
    style.radius = layer._mRadius;
  }
  
  return style;
}

/**
 * Apply style properties to a Leaflet layer
 */
export function applyLayerStyle(layer: ExtendedLayer, style: Record<string, unknown>): void {
  if (!style || Object.keys(style).length === 0) return;
  
  try {
    // Apply common style properties
    const styleOptions: Record<string, unknown> = {};
   
    if (style.color !== undefined) styleOptions.color = style.color;
    if (style.fillColor !== undefined) styleOptions.fillColor = style.fillColor;
    if (style.stroke !== undefined) styleOptions.stroke = style.stroke;
    if (style.fill !== undefined) styleOptions.fill = style.fill;
    if (style.opacity !== undefined) styleOptions.opacity = style.opacity;
    if (style.fillOpacity !== undefined) styleOptions.fillOpacity = style.fillOpacity;
    if (style.weight !== undefined) styleOptions.weight = style.weight;
    if (style.dashArray !== undefined) styleOptions.dashArray = style.dashArray;
    if (style.lineCap !== undefined) styleOptions.lineCap = style.lineCap;
    if (style.lineJoin !== undefined) styleOptions.lineJoin = style.lineJoin;
   
    // Apply radius for circles
    if (style.radius !== undefined && 'setRadius' in layer) {
      (layer as CircleLayer).setRadius(style.radius as number);
    }
   
    // Apply style using setStyle method if available
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      layer.setStyle(styleOptions);
    } else {
      // Fallback: manually set options
      Object.assign(layer.options, styleOptions);
      if ('redraw' in layer && typeof layer.redraw === 'function') {
        layer.redraw();
      }
    }
   
    // Handle icon styles for markers
    if (style.iconSize || style.iconAnchor || style.popupAnchor || style.className) {
      const L = (window as { L?: typeof import('leaflet') }).L;
      if (L && L.Icon) {
        const iconOptions: Partial<IconOptions> = {};
        if (style.iconSize) iconOptions.iconSize = style.iconSize as [number, number];
        if (style.iconAnchor) iconOptions.iconAnchor = style.iconAnchor as [number, number];
        if (style.popupAnchor) iconOptions.popupAnchor = style.popupAnchor as [number, number];
        if (style.className) iconOptions.className = style.className as string;
       
        const customIcon = new L.Icon.Default(iconOptions);
        if ('setIcon' in layer && typeof layer.setIcon === 'function') {
          (layer as MarkerLayer).setIcon(customIcon as Icon);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to apply layer style:", error);
  }
}

/**
 * Validate geometry coordinates
 */
export function validateGeometry(geometryType: string, coordinates: string): boolean {
  try {
    const coords = JSON.parse(coordinates);

    switch (geometryType) {
      case "Point":
        return (
          Array.isArray(coords) &&
          coords.length === 2 &&
          typeof coords[0] === "number" &&
          typeof coords[1] === "number"
        );

      case "LineString":
        return (
          Array.isArray(coords) &&
          coords.length >= 2 &&
          coords.every(
            (c: unknown) =>
              Array.isArray(c) &&
              c.length === 2 &&
              typeof (c as unknown[])[0] === "number" &&
              typeof (c as unknown[])[1] === "number"
          )
        );

      case "Polygon":
        return (
          Array.isArray(coords) &&
          coords.length >= 1 &&
          Array.isArray(coords[0]) &&
          (coords[0] as unknown[]).length >= 3 &&
          (coords[0] as unknown[]).every(
            (c: unknown) =>
              Array.isArray(c) &&
              c.length === 2 &&
              typeof (c as unknown[])[0] === "number" &&
              typeof (c as unknown[])[1] === "number"
          )
        );

      case "Circle":
        return (
          Array.isArray(coords) &&
          coords.length === 3 &&
          typeof coords[0] === "number" &&
          typeof coords[1] === "number" &&
          typeof coords[2] === "number" &&
          coords[2] > 0
        );

      default:
        return false;
    }
  } catch {
    return false;
  }
}


function safeParseJSON<T = unknown>(value: string, fallback: T = {} as T): T {
  try {
    if (!value) return fallback as T;
    return JSON.parse(value) as T;
  } catch {
    return fallback as T;
  }
}

export function getFeatureType(layer: ExtendedLayer): string {
  // Check for Marker or Text first
  if (layer._latlng && !layer._mRadius) {
    // Type assertion for marker to access icon
    const L = (window as { L?: typeof import('leaflet') }).L;
    if (L && L.Marker && layer instanceof L.Marker) {
      const marker = layer as L.Marker;
      const icon: unknown = marker.options?.icon;

      if (icon && typeof icon === "object" && "options" in icon) {
        const iconOpts = (icon as L.DivIcon).options;
        const html = iconOpts.html;
        const className = iconOpts.className;

        if (
          (typeof html === "string" && html.trim() !== "") ||
          (typeof className === "string" && className.toLowerCase().includes("text"))
        ) {
          return "Text";
        }
      }
    }
    return "Marker";
  }
  
  // Check for Circle
  if (layer._mRadius) return "Circle";
  
  // Check for Line or Polygon or Rectangle
  if (layer._latlngs) {
    const latlngs = layer._latlngs as LatLng[] | LatLng[][];
    const points = Array.isArray(latlngs[0]) ? latlngs[0] as LatLng[] : latlngs as LatLng[];

    // Check if it's a rectangle by comparing with bounds
    if (points.length >= 4 && layer._bounds) {
      const b = layer._bounds;
      const corners = [
        [b.getSouthWest().lat, b.getSouthWest().lng],
        [b.getNorthWest().lat, b.getNorthWest().lng],
        [b.getNorthEast().lat, b.getNorthEast().lng],
        [b.getSouthEast().lat, b.getSouthEast().lng],
      ];

      const similar = points.every((p) =>
        corners.some(([lat, lng]) =>
          Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lng - lng) < 1e-6
        )
      );

      if (similar) return "Rectangle";
    }

    // Check if polygon or line
    if (Array.isArray(latlngs[0])) return "Polygon";
    return "Line";
  }

  // Fallback to Rectangle if bounds exist
  if (layer._bounds) return "Rectangle";
  
  return "Unknown";
}

export function serializeFeature(layer: ExtendedLayer): {
  geometryType: "Point" | "LineString" | "Polygon" | "Circle";
  coordinates: string;
  annotationType: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video";
  text?: string;
} {
  const type = getFeatureType(layer);
  let geometryType: "Point" | "LineString" | "Polygon" | "Circle" = "Point";
  let annotationType:
    | "Marker"
    | "Highlighter"
    | "Text"
    | "Note"
    | "Link"
    | "Video" = "Marker";
  let coordinates: Position | Position[] | Position[][] = [0, 0];
  let text: string | undefined;

  if (type === "Marker" || type === "Text") {
    geometryType = "Point";
    annotationType = type === "Text" ? "Text" : "Marker";
    
    if (layer._latlng) {
      coordinates = [layer._latlng.lng, layer._latlng.lat];
    } else {
      console.warn("Marker/Text layer missing _latlng property");
      coordinates = [0, 0];
    }

    // Extract text content for Text type
    if (type === "Text") {
      const L = (window as { L?: typeof import('leaflet') }).L;
      if (L && L.Marker && layer instanceof L.Marker) {
        const marker = layer as L.Marker;
        const icon = marker.options.icon as L.DivIcon | undefined;
        if (icon && icon.options && typeof icon.options.html === "string") {
          text = icon.options.html;
        }
      }
    }
  } else if (type === "Circle") {
    geometryType = "Circle";
    annotationType = "Marker";
    if (layer._latlng && layer._mRadius) {
      coordinates = [layer._latlng.lng, layer._latlng.lat, layer._mRadius];
    } else {
      console.warn("Circle layer missing _latlng or _mRadius property");
      coordinates = [0, 0, 100];
    }
  } else if (type === "Rectangle") {
    geometryType = "Polygon";
    annotationType = "Highlighter";
    if (layer._bounds) {
      const bounds = layer._bounds;
      coordinates = [
        [
          [bounds.getWest(), bounds.getSouth()],
          [bounds.getEast(), bounds.getSouth()],
          [bounds.getEast(), bounds.getNorth()],
          [bounds.getWest(), bounds.getNorth()],
          [bounds.getWest(), bounds.getSouth()],
        ],
      ];
    } else {
      console.warn("Rectangle layer missing _bounds property");
      coordinates = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
    }
  } else if (type === "Line") {
    geometryType = "LineString";
    annotationType = "Highlighter";
    const latlngs = layer._latlngs as LatLng[];
    if (latlngs && latlngs.length > 0) {
      coordinates = latlngs.map((ll) => [ll.lng, ll.lat]);
    } else {
      console.warn("Line layer missing valid _latlngs property");
      coordinates = [
        [0, 0],
        [1, 1],
      ];
    }
  } else if (type === "Polygon") {
    geometryType = "Polygon";
    annotationType = "Highlighter";
    const latlngs = layer._latlngs as LatLng[][];
    if (latlngs && latlngs[0] && latlngs[0].length > 0) {
      coordinates = [latlngs[0].map((ll) => [ll.lng, ll.lat])];
    } else {
      console.warn("Polygon layer missing valid _latlngs property");
      coordinates = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
    }
  } else {
    console.warn("Unknown feature type:", type);
    geometryType = "Point";
    annotationType = "Marker";
    coordinates = [0, 0];
  }

  const result: {
    geometryType: "Point" | "LineString" | "Polygon" | "Circle";
    coordinates: string;
    annotationType: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video";
    text?: string;
  } = {
    geometryType,
    annotationType,
    coordinates: JSON.stringify(coordinates),
  };

  if (text) {
    result.text = text;
  }

  return result;
}

export function createGeoJSONFeature(
  layer: ExtendedLayer,
  properties: Record<string, unknown> = {}
): {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: Position | Position[] | Position[][];
  };
  properties: Record<string, unknown>;
} {
  const { geometryType, coordinates } = serializeFeature(layer);

  return {
    type: "Feature",
    geometry: {
      type: geometryType,
      coordinates: JSON.parse(coordinates),
    },
    properties,
  };
}


export function layersToGeoJSON(layers: ExtendedLayer[]): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: string;
      coordinates: Position | Position[] | Position[][];
    };
    properties: Record<string, unknown>;
  }>;
} {
  return {
    type: "FeatureCollection",
    features: layers.map((layer) => createGeoJSONFeature(layer)),
  };
}


export function convertMapLayers(rawData: MapDetail): ParsedMapData {
  const parsedLayers: ParsedLayer[] = rawData.layers.map((layer) => ({
    ...layer,
    layerData: safeParseJSON(layer.layerData) ?? {},
    layerStyle: safeParseJSON(layer.layerStyle) ?? {},
    filterConfig: safeParseJSON(layer.filterConfig) ?? {},
    customStyle: safeParseJSON(layer.customStyle) ?? {},
  }));

  return { ...rawData, layers: parsedLayers };
}


export async function getFeatureList(
  mapId: string
): Promise<MapFeatureResponse[]> {
  try {
    return await getMapFeatures(mapId);
  } catch (error) {
    console.error("Failed to get features:", error);
    return [];
  }
}

export function addFeatureToList(
  features: FeatureData[],
  layer: ExtendedLayer,
  name?: string
): FeatureData[] {
  const type = getFeatureType(layer);
  const id = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const newFeature: FeatureData = {
    id,
    name: name || `${type} ${features.length + 1}`,
    type,
    layer,
    isVisible: true,
  };

  return [...features, newFeature];
}

export function removeFeatureFromList(
  features: FeatureData[],
  featureId: string,
  map?: LMap | null,
  sketchGroup?: FeatureGroup | null
): FeatureData[] {
  const feature = features.find((f) => f.id === featureId);

  if (feature && map && sketchGroup) {
    sketchGroup.removeLayer(feature.layer);
  }

  return features.filter((f) => f.id !== featureId);
}

export function renameFeature(
  features: FeatureData[],
  featureId: string,
  newName: string
): FeatureData[] {
  return features.map((f) => {
    if (f.id === featureId) {
      return { ...f, name: newName };
    }
    return f;
  });
}


export function addLayerToList(
  layers: LayerInfo[],
  layer: ExtendedLayer,
  name?: string
): LayerInfo[] {
  const type = getFeatureType(layer);
  const id = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const newLayer: LayerInfo = {
    id,
    name: name || `${type} ${layers.length + 1}`,
    type,
    layer,
    isVisible: true,
  };

  return [...layers, newLayer];
}

export function removeLayerFromList(
  layers: LayerInfo[],
  layerId: string,
  map?: LMap | null
): LayerInfo[] {
  const layer = layers.find((l) => l.id === layerId);

  if (layer && map) {
    map.removeLayer(layer.layer);
  }

  return layers.filter((l) => l.id !== layerId);
}

export function toggleLayerVisibilityLocal(
  layers: LayerInfo[],
  layerId: string,
  map?: LMap | null
): LayerInfo[] {
  return layers.map((l) => {
    if (l.id === layerId) {
      const newVisibility = !l.isVisible;

      if (map) {
        if (newVisibility) {
          if (!map.hasLayer(l.layer)) {
            map.addLayer(l.layer);
          }
        } else {
          map.removeLayer(l.layer);
        }
      }

      return { ...l, isVisible: newVisibility };
    }
    return l;
  });
}

export function renameLayer(
  layers: LayerInfo[],
  layerId: string,
  newName: string
): LayerInfo[] {
  return layers.map((l) => {
    if (l.id === layerId) {
      return { ...l, name: newName };
    }
    return l;
  });
}

export async function saveFeature(
  mapId: string,
  layerId: string,
  layer: ExtendedLayer,
  features: FeatureData[],
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>
): Promise<FeatureData | null> {
  try {
    const serialized = serializeFeature(layer);
    const { geometryType, annotationType, coordinates, text } = serialized;
    const type = getFeatureType(layer);

    if (!coordinates || coordinates === "[0,0]" || coordinates === "[]") {
      console.error("Invalid coordinates for feature:", coordinates);
      return null;
    }

    if (!validateGeometry(geometryType, coordinates)) {
      console.error("Invalid geometry format:", { geometryType, coordinates });
      return null;
    }

    // Extract style from layer
    const layerStyle = extractLayerStyle(layer);

    // Build properties object - include text for Text annotations
    const properties: Record<string, unknown> = {};
    if (text) {
      properties.text = text;
    }

    const body: CreateMapFeatureRequest = {
      mapId,
      layerId: layerId || null,
      name: `${type}`,
      description: "",
      featureCategory: "Annotation",
      annotationType: annotationType,
      geometryType: geometryType,
      coordinates,
      properties: JSON.stringify(properties),
      style: JSON.stringify(layerStyle),
      isVisible: true,
      zIndex: features.length,
    };

    console.log("Saving feature with body:", body);
    const response = await createMapFeature(mapId, body);

    const newFeature: FeatureData = {
      id: `feature-${Date.now()}`,
      name: body.name || `${type} ${features.length + 1}`,
      type,
      layer,
      isVisible: true,
      featureId: response.featureId,
    };

    setFeatures((prev) => [...prev, newFeature]);
    console.log("✅ Feature saved to DB:", newFeature);
    return newFeature;
  } catch (error) {
    console.error("❌ Failed to save feature:", error);
    return null;
  }
}

export async function updateFeatureInDB(
  mapId: string,
  featureId: string,
  feature: FeatureData
): Promise<boolean> {
  try {
    const serialized = serializeFeature(feature.layer);
    const { geometryType, annotationType, coordinates, text } = serialized;
   
    console.log("🔄 Updating feature in DB:", { featureId, geometryType, annotationType, text });

    // Extract current style from layer
    const layerStyle = extractLayerStyle(feature.layer);

    // Build properties object - include text for Text annotations
    const properties: Record<string, unknown> = {};
    if (text) {
      properties.text = text;
    }

    const body: UpdateMapFeatureRequest = {
      name: feature.name,
      description: "",
      featureCategory: "Annotation",
      annotationType: annotationType,
      geometryType: geometryType,
      coordinates,
      properties: JSON.stringify(properties),
      style: JSON.stringify(layerStyle),
      isVisible: feature.isVisible,
      zIndex: 0,
      layerId: null,
    };

    await updateMapFeature(mapId, featureId, body);
    return true;
  } catch (error) {
    console.error("Failed to update feature:", error);
    return false;
  }
}

export async function deleteFeatureFromDB(
  mapId: string,
  featureId: string
): Promise<boolean> {
  try {
    await deleteMapFeature(mapId, featureId);
    return true;
  } catch (error) {
    console.error("Failed to delete feature:", error);
    return false;
  }
}

export async function loadFeaturesToMap(
  mapId: string,
  L: typeof import("leaflet"),
  sketchGroup: FeatureGroup
): Promise<FeatureData[]> {
  try {
    const features = await getMapFeatures(mapId);
    console.log("features", features);
    const featureDataList: FeatureData[] = [];

    for (const feature of features) {
      let coordinates: Position | Position[] | Position[][];
      try {
        coordinates = JSON.parse(feature.coordinates);
      } catch {
        console.warn("Failed to parse coordinates for feature:", feature.featureId);
        continue;
      }

      let layer: ExtendedLayer | null = null;

      if (feature.geometryType.toLowerCase() === "point") {
        const coords = coordinates as Position;
        
        // Check if it's a Text annotation type
        if (feature.annotationType === "Text") {
          // Try to extract text content from properties or style
          let textContent = "Text";
          
          // First check if there's a text property
          if (feature.properties) {
            try {
              const props = JSON.parse(feature.properties);
              if (props.text) {
                textContent = props.text;
              }
            } catch (error) {
              console.warn("Failed to parse feature properties:", error);
            }
          }
          
          // Create text marker with DivIcon
          layer = L.marker([coords[1], coords[0]], {
            icon: L.divIcon({
              className: "leaflet-div-icon geoman-text",
              html: textContent,
            }),
          }) as ExtendedLayer;
        } else {
          // Regular marker
          layer = L.marker([coords[1], coords[0]]) as ExtendedLayer;
        }
      } else if (feature.geometryType.toLowerCase() === "linestring") {
        const coords = coordinates as Position[];
        layer = L.polyline(coords.map((c) => [c[1], c[0]])) as ExtendedLayer;
      } else if (feature.geometryType.toLowerCase() === "polygon") {
        const coords = coordinates as Position[][];
        layer = L.polygon(coords[0].map((c) => [c[1], c[0]])) as ExtendedLayer;
      } else if (feature.geometryType.toLowerCase() === "circle") {
        const coords = coordinates as [number, number, number];
        layer = L.circle([coords[1], coords[0]], { radius: coords[2] }) as ExtendedLayer;
      }
      
      if (layer) {
        const isVisible = feature.isVisible;

        // Apply stored style if available
        if (feature.style) {
          try {
            const storedStyle = JSON.parse(feature.style);
            applyLayerStyle(layer, storedStyle);
          } catch (error) {
            console.warn("Failed to parse feature style:", error);
          }
        }

        if (isVisible) {
          sketchGroup.addLayer(layer);
        }

        const featureType = getFeatureType(layer);
        featureDataList.push({
          id: `feature-${feature.featureId}`,
          name: feature.name || `${featureType}`,
          type: featureType,
          layer,
          isVisible,
          featureId: feature.featureId,
        });
      }
    }

    return featureDataList;
  } catch (error) {
    console.error("Failed to load features:", error);
    return [];
  }
}


/**
 * Load a single layer to the map
 */
export async function loadLayerToMap(
  map: LMap,
  layer: RawLayer,
  dataLayerRefs: React.MutableRefObject<Map<string, Layer>>
): Promise<boolean> {
  if (!map || !layer) return false;

  try {
    const L = (await import("leaflet")).default;
    const layerData = JSON.parse(layer.layerData || '{}');
   
    if (layerData.type === 'FeatureCollection' && layerData.features) {
      let layerStyle = {};
      let customStyle = {};
     
      try {
        if (layer.layerStyle) {
          layerStyle = JSON.parse(layer.layerStyle);
        }
      } catch (error) {
        console.warn("Failed to parse layer style:", error);
      }
     
      try {
        if (layer.customStyle) {
          customStyle = JSON.parse(layer.customStyle);
        }
      } catch (error) {
        console.warn("Failed to parse custom style:", error);
      }
     
      // Merge layer style with custom style (custom style takes precedence)
      const finalStyle = { ...layerStyle, ...customStyle };

      const geoJsonLayer = L.geoJSON(layerData, {
        style: Object.keys(finalStyle).length > 0 ? finalStyle : undefined,
        onEachFeature: (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
          // Add popup if feature has properties
          if (feature.properties) {
            const popupContent = Object.entries(feature.properties)
              .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
              .join("<br>");
            if (hasBindPopup(leafletLayer)) {
              leafletLayer.bindPopup(popupContent);
            }
          }
        },
      });

      const dataLayerZIndex = 1000 + (layer.zIndex || 0);
      if (hasSetZIndex(geoJsonLayer)) {
        geoJsonLayer.setZIndex(dataLayerZIndex);
      }
      
      map.addLayer(geoJsonLayer);
      dataLayerRefs.current.set(layer.id, geoJsonLayer);
      
      console.log("✅ Loaded layer to map:", layer.name);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Failed to load layer ${layer.name}:`, error);
    return false;
  }
}

/**
 * Load all data layers to the map
 */
export async function renderDataLayers(
  map: LMap,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, Layer>>
): Promise<void> {
  if (!layers || !map) return;

  const L = (await import("leaflet")).default;

  dataLayerRefs.current.forEach((layer) => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });
  dataLayerRefs.current.clear();

  for (const layer of layers) {
    if (!layer.isVisible) continue;

    try {
      const layerData = JSON.parse(layer.layerData || '{}');
     
      if (layerData.type === 'FeatureCollection' && layerData.features) {
        // Parse layer style and custom style
        let layerStyle = {};
        let customStyle = {};
       
        try {
          if (layer.layerStyle) {
            layerStyle = JSON.parse(layer.layerStyle);
          }
        } catch (error) {
          console.warn("Failed to parse layer style:", error);
        }
       
        try {
          if (layer.customStyle) {
            customStyle = JSON.parse(layer.customStyle);
          }
        } catch (error) {
          console.warn("Failed to parse custom style:", error);
        }
       
        // Merge layer style with custom style (custom style takes precedence)
        const finalStyle = { ...layerStyle, ...customStyle };

        const geoJsonLayer = L.geoJSON(layerData, {
          style: Object.keys(finalStyle).length > 0 ? finalStyle : undefined,
          onEachFeature: (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
            // Add popup if feature has properties
            if (feature.properties) {
              const popupContent = Object.entries(feature.properties)
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join("<br>");
              if (hasBindPopup(leafletLayer)) {
                leafletLayer.bindPopup(popupContent);
              }
            }
          },
        });

        const dataLayerZIndex = 1000 + (layer.zIndex || 0);
        if (hasSetZIndex(geoJsonLayer)) {
          geoJsonLayer.setZIndex(dataLayerZIndex);
        }
        map.addLayer(geoJsonLayer);

        dataLayerRefs.current.set(layer.id, geoJsonLayer);
      }
    } catch (error) {
      console.warn(`Failed to render layer ${layer.name}:`, error);
    }
  }
}

export async function renderFeatures(
  map: LMap,
  features: MapFeatureResponse[],
  featureRefs: React.MutableRefObject<Map<string, Layer>>,
  sketchGroup: FeatureGroup
): Promise<void> {
  if (!features || !map) return;

  const L = (await import("leaflet")).default;

  featureRefs.current.forEach((layer) => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
    if (sketchGroup.hasLayer(layer)) {
      sketchGroup.removeLayer(layer);
    }
  });
  featureRefs.current.clear();

  console.log("🎨 Rendering features:", features);

  for (const feature of features) {
    if (!feature.isVisible) continue;

    try {
      let coordinates: Position | Position[] | Position[][];
      try {
        coordinates = JSON.parse(feature.coordinates);
      } catch {
        console.warn("Failed to parse coordinates for feature:", feature.featureId);
        continue;
      }

      let layer: ExtendedLayer | null = null;

      if (feature.geometryType.toLowerCase() === "point") {
        const coords = coordinates as Position;
        
        // Check if it's a Text annotation type
        if (feature.annotationType === "Text") {
          // Try to extract text content from properties
          let textContent = "Text";
          
          if (feature.properties) {
            try {
              const props = JSON.parse(feature.properties);
              if (props.text) {
                textContent = props.text;
              }
            } catch (error) {
              console.warn("Failed to parse feature properties:", error);
            }
          }
          
          // Create text marker with DivIcon
          layer = L.marker([coords[1], coords[0]], {
            icon: L.divIcon({
              className: "leaflet-div-icon geoman-text",
              html: textContent,
            }),
          }) as ExtendedLayer;
          console.log("📝 Rendered Text:", textContent);
        } else {
          // Regular marker
          layer = L.marker([coords[1], coords[0]]) as ExtendedLayer;
          console.log("📍 Rendered Marker");
        }
      } else if (feature.geometryType.toLowerCase() === "linestring") {
        const coords = coordinates as Position[];
        layer = L.polyline(coords.map((c) => [c[1], c[0]])) as ExtendedLayer;
        console.log("📏 Rendered Line");
      } else if (feature.geometryType.toLowerCase() === "polygon") {
        const coords = coordinates as Position[][];
        layer = L.polygon(coords[0].map((c) => [c[1], c[0]])) as ExtendedLayer;
        console.log("🔷 Rendered Polygon");
      } else if (feature.geometryType.toLowerCase() === "circle") {
        const coords = coordinates as [number, number, number];
        layer = L.circle([coords[1], coords[0]], { radius: coords[2] }) as ExtendedLayer;
        console.log("⭕ Rendered Circle");
      }

      if (layer) {
        // Apply stored style if available
        if (feature.style) {
          try {
            const storedStyle = JSON.parse(feature.style);
            applyLayerStyle(layer, storedStyle);
            console.log("🎨 Applied style:", storedStyle);
          } catch (error) {
            console.warn("Failed to parse feature style:", error);
          }
        }

        // Set high z-index for features to ensure they appear above data layers
        const featureZIndex = 2000 + (feature.zIndex || 0);
        if (hasSetZIndex(layer)) {
          layer.setZIndex(featureZIndex);
        }

        if (feature.properties) {
          try {
            const properties = JSON.parse(feature.properties);
            const popupContent = Object.entries(properties)
              .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
              .join("<br>");
            if (hasBindPopup(layer)) layer.bindPopup(popupContent);
          } catch {
            if (hasBindPopup(layer)) {
              layer.bindPopup(
                `<strong>Name:</strong> ${feature.name || "Unnamed Feature"}`
              );
            }
          }
        } else if (hasBindPopup(layer)) {
          layer.bindPopup(
            `<strong>Name:</strong> ${feature.name || "Unnamed Feature"}`
          );
        }

        sketchGroup.addLayer(layer);
        featureRefs.current.set(feature.featureId, layer);
      }
    } catch (error) {
      console.warn(`Failed to render feature ${feature.name}:`, error);
    }
  }
  
  console.log("✅ Finished rendering features");
}

export async function toggleLayerVisibility(
  map: LMap,
  layerId: string,
  isVisible: boolean,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, Layer>>
): Promise<void> {
  if (!map) return;

  const existingLayer = dataLayerRefs.current.get(layerId);

  if (isVisible && !existingLayer) {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;

    try {
      const L = (await import("leaflet")).default;
      const layerData = JSON.parse(layer.layerData || '{}');
     
      if (layerData.type === 'FeatureCollection' && layerData.features) {
        // Parse layer style and custom style
        let layerStyle = {};
        let customStyle = {};
       
        try {
          if (layer.layerStyle) {
            layerStyle = JSON.parse(layer.layerStyle);
          }
        } catch (error) {
          console.warn("Failed to parse layer style:", error);
        }
       
        try {
          if (layer.customStyle) {
            customStyle = JSON.parse(layer.customStyle);
          }
        } catch (error) {
          console.warn("Failed to parse custom style:", error);
        }
       
        // Merge layer style with custom style (custom style takes precedence)
        const finalStyle = { ...layerStyle, ...customStyle };

        const geoJsonLayer = L.geoJSON(layerData, {
          style: Object.keys(finalStyle).length > 0 ? finalStyle : undefined,
          onEachFeature: (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
            if (feature.properties) {
              const popupContent = Object.entries(feature.properties)
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join("<br>");
              if (hasBindPopup(leafletLayer)) {
                leafletLayer.bindPopup(popupContent);
              }
            }
          },
        });

        const dataLayerZIndex = 1000 + (layer.zIndex || 0);
        if (hasSetZIndex(geoJsonLayer)) {
          geoJsonLayer.setZIndex(dataLayerZIndex);
        }
        map.addLayer(geoJsonLayer);
        dataLayerRefs.current.set(layerId, geoJsonLayer);
      }
    } catch (error) {
      console.warn(`Failed to render layer ${layer.name}:`, error);
    }
  } else if (!isVisible && existingLayer) {
    if (map.hasLayer(existingLayer)) {
      map.removeLayer(existingLayer);
    }
    dataLayerRefs.current.delete(layerId);
  }
}

export function toggleFeatureVisibilityLocal(
  features: FeatureData[],
  featureId: string,
  map?: LMap | null,
  sketchGroup?: FeatureGroup | null
): FeatureData[] {
  return features.map((f) => {
    if (f.featureId === featureId || f.id === featureId) {
      const newVisibility = !f.isVisible;

      if (map && sketchGroup) {
        if (newVisibility) {
          if (!sketchGroup.hasLayer(f.layer)) {
            sketchGroup.addLayer(f.layer);
          }
        } else {
          sketchGroup.removeLayer(f.layer);
        }
      }

      return { ...f, isVisible: newVisibility };
    }
    return f;
  });
}

export async function toggleFeatureVisibility(
  map: LMap,
  featureId: string,
  isVisible: boolean,
  features: MapFeatureResponse[],
  featureRefs: React.MutableRefObject<Map<string, Layer>>,
  sketchGroup: FeatureGroup
): Promise<void> {
  if (!map) return;

  const existingFeature = featureRefs.current.get(featureId);

  if (isVisible && !existingFeature) {
    const feature = features.find((f) => f.featureId === featureId);
    if (!feature) return;

    try {
      const L = (await import("leaflet")).default;
      let coordinates: Position | Position[] | Position[][];
      try {
        coordinates = JSON.parse(feature.coordinates);
      } catch {
        console.warn("Failed to parse coordinates for feature:", feature.featureId);
        return;
      }

      let layer: ExtendedLayer | null = null;

      if (feature.geometryType.toLowerCase() === "point") {
        const coords = coordinates as Position;
        
        // Check if it's a Text annotation type
        if (feature.annotationType === "Text") {
          // Try to extract text content from properties
          let textContent = "Text";
          
          if (feature.properties) {
            try {
              const props = JSON.parse(feature.properties);
              if (props.text) {
                textContent = props.text;
              }
            } catch (error) {
              console.warn("Failed to parse feature properties:", error);
            }
          }
          
          // Create text marker with DivIcon
          layer = L.marker([coords[1], coords[0]], {
            icon: L.divIcon({
              className: "leaflet-div-icon geoman-text",
              html: textContent,
            }),
          }) as ExtendedLayer;
        } else {
          // Regular marker
          layer = L.marker([coords[1], coords[0]]) as ExtendedLayer;
        }
      } else if (feature.geometryType.toLowerCase() === "linestring") {
        const coords = coordinates as Position[];
        layer = L.polyline(coords.map((c) => [c[1], c[0]])) as ExtendedLayer;
      } else if (feature.geometryType.toLowerCase() === "polygon") {
        const coords = coordinates as Position[][];
        layer = L.polygon(coords[0].map((c) => [c[1], c[0]])) as ExtendedLayer;
      } else if (feature.geometryType.toLowerCase() === "circle") {
        const coords = coordinates as [number, number, number];
        layer = L.circle([coords[1], coords[0]], { radius: coords[2] }) as ExtendedLayer;
      }

      if (layer) {
        // Apply stored style if available
        if (feature.style) {
          try {
            const storedStyle = JSON.parse(feature.style);
            applyLayerStyle(layer, storedStyle);
          } catch (error) {
            console.warn("Failed to parse feature style:", error);
          }
        }

        // Set high z-index for features to ensure they appear above data layers
        const featureZIndex = 2000 + (feature.zIndex || 0);
        if (hasSetZIndex(layer)) {
          layer.setZIndex(featureZIndex);
        }

        if (feature.properties) {
          try {
            const properties = JSON.parse(feature.properties);
            const popupContent = Object.entries(properties)
              .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
              .join("<br>");
            if (hasBindPopup(layer)) layer.bindPopup(popupContent);
          } catch {
            if (hasBindPopup(layer)) {
              layer.bindPopup(
                `<strong>Name:</strong> ${feature.name || "Unnamed Feature"}`
              );
            }
          }
        } else if (hasBindPopup(layer)) {
          layer.bindPopup(
            `<strong>Name:</strong> ${feature.name || "Unnamed Feature"}`
          );
        }

        sketchGroup.addLayer(layer);
        featureRefs.current.set(featureId, layer);
      }
    } catch (error) {
      console.warn(`Failed to render feature ${feature.name}:`, error);
    }
  } else if (!isVisible && existingFeature) {
    if (sketchGroup.hasLayer(existingFeature)) {
      sketchGroup.removeLayer(existingFeature);
    }
    featureRefs.current.delete(featureId);
  }
}


export async function addDataLayerToMap(
  mapId: string,
  layerId: string,
  isVisible: boolean = true,
  zIndex: number = 0
): Promise<boolean> {
  try {
    const { addLayerToMap } = await import("@/lib/api");
    await addLayerToMap(mapId, {
      layerId,
      isVisible,
      zIndex,
      customStyle: null,
      filterConfig: null,
    });
    return true;
  } catch (error) {
    console.error("Failed to add data layer to map:", error);
    return false;
  }
}

export async function updateDataLayerInMap(
  mapId: string,
  layerId: string,
  updates: {
    isVisible?: boolean;
    zIndex?: number;
    customStyle?: string;
    filterConfig?: string;
  }
): Promise<boolean> {
  try {
    const { updateMapLayer } = await import("@/lib/api");
    await updateMapLayer(mapId, layerId, updates);
    return true;
  } catch (error) {
    console.error("Failed to update data layer in map:", error);
    return false;
  }
}

export async function removeDataLayerFromMap(
  mapId: string,
  layerId: string
): Promise<boolean> {
  try {
    const { removeLayerFromMap } = await import("@/lib/api");
    await removeLayerFromMap(mapId, layerId);
    return true;
  } catch (error) {
    console.error("Failed to remove data layer from map:", error);
    return false;
  }
}

export async function createFeatureInMap(
  mapId: string,
  featureData: CreateMapFeatureRequest
): Promise<MapFeatureResponse | null> {
  try {
    const { createMapFeature } = await import("@/lib/api");
    return await createMapFeature(mapId, featureData);
  } catch (error) {
    console.error("Failed to create feature in map:", error);
    return null;
  }
}

export async function updateFeatureInMap(
  mapId: string,
  featureId: string,
  updates: UpdateMapFeatureRequest
): Promise<MapFeatureResponse | null> {
  try {
    const { updateMapFeature } = await import("@/lib/api");
    return await updateMapFeature(mapId, featureId, updates);
  } catch (error) {
    console.error("Failed to update feature in map:", error);
    return null;
  }
}

export async function deleteFeatureFromMap(
  mapId: string,
  featureId: string
): Promise<boolean> {
  try {
    const { deleteMapFeature } = await import("@/lib/api");
    await deleteMapFeature(mapId, featureId);
    return true;
  } catch (error) {
    console.error("Failed to delete feature from map:", error);
    return false;
  }
}

export async function handleAddDataLayer(
  mapId: string,
  layerId: string,
  isVisible: boolean = true,
  zIndex: number = 0,
  onSuccess?: () => Promise<void>
): Promise<boolean> {
  if (!mapId) return false;

  const success = await addDataLayerToMap(mapId, layerId, isVisible, zIndex);
  if (success && onSuccess) {
    try {
      await onSuccess();
    } catch (error) {
      console.error("Failed to execute success callback:", error);
    }
  }
  return success;
}

export async function handleUpdateDataLayer(
  mapId: string,
  layerId: string,
  updates: {
    isVisible?: boolean;
    zIndex?: number;
    customStyle?: string;
    filterConfig?: string;
  },
  onSuccess?: (updates: {
    isVisible?: boolean;
    zIndex?: number;
    customStyle?: string;
    filterConfig?: string;
  }) => Promise<void>
): Promise<boolean> {
  if (!mapId) return false;

  const success = await updateDataLayerInMap(mapId, layerId, updates);
  if (success && onSuccess) {
    try {
      await onSuccess(updates);
    } catch (error) {
      console.error("Failed to execute success callback:", error);
    }
  }
  return success;
}

export async function handleRemoveDataLayer(
  mapId: string,
  layerId: string,
  onSuccess?: () => Promise<void>
): Promise<boolean> {
  if (!mapId) return false;

  const success = await removeDataLayerFromMap(mapId, layerId);
  if (success && onSuccess) {
    try {
      await onSuccess();
    } catch (error) {
      console.error("Failed to execute success callback:", error);
    }
  }
  return success;
}

export async function renderAllDataLayers(
  map: LMap,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, Layer>>,
  signal?: AbortSignal
): Promise<void> {
  if (!map || !layers) {
    return;
  }

  const L = (await import("leaflet")).default;

  if (signal?.aborted) return;

  dataLayerRefs.current.forEach((layer) => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });
  dataLayerRefs.current.clear();

  for (const layer of layers) {
    if (signal?.aborted) break;
    if (!layer.isVisible) {
      continue;
    }

    try {
      const layerData = JSON.parse(layer.layerData || '{}');
     
      if (layerData.type === 'FeatureCollection' && layerData.features) {
        // Parse layer style and custom style
        let layerStyle = {};
        let customStyle = {};
       
        try {
          if (layer.layerStyle) {
            layerStyle = JSON.parse(layer.layerStyle);
          }
        } catch (error) {
          console.warn("Failed to parse layer style:", error);
        }
       
        try {
          if (layer.customStyle) {
            customStyle = JSON.parse(layer.customStyle);
          }
        } catch (error) {
          console.warn("Failed to parse custom style:", error);
        }
       
        // Merge layer style with custom style (custom style takes precedence)
        const finalStyle = { ...layerStyle, ...customStyle };

        const geoJsonLayer = L.geoJSON(layerData, {
          style: Object.keys(finalStyle).length > 0 ? finalStyle : undefined,
          onEachFeature: (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
            if (feature.properties) {
              const popupContent = Object.entries(feature.properties)
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join("<br>");
              if (hasBindPopup(leafletLayer)) {
                leafletLayer.bindPopup(popupContent);
              }
            }

            type LayerWithMeta = Layer & {
              _feature?: GeoJSON.Feature;
              _layerId?: string;
              _layerName?: string;
            };
            const meta = leafletLayer as LayerWithMeta;
            meta._feature = feature;
            meta._layerId = layer.id;
            meta._layerName = layer.name;

            leafletLayer.on("contextmenu", (e: LeafletMouseEvent) => {
              const original = e.originalEvent as MouseEvent;
              original.preventDefault();

              const event = new CustomEvent("zone-contextmenu", {
                detail: {
                  feature,
                  layerId: layer.id,
                  layerName: layer.name,
                  x: original.clientX,
                  y: original.clientY,
                  leafletLayer,
                },
              });
              window.dispatchEvent(event);
            });
          },
        });

        if (signal?.aborted) break;

        map.addLayer(geoJsonLayer);

        dataLayerRefs.current.set(layer.id, geoJsonLayer);
      }
    } catch (error) {
      console.warn(`Failed to render layer ${layer.name}:`, error);
    }
  }
}

export async function updateLayerStyle(
  mapId: string,
  layerId: string,
  styleUpdates: {
    customStyle?: string;
    isVisible?: boolean;
    zIndex?: number;
  },
  map: LMap,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, Layer>>
): Promise<boolean> {
  try {
    const { updateMapLayer } = await import("@/lib/api");
    await updateMapLayer(mapId, layerId, styleUpdates);

    await renderAllDataLayers(map, layers, dataLayerRefs);
    return true;
  } catch (error) {
    console.error("Failed to update layer style:", error);
    return false;
  }
}

export async function updateFeatureStyle(
  mapId: string,
  featureId: string,
  styleUpdates: {
    name?: string;
    style?: string;
    properties?: string;
    isVisible?: boolean;
    zIndex?: number;
  }
): Promise<boolean> {
  try {
    const { updateMapFeature } = await import("@/lib/api");
    await updateMapFeature(mapId, featureId, styleUpdates);
    return true;
  } catch (error) {
    console.error("Failed to update feature style:", error);
    return false;
  }
}

export async function handleUpdateLayerStyle(
  mapId: string,
  layerId: string,
  updates: {
    customStyle?: string;
    isVisible?: boolean;
    zIndex?: number;
  },
  map: LMap,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>,
  onRefresh?: () => Promise<void>
): Promise<void> {
  if (!map) return;

  try {
    await updateLayerStyle(mapId, layerId, updates, map, layers, dataLayerRefs);
   
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to update layer:", error);
  }
}

export async function handleUpdateFeatureStyle(
  mapId: string,
  featureId: string,
  updates: {
    name?: string;
    style?: string;
    properties?: string;
    isVisible?: boolean;
    zIndex?: number;
  },
  onRefresh?: () => Promise<void>
): Promise<void> {
  try {
    await updateFeatureStyle(mapId, featureId, updates);
   
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to update feature:", error);
  }
}

export async function handleDeleteFeature(
  mapId: string,
  featureId: string,
  features: FeatureData[],
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>,
  map?: LMap | null,
  sketchGroup?: FeatureGroup | null,
  onRefresh?: () => Promise<void>
): Promise<void> {
  try {
    await deleteFeatureFromDB(mapId, featureId);
    console.log("Delete featureId", featureId);
    setFeatures(prev => removeFeatureFromList(prev, featureId, map, sketchGroup));
   
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to delete feature:", error);
  }
}

export function handleSelectLayer(
  layer: FeatureData | RawLayer | null,
  setSelectedLayer: React.Dispatch<
    React.SetStateAction<FeatureData | RawLayer | null>
  >,
  setShowLayerPanel: React.Dispatch<React.SetStateAction<boolean>>
): void {
  setSelectedLayer(layer);
  setShowLayerPanel(true);
}

/**
 * Update feature style in real-time and save to database
 */
export async function updateFeatureStyleRealTime(
  mapId: string,
  featureId: string,
  layer: ExtendedLayer,
  features: FeatureData[],
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>,
  onRefresh?: () => Promise<void>
): Promise<void> {
  try {
    // Extract current style from layer
    const layerStyle = extractLayerStyle(layer);
   
    // Update feature in database
    const { updateMapFeature } = await import("@/lib/api");
    await updateMapFeature(mapId, featureId, {
      style: JSON.stringify(layerStyle)
    });
   
    // Update local state
    setFeatures(prev => prev.map(f => 
      f.featureId === featureId 
        ? { ...f, layer }
        : f
    ));
   
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to update feature style:", error);
  }
}

/**
 * Update layer style in real-time and save to database
 */
export async function updateLayerStyleRealTime(
  mapId: string,
  layerId: string,
  customStyle: Record<string, unknown>,
  onRefresh?: () => Promise<void>
): Promise<void> {
  try {
    // Update layer in database
    const { updateMapLayer } = await import("@/lib/api");
    await updateMapLayer(mapId, layerId, {
      customStyle: JSON.stringify(customStyle)
    });
   
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to update layer style:", error);
  }
}

/**
 * Apply style to layer and update database
 */
export async function applyStyleToFeature(
  mapId: string,
  featureId: string,
  layer: ExtendedLayer,
  style: Record<string, unknown>,
  features: FeatureData[],
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>,
  onRefresh?: () => Promise<void>
): Promise<void> {
  try {
    // Apply style to layer
    applyLayerStyle(layer, style);
   
    // Update feature in database
    const { updateMapFeature } = await import("@/lib/api");
    await updateMapFeature(mapId, featureId, {
      style: JSON.stringify(style)
    });
   
    // Update local state
    setFeatures(prev => prev.map(f => 
      f.featureId === featureId 
        ? { ...f, layer }
        : f
    ));
   
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to apply style to feature:", error);
  }
}

/**
 * Apply style to data layer and update database
 */
export async function applyStyleToDataLayer(
  mapId: string,
  layerId: string,
  style: Record<string, unknown>,
  onRefresh?: () => Promise<void>
): Promise<void> {
  try {
    // Update layer in database
    const { updateMapLayer } = await import("@/lib/api");
    await updateMapLayer(mapId, layerId, {
      customStyle: JSON.stringify(style)
    });
   
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to apply style to data layer:", error);
  }
}

export async function handleLayerVisibilityChange(
  mapId: string,
  layerId: string,
  isVisible: boolean,
  map: LMap,
  dataLayerRefs: React.MutableRefObject<Map<string, Layer>>,
  setLayerVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  layerData?: RawLayer
): Promise<void> {
  if (!map) return;

  console.log("👁️ Toggling layer visibility:", { layerId, isVisible });

  setLayerVisibility(prev => ({
    ...prev,
    [layerId]: isVisible
  }));

  let layerOnMap = dataLayerRefs.current.get(layerId);
  
  if (isVisible && !layerOnMap && layerData) {
    console.log("🔄 Layer not loaded yet, loading now:", layerData.name);
    const success = await loadLayerToMap(map, layerData, dataLayerRefs);
    if (success) {
      layerOnMap = dataLayerRefs.current.get(layerId);
      console.log("✅ Layer loaded successfully:", layerData.name);
    } else {
      console.warn("⚠️ Failed to load layer:", layerData.name);
    }
  }

  if (layerOnMap) {
    if (isVisible) {
      if (!map.hasLayer(layerOnMap)) {
        map.addLayer(layerOnMap);
      }
    } else {
      if (map.hasLayer(layerOnMap)) {
        map.removeLayer(layerOnMap);
      }
    }
  }

  try {
    const { updateMapLayer } = await import("@/lib/api");
    await updateMapLayer(mapId, layerId, { isVisible });
    console.log("Layer visibility updated in database");
  } catch (error) {
    console.error("Failed to update layer visibility in database:", error);

    setLayerVisibility(prev => ({
      ...prev,
      [layerId]: !isVisible
    }));

    if (layerOnMap) {
      if (!isVisible) {
        if (!map.hasLayer(layerOnMap)) {
          map.addLayer(layerOnMap);
        }
      } else {
        if (map.hasLayer(layerOnMap)) {
          map.removeLayer(layerOnMap);
        }
      }
    }
  }
}

export async function handleFeatureVisibilityChange(
  mapId: string,
  featureId: string,
  isVisible: boolean,
  features: FeatureData[],
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>,
  map: LMap | null,
  sketchGroup: FeatureGroup | null,
  setFeatureVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
): Promise<void> {
  // Find the feature
  const feature = features.find(f => f.id === featureId || f.featureId === featureId);
  if (!feature) {
    return;
  }

  // Update feature visibility state
  setFeatureVisibility(prev => ({
    ...prev,
    [featureId]: isVisible
  }));

  // Update feature isVisible in features state
  setFeatures(prev => prev.map(f => {
    if (f.id === featureId || f.featureId === featureId) {
      return { ...f, isVisible };
    }
    return f;
  }));

  if (feature.featureId) {
    try {
      const { updateMapFeature } = await import("@/lib/api");
      await updateMapFeature(mapId, feature.featureId, { isVisible });
    } catch (error) {
      console.error("Failed to update feature visibility in database:", error);

      setFeatureVisibility(prev => ({
        ...prev,
        [featureId]: !isVisible
      }));

      setFeatures(prev => prev.map(f => {
        if (f.id === featureId || f.featureId === featureId) {
          return { ...f, isVisible: !isVisible };
        }
        return f;
      }));
    }
  }
}

// COMMON STYLE PRESETS

/**
 * Common style presets for different layer types
 */
export const STYLE_PRESETS = {
  // Marker styles
  marker: {
    default: {
      color: '#3388ff',
      fillColor: '#3388ff',
      fillOpacity: 0.8,
      radius: 8
    },
    red: {
      color: '#ff0000',
      fillColor: '#ff0000',
      fillOpacity: 0.8,
      radius: 8
    },
    green: {
      color: '#00ff00',
      fillColor: '#00ff00',
      fillOpacity: 0.8,
      radius: 8
    },
    blue: {
      color: '#0000ff',
      fillColor: '#0000ff',
      fillOpacity: 0.8,
      radius: 8
    }
  },
 
  // Line styles
  line: {
    default: {
      color: '#3388ff',
      weight: 3,
      opacity: 0.8
    },
    dashed: {
      color: '#3388ff',
      weight: 3,
      opacity: 0.8,
      dashArray: '10, 10'
    },
    thick: {
      color: '#3388ff',
      weight: 6,
      opacity: 0.8
    },
    thin: {
      color: '#3388ff',
      weight: 1,
      opacity: 0.8
    }
  },
 
  // Polygon styles
  polygon: {
    default: {
      color: '#3388ff',
      weight: 2,
      opacity: 0.8,
      fillColor: '#3388ff',
      fillOpacity: 0.3
    },
    filled: {
      color: '#3388ff',
      weight: 2,
      opacity: 0.8,
      fillColor: '#3388ff',
      fillOpacity: 0.6
    },
    outline: {
      color: '#3388ff',
      weight: 3,
      opacity: 1,
      fillColor: '#3388ff',
      fillOpacity: 0.1
    },
    transparent: {
      color: '#3388ff',
      weight: 2,
      opacity: 0.5,
      fillColor: '#3388ff',
      fillOpacity: 0.1
    }
  },
 
  // Circle styles
  circle: {
    default: {
      color: '#3388ff',
      weight: 2,
      opacity: 0.8,
      fillColor: '#3388ff',
      fillOpacity: 0.3
    },
    filled: {
      color: '#3388ff',
      weight: 2,
      opacity: 0.8,
      fillColor: '#3388ff',
      fillOpacity: 0.6
    },
    outline: {
      color: '#3388ff',
      weight: 3,
      opacity: 1,
      fillColor: '#3388ff',
      fillOpacity: 0.1
    }
  }
};

/**
 * Get style preset for a specific layer type
 */
export function getStylePreset(layerType: string, presetName: string = 'default'): Record<string, unknown> {
  const typePresets = STYLE_PRESETS[layerType as keyof typeof STYLE_PRESETS];
  if (!typePresets) return {};
 
  return typePresets[presetName as keyof typeof typePresets] || typePresets.default || {};
}

/**
 * Create a custom style object with validation
 */
export function createCustomStyle(styleOptions: {
  color?: string;
  fillColor?: string;
  weight?: number;
  opacity?: number;
  fillOpacity?: number;
  radius?: number;
  dashArray?: string;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}): Record<string, unknown> {
  const style: Record<string, unknown> = {};
 
  // Validate and add color properties
  if (styleOptions.color && /^#[0-9A-F]{6}$/i.test(styleOptions.color)) {
    style.color = styleOptions.color;
  }
  if (styleOptions.fillColor && /^#[0-9A-F]{6}$/i.test(styleOptions.fillColor)) {
    style.fillColor = styleOptions.fillColor;
  }
 
  // Validate and add numeric properties
  if (styleOptions.weight && styleOptions.weight > 0 && styleOptions.weight <= 20) {
    style.weight = styleOptions.weight;
  }
  if (styleOptions.opacity && styleOptions.opacity >= 0 && styleOptions.opacity <= 1) {
    style.opacity = styleOptions.opacity;
  }
  if (styleOptions.fillOpacity && styleOptions.fillOpacity >= 0 && styleOptions.fillOpacity <= 1) {
    style.fillOpacity = styleOptions.fillOpacity;
  }
  if (styleOptions.radius && styleOptions.radius > 0 && styleOptions.radius <= 1000) {
    style.radius = styleOptions.radius;
  }
 
  // Validate and add string properties
  if (styleOptions.dashArray) {
    style.dashArray = styleOptions.dashArray;
  }
  if (styleOptions.lineCap && ['butt', 'round', 'square'].includes(styleOptions.lineCap)) {
    style.lineCap = styleOptions.lineCap;
  }
  if (styleOptions.lineJoin && ['miter', 'round', 'bevel'].includes(styleOptions.lineJoin)) {
    style.lineJoin = styleOptions.lineJoin;
  }
 
  return style;
}
