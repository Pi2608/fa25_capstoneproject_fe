/**
 * Map Utilities - Style Management System
 * 
 * This module provides comprehensive style management for Leaflet layers and features.
 * It includes functions to extract, apply, save, and load styles from the database.
 * 
 * ## Key Features:
 * 
 * ### 1. Style Extraction and Application
 * - `extractLayerStyle()` - Extract style properties from Leaflet layers
 * - `applyLayerStyle()` - Apply style properties to Leaflet layers
 * 
 * ### 2. Database Integration
 * - `saveFeature()` - Save features with their styles to database
 * - `updateFeatureInDB()` - Update features with new styles
 * - `updateFeatureStyleRealTime()` - Real-time style updates
 * - `applyStyleToDataLayer()` - Apply styles to data layers
 * 
 * ### 3. Style Presets
 * - `STYLE_PRESETS` - Predefined style configurations
 * - `getStylePreset()` - Get preset styles by type
 * - `createCustomStyle()` - Create validated custom styles
 * 
 * ### 4. Rendering with Styles
 * - `loadFeaturesToMap()` - Load features with stored styles
 * - `renderFeatures()` - Render features with applied styles
 * - `renderAllDataLayers()` - Render data layers with custom styles
 * 
 * ## Usage Examples:
 * 
 * ### Apply a preset style to a feature:
 * ```typescript
 * const redStyle = getStylePreset('marker', 'red');
 * await applyStyleToFeature(mapId, featureId, layer, redStyle, features, setFeatures, refreshMapDetail);
 * ```
 * 
 * ### Create and apply a custom style:
 * ```typescript
 * const customStyle = createCustomStyle({
 *   color: '#ff0000',
 *   weight: 5,
 *   opacity: 0.8,
 *   fillOpacity: 0.3
 * });
 * await applyStyleToFeature(mapId, featureId, layer, customStyle, features, setFeatures, refreshMapDetail);
 * ```
 * 
 * ### Apply style to a data layer:
 * ```typescript
 * const layerStyle = createCustomStyle({
 *   color: '#00ff00',
 *   weight: 3,
 *   fillColor: '#00ff00',
 *   fillOpacity: 0.2
 * });
 * await applyStyleToDataLayer(mapId, layerId, layerStyle, refreshMapDetail);
 * ```
 * 
 * ### Extract current style from a layer:
 * ```typescript
 * const currentStyle = extractLayerStyle(layer);
 * console.log('Current style:', currentStyle);
 * ```
 * 
 * ## Supported Style Properties:
 * - `color` - Stroke color (hex format: #RRGGBB)
 * - `fillColor` - Fill color (hex format: #RRGGBB)
 * - `weight` - Stroke width (1-20)
 * - `opacity` - Stroke opacity (0-1)
 * - `fillOpacity` - Fill opacity (0-1)
 * - `radius` - Circle radius (1-1000)
 * - `dashArray` - Dash pattern (e.g., "10, 10")
 * - `lineCap` - Line cap style ('butt', 'round', 'square')
 * - `lineJoin` - Line join style ('miter', 'round', 'bevel')
 */

import type { Layer, LatLng, LatLngBounds, FeatureGroup, Map as LMap, Icon, IconOptions } from "leaflet";
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
}

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

interface ParsedLayer extends Omit<RawLayer, "layerData" | "layerStyle" | "filterConfig" | "customStyle"> {
  layerData: Record<string, unknown>;  
  layerStyle: Record<string, unknown>; 
  customStyle?: Record<string, unknown>;
  filterConfig?: Record<string, unknown>;
}

interface ParsedMapData extends Omit<MapDetail, "layers"> {
  layers: ParsedLayer[];
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
        return Array.isArray(coords) && coords.length === 2 && 
               typeof coords[0] === 'number' && typeof coords[1] === 'number';
      
      case "LineString":
        return Array.isArray(coords) && coords.length >= 2 &&
               coords.every((c: unknown) => Array.isArray(c) && c.length === 2 &&
                 typeof c[0] === 'number' && typeof c[1] === 'number');
      
      case "Polygon":
        return Array.isArray(coords) && coords.length >= 1 &&
               Array.isArray(coords[0]) && coords[0].length >= 3 &&
               coords[0].every((c: unknown) => Array.isArray(c) && c.length === 2 &&
                 typeof c[0] === 'number' && typeof c[1] === 'number');
      
