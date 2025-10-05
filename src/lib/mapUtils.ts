import type { Map, Layer, FeatureGroup, LatLng, LatLngBounds } from "leaflet";
import type { Position } from "geojson";
import {
  addLayerToMap,
  updateMapLayer,
  removeLayerFromMap,
  createMapFeature,
  updateMapFeature,
  deleteMapFeature,
  type AddLayerToMapRequest,
  type UpdateMapLayerRequest,
  type CreateMapFeatureRequest,
  type UpdateMapFeatureRequest
} from "@/lib/api";

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

export interface LayerInfo {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  layer: Layer;
  order: number;
}

// Xác định type layer
export function getLayerType(layer: ExtendedLayer): string {
  if (layer.feature?.geometry?.type) {
    return layer.feature.geometry.type;
  }
  if (layer._mRadius !== undefined) return "Circle";
  if (layer._latlng !== undefined) return "Marker";
  if (layer._latlngs !== undefined) {
    const first = layer._latlngs[0];
    if (Array.isArray(first) && first.length > 2) return "Polygon";
    return "Polyline";
  }
  if (layer._bounds !== undefined) return "Rectangle";
  return "Unknown";
}

// Thêm layer vào danh sách quản lý
export function addLayerToList(
  prevLayers: LayerInfo[],
  layer: Layer | FeatureGroup
): LayerInfo[] {
  const newLayers: LayerInfo[] = [];

  if ("eachLayer" in layer && typeof (layer as FeatureGroup).eachLayer === "function") {
    const fg = layer as FeatureGroup;
    fg.eachLayer((subLayer: Layer) => {
      const sub = subLayer as ExtendedLayer;
      const props = sub.feature?.properties ?? {};
      const layerName =
        (typeof props.name === "string" && props.name) ||
        (typeof props.Name === "string" && props.Name) ||
        `Layer ${Date.now()}`;
      newLayers.push({
        id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: layerName,
        type: getLayerType(sub),
        visible: true,
        layer: subLayer,
        order: prevLayers.length + newLayers.length,
      });
    });
  } else {
    const l = layer as ExtendedLayer;
    const props = l.feature?.properties ?? {};
    const layerName =
      (typeof props.name === "string" && props.name) ||
      (typeof props.Name === "string" && props.Name) ||
      `Layer ${Date.now()}`;
    newLayers.push({
      id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: layerName,
      type: getLayerType(l),
      visible: true,
      layer,
      order: prevLayers.length,
    });
  }

  return [...prevLayers, ...newLayers];
}

// Xóa layer khỏi danh sách
export function removeLayerFromList(
  prevLayers: LayerInfo[],
  layerId: string,
  mapRef: Map | null,
  sketchRef: FeatureGroup | null
): LayerInfo[] {
  const layerInfo = prevLayers.find(l => l.id === layerId);
  if (layerInfo && mapRef && sketchRef) {
    sketchRef.removeLayer(layerInfo.layer);
  }
  return prevLayers.filter(l => l.id !== layerId);
}

// Toggle hiển thị layer
export function toggleLayerVisibility(
  prevLayers: LayerInfo[],
  layerId: string,
  mapRef: Map | null,
  sketchRef: FeatureGroup | null
): LayerInfo[] {
  return prevLayers.map(layerInfo => {
    if (layerInfo.id === layerId) {
      const newVisible = !layerInfo.visible;
      if (mapRef && sketchRef) {
        if (newVisible) {
          sketchRef.addLayer(layerInfo.layer);
        } else {
          sketchRef.removeLayer(layerInfo.layer);
        }
      }
      return { ...layerInfo, visible: newVisible };
    }
    return layerInfo;
  });
}

// Đổi tên layer
export function renameLayer(
  prevLayers: LayerInfo[],
  layerId: string,
  newName: string
): LayerInfo[] {
  return prevLayers.map(layerInfo =>
    layerInfo.id === layerId
      ? { ...layerInfo, name: newName.trim() || layerInfo.name }
      : layerInfo
  );
}

// Chuỗi hóa GeoJSON từ Layer
export function serializeLayer(layer: ExtendedLayer): string {
  // @ts-expect-error: ExtendedLayer may not declare toGeoJSON but Leaflet layers have it
  const geojson = layer.toGeoJSON?.() ?? {};
  return JSON.stringify(geojson);
}


// Đảm bảo map có ít nhất 1 layer, nếu chưa thì tạo
export async function ensureLayer(
  mapId: string,
  layers: LayerInfo[],
  setLayers: React.Dispatch<React.SetStateAction<LayerInfo[]>>
): Promise<string> {
  if (layers.length > 0) return layers[0].id;

  const req: AddLayerToMapRequest = {
    // layerId: crypto.randomUUID(),
    layerId: "11111111-1111-1111-1111-111111111111",
    isVisible: true,
    zIndex: 1000,
    customStyle: "{}",
    filterConfig: "{}"
  };

  const res = await addLayerToMap(mapId, req);
  setLayers(prev => [
    ...prev,
    {
      id: res.mapLayerId,
      name: "Default Layer",
      type: "default",
      visible: true,
      layer: {} as Layer, // placeholder
      order: prev.length
    }
  ]);
  return res.mapLayerId;
}

// Tạo feature từ Leaflet layer
export async function saveFeature(
  mapId: string,
  leafletLayer: ExtendedLayer,
  layers: LayerInfo[],
  setLayers: React.Dispatch<React.SetStateAction<LayerInfo[]>>
) {
  const layerId = await ensureLayer(mapId, layers, setLayers);

  let geometryType: CreateMapFeatureRequest["geometryType"] = "point";
  let coordinates = "[]";

  if (leafletLayer._latlng) {
    geometryType = "point";
    coordinates = JSON.stringify([leafletLayer._latlng.lng, leafletLayer._latlng.lat]);
  } else if (leafletLayer._latlngs) {
    if (Array.isArray(leafletLayer._latlngs[0])) {
      geometryType = "polygon";
      coordinates = JSON.stringify(
        (leafletLayer._latlngs[0] as LatLng[]).map(p => [p.lng, p.lat])
      );
    } else {
      geometryType = "linestring";
      coordinates = JSON.stringify(
        (leafletLayer._latlngs as LatLng[]).map(p => [p.lng, p.lat])
      );
    }
  }

  const req: CreateMapFeatureRequest = {
    layerId,
    name: "New Feature",
    description: "",
    featureCategory: "data",
    annotationType: "marker",
    geometryType,
    coordinates,
    properties: "{}",
    style: "{}",
    isVisible: true,
    zIndex: 0
  };

  return await createMapFeature(mapId, req);
}

// Update layer server-side
export async function syncUpdateLayer(mapId: string, layerId: string, newName: string) {
  const req: UpdateMapLayerRequest = {
    isVisible: true,
    zIndex: 1000,
    customStyle: JSON.stringify({ name: newName }),
    filterConfig: "{}"
  };
  return await updateMapLayer(mapId, layerId, req);
}

// Remove layer server-side
export async function syncRemoveLayer(mapId: string, layerId: string) {
  return await removeLayerFromMap(mapId, layerId);
}

// Update feature server-side
export async function syncUpdateFeature(mapId: string, featureId: string, data: UpdateMapFeatureRequest) {
  return await updateMapFeature(mapId, featureId, data);
}

// Remove feature server-side
export async function syncRemoveFeature(mapId: string, featureId: string) {
  return await deleteMapFeature(mapId, featureId);
}