import type { Layer, LatLng, LatLngBounds, FeatureGroup, Map as LMap } from "leaflet";
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

    const body: CreateMapFeatureRequest = {
      layerId: layerId || null, // Allow null layerId for standalone features
      name: `${type}`,
      description: "",
      featureCategory: "Annotation",
      annotationType: annotationType,
      geometryType: geometryType,
      coordinates,
      properties: JSON.stringify({}),
      style: JSON.stringify({}),
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

    const body: UpdateMapFeatureRequest = {
      name: feature.name,
      description: "",
      featureCategory: "Annotation",
      annotationType: annotationType,
      geometryType: geometryType,
      coordinates,
      properties: JSON.stringify({}),
      style: JSON.stringify({}),
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
      console.log("layer", layer);
      if (layer) {
        const isVisible = feature.isVisible;

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
        const geoJsonLayer = L.geoJSON(layerData, {
          style: layer.layerStyle ? JSON.parse(layer.layerStyle) : undefined,
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
        const geoJsonLayer = L.geoJSON(layerData, {
          style: layer.layerStyle ? JSON.parse(layer.layerStyle) : undefined,
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
        const geoJsonLayer = L.geoJSON(layerData, {
          style: layer.layerStyle ? JSON.parse(layer.layerStyle) : undefined,
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
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>
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
  sketchGroup?: FeatureGroup | null
): Promise<void> {
  try {
    const { updateMapFeature } = await import("@/lib/api");
    console.log("mapId", mapId, "featureId", featureId, "isVisible", isVisible);
    await updateMapFeature(mapId, featureId, { isVisible });
    
    // Update local state
    setFeatures(prev => toggleFeatureVisibilityLocal(prev, featureId, map, sketchGroup));
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
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>
): Promise<void> {
  if (!map) return;
  
  try {
    await updateLayerStyle(mapId, layerId, updates, map, layers, dataLayerRefs);
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
  }
): Promise<void> {
  try {
    await updateFeatureStyle(mapId, featureId, updates);
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
  sketchGroup?: FeatureGroup | null
): Promise<void> {
  try {
    await deleteFeatureFromDB(mapId, featureId);
    console.log("Delete featureId", featureId);
    setFeatures(prev => removeFeatureFromList(prev, featureId, map, sketchGroup));
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