      case "Circle":
        return Array.isArray(coords) && coords.length === 3 &&
               typeof coords[0] === 'number' && typeof coords[1] === 'number' && 
               typeof coords[2] === 'number' && coords[2] > 0;
      
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Safely parse JSON string to object.
 */
function safeParseJSON<T = unknown>(value: string, fallback: T = {} as T): T {
  try {
    if (!value) return fallback as T;
    return JSON.parse(value) as T;
  } catch {
    return fallback as T;
  }
}

/**
 * Get feature type from layer
 */
export function getFeatureType(layer: ExtendedLayer): string {
  if (layer._latlng && !layer._mRadius) return "Marker";
  if (layer._mRadius) return "Circle";
  if (layer._bounds) return "Rectangle";
  if (layer._latlngs) {
    const latlngs = layer._latlngs as LatLng[] | LatLng[][];
    if (Array.isArray(latlngs[0])) return "Polygon";
    return "Line";
  }
  return "Unknown";
}

/**
 * Serialize layer to GeoJSON
 */
export function serializeFeature(layer: ExtendedLayer): {
  geometryType: "Point" | "LineString" | "Polygon" | "Circle";
  coordinates: string;
  annotationType: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video";
} {
  const type = getFeatureType(layer);
  let geometryType: "Point" | "LineString" | "Polygon" | "Circle" = "Point";
  let annotationType: "Marker" | "Highlighter" | "Text" | "Note" | "Link" | "Video" = "Marker";
  let coordinates: Position | Position[] | Position[][] = [0, 0];

  if (type === "Marker") {
    geometryType = "Point";
    annotationType = "Marker";
    if (layer._latlng) {
      coordinates = [layer._latlng.lng, layer._latlng.lat];
    } else {
      console.warn("Marker layer missing _latlng property");
      coordinates = [0, 0];
    }
  } else if (type === "Circle") {
    geometryType = "Circle";
    annotationType = "Marker"; // Circle is treated as a special marker
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
      coordinates = [[
        [bounds.getWest(), bounds.getSouth()],
        [bounds.getEast(), bounds.getSouth()],
        [bounds.getEast(), bounds.getNorth()],
        [bounds.getWest(), bounds.getNorth()],
        [bounds.getWest(), bounds.getSouth()],
      ]];
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
      coordinates = [[0, 0], [1, 1]];
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

  return {
    geometryType,
    annotationType,
    coordinates: JSON.stringify(coordinates),
  };
}

/**
 * Create a GeoJSON feature from a Leaflet layer
 */
export function createGeoJSONFeature(layer: ExtendedLayer, properties: Record<string, unknown> = {}): {
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

/**
 * Convert Leaflet layer to GeoJSON FeatureCollection
 */
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
    features: layers.map(layer => createGeoJSONFeature(layer)),
  };
}

/**
 * Convert raw map data (with stringified layerData/layerStyle) into parsed objects.
 */
export function convertMapLayers(rawData: MapDetail): ParsedMapData {
  const parsedLayers: ParsedLayer[] = rawData.layers.map(layer => ({
    ...layer,
    layerData: safeParseJSON(layer.layerData) ?? {},
    layerStyle: safeParseJSON(layer.layerStyle) ?? {},
    filterConfig: safeParseJSON(layer.filterConfig) ?? {},
    customStyle: safeParseJSON(layer.customStyle) ?? {},
  }));

  return { ...rawData, layers: parsedLayers };
}

// FEATURE LIST MANAGEMENT (LOCAL FEATURES)

/**
 * Get feature list from map
 */
export async function getFeatureList(mapId: string): Promise<MapFeatureResponse[]> {
  try {
    return await getMapFeatures(mapId);
  } catch (error) {
    console.error("Failed to get features:", error);
    return [];
  }
}

/**
 * Add feature to list
 */
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

/**
 * Remove feature from list
 */
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


/**
 * Rename feature
 */
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

// LAYER LIST MANAGEMENT (FOR NEW MAP PAGE)

/**
 * Add layer to list (for new map page)
 */
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

/**
 * Remove layer from list (for new map page)
 */
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

/**
 * Toggle layer visibility (for new map page)
 */
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

/**
 * Rename layer (for new map page)
 */
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

// DATABASE OPERATIONS (LOW-LEVEL)

/**
 * Save feature to database
 */
export async function saveFeature(
  mapId: string,
  layerId: string,
  layer: ExtendedLayer,
  features: FeatureData[],
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>
): Promise<FeatureData | null> {
  try {

    const { geometryType, annotationType, coordinates } = serializeFeature(layer);
    const type = getFeatureType(layer);

    // Validate coordinates before sending
    if (!coordinates || coordinates === '[0,0]' || coordinates === '[]') {
      console.error("Invalid coordinates for feature:", coordinates);
      return null;
    }

    // Validate geometry format
    if (!validateGeometry(geometryType, coordinates)) {
      console.error("Invalid geometry format:", { geometryType, coordinates });
      return null;
    }

    // Extract style from layer
    const layerStyle = extractLayerStyle(layer);

    const body: CreateMapFeatureRequest = {
      layerId: layerId || null, // Allow null layerId for standalone features
      name: `${type}`,
      description: "",
      featureCategory: "Annotation",
      annotationType: annotationType,
      geometryType: geometryType,
      coordinates,
      properties: JSON.stringify({}),
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
    return newFeature;
  } catch (error) {
    console.error("Failed to save feature:", error);
    return null;
  }
}

/**
 * Update feature in database
 */
export async function updateFeatureInDB(
  mapId: string,
  featureId: string,
  feature: FeatureData
): Promise<boolean> {
  try {
    const { geometryType, annotationType, coordinates } = serializeFeature(feature.layer);
    
    // Extract current style from layer
    const layerStyle = extractLayerStyle(feature.layer);

    const body: UpdateMapFeatureRequest = {
      name: feature.name,
      description: "",
      featureCategory: "Annotation",
      annotationType: annotationType,
      geometryType: geometryType,
      coordinates,
      properties: JSON.stringify({}),
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

/**
 * Delete feature from database
 */
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

/**
 * Load features from database to map
 */
export async function loadFeaturesToMap(
  mapId: string,
  L: typeof import('leaflet'),
  sketchGroup: FeatureGroup
): Promise<FeatureData[]> {
  try {
    const features = await getMapFeatures(mapId);
    console.log("features", features);
    const featureDataList: FeatureData[] = [];

    for (const feature of features) {
      // Parse coordinates from the string format
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
        layer = L.marker([coords[1], coords[0]]) as ExtendedLayer;
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

        featureDataList.push({
          id: `feature-${feature.featureId}`,
          name: feature.name || `Feature ${featureDataList.length + 1}`,
          type: feature.geometryType,
          layer,
          isVisible,
          featureId: feature.featureId,
        });
      }
      console.log("featureDataList", featureDataList);
    }

    return featureDataList;
  } catch (error) {
    console.error("Failed to load features:", error);
    return [];
  }
}

// LAYER RENDERING FUNCTIONS

/**
 * Render data layers from map detail to the map
 */
export async function renderDataLayers(
  map: LMap,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>
): Promise<void> {
  if (!layers || !map) return;

  const L = (await import("leaflet")).default;

  // Clear existing data layers only (not base map)
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
                .join('<br>');
              leafletLayer.bindPopup(popupContent);
            }
          }
        });

