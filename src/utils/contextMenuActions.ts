import type { Feature as GeoJSONFeature, FeatureCollection } from "geojson";
import type { MapWithPM, Layer } from "@/types";
import {
  getFeatureName,
  getFeatureBounds,
  formatCoordinates,
  copyToClipboard,
  findFeatureIndex,
  removeFeatureFromGeoJSON,
} from "@/utils/zoneOperations";
import { getMapDetail, updateLayerData, type MapDetail } from "@/lib/api-maps";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  feature: GeoJSONFeature | null;
  layerId: string | null;
  layerName: string | null;
  leafletLayer: Layer | null;
}

export interface CopyFeatureDialogState {
  isOpen: boolean;
  sourceLayerId: string;
  sourceLayerName: string;
  featureIndex: number;
  copyMode: "existing" | "new";
}

/**
 * Zoom map to fit the bounds of a feature
 */
export async function zoomToFitFeature(
  mapRef: React.MutableRefObject<MapWithPM | null>,
  feature: GeoJSONFeature | null
) {
  if (!mapRef.current || !feature) return;

  const bounds = getFeatureBounds(feature);
  if (bounds) {
    const L = (await import("leaflet")).default;
    const leafletBounds = L.latLngBounds(bounds);
    mapRef.current.fitBounds(leafletBounds, { padding: [50, 50] });
  }
}

/**
 * Copy feature coordinates to clipboard
 */
export async function copyFeatureCoordinates(
  feature: GeoJSONFeature | null,
  showToast: (type: "success" | "error" | "warning" | "info", message: string) => void
): Promise<boolean> {
  if (!feature) return false;

  const coordsText = formatCoordinates(feature);
  const success = await copyToClipboard(coordsText);

  if (success) {
    showToast("success", "📍 Coordinates copied to clipboard!");
  } else {
    showToast("error", "❌ Failed to copy coordinates");
  }

  return success;
}

/**
 * Open the copy feature dialog with the appropriate mode
 */
export function prepareCopyFeatureDialog(
  detail: MapDetail | null,
  contextMenu: ContextMenuState,
  copyMode: "existing" | "new",
  showToast: (type: "success" | "error" | "warning" | "info", message: string) => void
): CopyFeatureDialogState | null {
  if (!detail || !contextMenu.feature || !contextMenu.layerId) {
    return null;
  }

  const sourceLayerId = contextMenu.layerId;
  const sourceLayer = detail.layers.find(l => l.id === sourceLayerId);
  const sourceLayerName = sourceLayer?.layerName || 'Unknown Layer';

  const layerData = sourceLayer?.layerData as FeatureCollection || {};
  const featureIndex = findFeatureIndex(layerData, contextMenu.feature);

  if (featureIndex === -1) {
    showToast("error", "❌ Feature not found in layer");
    return null;
  }

  return {
    isOpen: true,
    sourceLayerId,
    sourceLayerName,
    featureIndex,
    copyMode
  };
}

/**
 * Delete a zone/feature from a data layer
 */
export async function deleteZoneFromLayer(
  detail: MapDetail | null,
  contextMenu: ContextMenuState,
  mapRef: React.MutableRefObject<MapWithPM | null>,
  showToast: (type: "success" | "error" | "warning" | "info", message: string) => void,
  onSuccess?: (updatedDetail: MapDetail) => void
): Promise<boolean> {
  if (!detail || !contextMenu.feature || !contextMenu.layerId) return false;

  const confirmed = window.confirm(
    `Are you sure you want to delete "${getFeatureName(contextMenu.feature)}"?`
  );
  if (!confirmed) return false;

  const layerId = contextMenu.layerId;
  const targetLayer = detail.layers.find(l => l.id === layerId);
  if (!targetLayer) {
    showToast("error", "❌ Layer not found");
    return false;
  }

  try {
    const layerData = targetLayer.layerData as FeatureCollection;
    const featureIndex = findFeatureIndex(layerData, contextMenu.feature);
    if (featureIndex === -1) {
      showToast("error", "❌ Feature not found in layer");
      return false;
    }

    const updatedGeoJSON = removeFeatureFromGeoJSON(layerData as FeatureCollection, featureIndex);
    const success = await updateLayerData(detail.id, layerId, updatedGeoJSON);

    if (success) {
      showToast("success", "✅ Zone deleted successfully!");

      // Remove layer from map
      if (contextMenu.leafletLayer && mapRef.current) {
        mapRef.current.removeLayer(contextMenu.leafletLayer);
      }

      // Reload map details
      const updatedDetail = await getMapDetail(detail.id);
      if (onSuccess) {
        onSuccess(updatedDetail);
      }
      return true;
    } else {
      showToast("error", "❌ Failed to delete zone");
      return false;
    }
  } catch (error) {
    console.error('Error deleting zone:', error);
    showToast("error", "❌ Error deleting zone");
    return false;
  }
}
