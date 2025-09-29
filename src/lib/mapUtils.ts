import type { Map, Layer, FeatureGroup, LatLng, LatLngBounds } from "leaflet";
import type { Position } from "geojson";

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