        const dataLayerZIndex = 1000 + (layer.zIndex || 0);
        geoJsonLayer.setZIndex(dataLayerZIndex);
        map.addLayer(geoJsonLayer);
        
        dataLayerRefs.current.set(layer.id, geoJsonLayer);
      }
    } catch (error) {
      console.warn(`Failed to render layer ${layer.name}:`, error);
    }
  }
}

/**
 * Render features from database to the map
 */
export async function renderFeatures(
  map: LMap,
  features: MapFeatureResponse[],
  featureRefs: React.MutableRefObject<Map<string, L.Layer>>,
  sketchGroup: FeatureGroup
): Promise<void> {
  if (!features || !map) return;

  const L = (await import("leaflet")).default;

  // Clear existing feature layers only (not base map or data layers)
  featureRefs.current.forEach((layer) => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
    if (sketchGroup.hasLayer(layer)) {
      sketchGroup.removeLayer(layer);
    }
  });
  featureRefs.current.clear();

  // Render visible features
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
        layer = L.marker([coords[1], coords[0]]) as ExtendedLayer;
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
        (layer as L.Layer & { setZIndex?: (zIndex: number) => void }).setZIndex?.(featureZIndex);
        
        // Add popup if feature has properties
        if (feature.properties) {
          try {
            const properties = JSON.parse(feature.properties);
            const popupContent = Object.entries(properties)
              .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
              .join('<br>');
            layer.bindPopup(popupContent);
          } catch {
            // If properties can't be parsed, show basic info
            layer.bindPopup(`<strong>Name:</strong> ${feature.name || 'Unnamed Feature'}`);
          }
        } else {
          layer.bindPopup(`<strong>Name:</strong> ${feature.name || 'Unnamed Feature'}`);
        }

        sketchGroup.addLayer(layer);
        featureRefs.current.set(feature.featureId, layer);
      }
    } catch (error) {
      console.warn(`Failed to render feature ${feature.name}:`, error);
    }
  }
}

// LAYER VISIBILITY TOGGLE FUNCTIONS

/**
 * Toggle individual data layer visibility
 */
export async function toggleLayerVisibility(
  map: LMap,
  layerId: string,
  isVisible: boolean,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>
): Promise<void> {
  if (!map) return;

  const existingLayer = dataLayerRefs.current.get(layerId);

  if (isVisible && !existingLayer) {
    // Layer should be visible but doesn't exist, render it
    const layer = layers.find(l => l.id === layerId);
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
                .join('<br>');
              leafletLayer.bindPopup(popupContent);
            }
          }
        });

        // Set high z-index for data layers to ensure they appear above base layers
        // Base layers typically use z-index 0-100, so we use 1000+ for data layers
        const dataLayerZIndex = 1000 + (layer.zIndex || 0);
        geoJsonLayer.setZIndex(dataLayerZIndex);
        map.addLayer(geoJsonLayer);
        dataLayerRefs.current.set(layerId, geoJsonLayer);
      }
    } catch (error) {
      console.warn(`Failed to render layer ${layer.name}:`, error);
    }
  } else if (!isVisible && existingLayer) {
    // Only remove data layers, never base layers
    if (map.hasLayer(existingLayer)) {
      map.removeLayer(existingLayer);
    }
    dataLayerRefs.current.delete(layerId);
  }
}

/**
 * Toggle individual feature visibility (for local features)
 */
export function toggleFeatureVisibilityLocal(
  features: FeatureData[],
  featureId: string,
  map?: LMap | null,
  sketchGroup?: FeatureGroup | null
): FeatureData[] {
  return features.map((f) => {
    if (f.id === featureId) {
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

/**
 * Toggle individual feature visibility
 */
export async function toggleFeatureVisibility(
  map: LMap,
  featureId: string,
  isVisible: boolean,
  features: MapFeatureResponse[],
  featureRefs: React.MutableRefObject<Map<string, L.Layer>>,
  sketchGroup: FeatureGroup
): Promise<void> {
  if (!map) return;

  const existingFeature = featureRefs.current.get(featureId);

  if (isVisible && !existingFeature) {
    // Feature should be visible but doesn't exist, render it
    const feature = features.find(f => f.featureId === featureId);
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
        layer = L.marker([coords[1], coords[0]]) as ExtendedLayer;
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
        (layer as L.Layer & { setZIndex?: (zIndex: number) => void }).setZIndex?.(featureZIndex);
        
        // Add popup if feature has properties
        if (feature.properties) {
          try {
            const properties = JSON.parse(feature.properties);
            const popupContent = Object.entries(properties)
              .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
              .join('<br>');
            layer.bindPopup(popupContent);
          } catch {
            layer.bindPopup(`<strong>Name:</strong> ${feature.name || 'Unnamed Feature'}`);
          }
        } else {
          layer.bindPopup(`<strong>Name:</strong> ${feature.name || 'Unnamed Feature'}`);
        }

        sketchGroup.addLayer(layer);
        featureRefs.current.set(featureId, layer);
      }
    } catch (error) {
      console.warn(`Failed to render feature ${feature.name}:`, error);
    }
  } else if (!isVisible && existingFeature) {
    // Only remove features, never base layers or data layers
    if (sketchGroup.hasLayer(existingFeature)) {
      sketchGroup.removeLayer(existingFeature);
    }
    featureRefs.current.delete(featureId);
  }
}

// CRUD OPERATIONS (LOW-LEVEL API CALLS)

/**
 * CRUD operations for data layers
 */
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
      filterConfig: null
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

/**
 * CRUD operations for features
 */
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

// HIGH-LEVEL MAP MANAGEMENT FUNCTIONS

/**
 * Render features from database to the map (high-level wrapper)
 */
export async function renderFeaturesCallback(
  mapId: string,
  map: LMap,
  featureRefs: React.MutableRefObject<Map<string, L.Layer>>,
  sketchGroup: FeatureGroup
): Promise<void> {
  if (!mapId || !map || !sketchGroup) return;
  
  try {
    const { getMapFeatures } = await import("@/lib/api");
    const dbFeatures = await getMapFeatures(mapId);
    await renderFeatures(map, dbFeatures, featureRefs, sketchGroup);
  } catch (error) {
    console.error("Failed to render features:", error);
  }
}

/**
 * Toggle individual feature visibility (high-level wrapper)
 */
export async function toggleFeatureVisibilityCallback(
  mapId: string,
  featureId: string,
  isVisible: boolean,
  map: LMap,
  featureRefs: React.MutableRefObject<Map<string, L.Layer>>,
  sketchGroup: FeatureGroup
): Promise<void> {
  if (!mapId || !map || !sketchGroup) return;
  
  try {
    const { getMapFeatures } = await import("@/lib/api");
    const dbFeatures = await getMapFeatures(mapId);
    await toggleFeatureVisibility(map, featureId, isVisible, dbFeatures, featureRefs, sketchGroup);
  } catch (error) {
    console.error("Failed to toggle feature visibility:", error);
  }
}

/**
 * Add data layer to map (high-level wrapper with state management)
 */
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

/**
 * Update data layer in map (high-level wrapper with state management)
 */
export async function handleUpdateDataLayer(
  mapId: string,
  layerId: string,
  updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string },
  onSuccess?: (updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => Promise<void>
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

/**
 * Remove data layer from map (high-level wrapper with state management)
 */
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

/**
 * Render all data layers from map detail to the map (with proper error handling)
 */
export async function renderAllDataLayers(
  map: LMap,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>,
  signal?: AbortSignal // ✅ Add this
): Promise<void> {
  if (!map || !layers) return;

  const L = (await import("leaflet")).default;
  
  if (signal?.aborted) return; // ✅ Check cancellation

  // Clear existing data layers
  dataLayerRefs.current.forEach((layer) => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });
  dataLayerRefs.current.clear();

  // Render visible layers
  for (const layer of layers) {
    if (signal?.aborted) break; // ✅ Check in loop
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
            if (feature.properties) {
              const popupContent = Object.entries(feature.properties)
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join('<br>');
              leafletLayer.bindPopup(popupContent);
            }
          }
        });

        if (signal?.aborted) break; // ✅ Check before adding

        const dataLayerZIndex = 1000 + (layer.zIndex || 0);
        geoJsonLayer.setZIndex(dataLayerZIndex);
        map.addLayer(geoJsonLayer);
        
        dataLayerRefs.current.set(layer.id, geoJsonLayer);
      }
    } catch (error) {
      console.warn(`Failed to render layer ${layer.name}:`, error);
    }
  }
}

/**
 * Update layer style in database and re-render
 */
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
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>
): Promise<boolean> {
  try {
    const { updateMapLayer } = await import("@/lib/api");
    await updateMapLayer(mapId, layerId, styleUpdates);
    
    // Re-render the layer with new style
    await renderAllDataLayers(map, layers, dataLayerRefs);
    return true;
  } catch (error) {
    console.error("Failed to update layer style:", error);
    return false;
  }
}

/**
 * Update feature style in database
 */
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

// HIGH-LEVEL CRUD OPERATION HANDLERS

/**
 * Handle layer visibility change with database update and re-rendering
 */
export async function handleLayerVisibilityChange(
  mapId: string,
  layerId: string,
  isVisible: boolean,
  map: LMap,
  layers: RawLayer[],
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>,
  onRefresh?: () => Promise<void>
): Promise<void> {
  if (!map) return;
  
  try {
    const { updateMapLayer } = await import("@/lib/api");
    console.log("mapId", mapId, "layerId", layerId, "isVisible", isVisible);
    await updateMapLayer(mapId, layerId, { isVisible });
    
    // Re-render layers
    if (layers) {
      await renderAllDataLayers(map, layers, dataLayerRefs);
    }
    
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to update layer visibility:", error);
  }
}

/**
 * Handle feature visibility change with database update and local state update
 */
export async function handleFeatureVisibilityChange(
  mapId: string,
  featureId: string,
  isVisible: boolean,
  features: FeatureData[],
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>,
  map?: LMap | null,
  sketchGroup?: FeatureGroup | null,
  onRefresh?: () => Promise<void>
): Promise<void> {
  try {
    const { updateMapFeature } = await import("@/lib/api");
    console.log("mapId", mapId, "featureId", featureId, "isVisible", isVisible);
    await updateMapFeature(mapId, featureId, { isVisible });
    
    // Update local state
    setFeatures(prev => toggleFeatureVisibilityLocal(prev, featureId, map, sketchGroup));
    
    // Call refresh callback if provided
    if (onRefresh) {
      await onRefresh();
    }
  } catch (error) {
    console.error("Failed to update feature visibility:", error);
  }
}

/**
 * Handle layer style updates with database update and re-rendering
 */
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

/**
 * Handle feature style updates with database update
 */
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

/**
 * Handle feature deletion with database update and local state update
 */
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

/**
 * Handle layer selection for editing
 */
export function handleSelectLayer(
  layer: FeatureData | RawLayer | null,
  setSelectedLayer: React.Dispatch<React.SetStateAction<FeatureData | RawLayer | null>>,
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