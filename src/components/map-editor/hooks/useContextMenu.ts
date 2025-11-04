"use client";

import { useState, useEffect, useCallback } from "react";
import type { ZoneContextMenuDetail } from "../types/mapTypes";
import { getFeatureName, getFeatureBounds, formatCoordinates, copyToClipboard, findFeatureIndex, removeFeatureFromGeoJSON } from "@/utils/zoneOperations";
import { copyZoneToLayer, getMapDetail, MapDetail, updateLayerData } from "@/lib/api-maps";

export function useContextMenu(
  detail: MapDetail | null,
  mapRef: React.RefObject<any>,
  showToast: (type: "success" | "error", message: string) => void,
  setDetail: (detail: MapDetail) => void
) {
  const [contextMenu, setContextMenu] = useState<ZoneContextMenuDetail>({
    visible: false,
    x: 0,
    y: 0,
    feature: null,
    layerId: null,
    layerName: null,
    leafletLayer: null
  });

  useEffect(() => {
    const handleZoneContextMenu = (e: Event) => {
      const customEvent = e as CustomEvent<ZoneContextMenuDetail>;
      const { feature, layerId, layerName, x, y, leafletLayer } = customEvent.detail;

      setContextMenu({
        visible: true,
        x,
        y,
        feature,
        layerId,
        layerName,
        leafletLayer
      });
    };

    window.addEventListener('zone-contextmenu', handleZoneContextMenu);

    return () => {
      window.removeEventListener('zone-contextmenu', handleZoneContextMenu);
    };
  }, []);

  const handleZoomToFit = useCallback(async () => {
    if (!mapRef.current || !contextMenu.feature) return;

    const bounds = getFeatureBounds(contextMenu.feature);
    if (bounds) {
      const L = (await import("leaflet")).default;
      const leafletBounds = L.latLngBounds(bounds);
      mapRef.current.fitBounds(leafletBounds, { padding: [50, 50] });
    }
  }, [contextMenu.feature, mapRef]);

  const handleCopyCoordinates = useCallback(async () => {
    if (!contextMenu.feature) return;

    const coordsText = formatCoordinates(contextMenu.feature);
    const success = await copyToClipboard(coordsText);

    if (success) {
      showToast("success", "📍 Coordinates copied to clipboard!");
    } else {
      showToast("error", "❌ Failed to copy coordinates");
    }
  }, [contextMenu.feature, showToast]);

  const handleLayerSelected = useCallback(async (targetLayerId: string) => {
    if (!detail || !contextMenu.feature || !contextMenu.layerId) return;

    const sourceLayerId = contextMenu.layerId;
    const sourceLayer = detail.layers.find(l => l.id === sourceLayerId);
    
    if (!sourceLayer) {
      showToast("error", "❌ Source layer not found");
      return;
    }

    try {
      const layerData = JSON.parse(sourceLayer.layerData);
      const featureIndex = findFeatureIndex(layerData, contextMenu.feature);

      if (featureIndex === -1) {
        showToast("error", "❌ Feature not found in layer");
        return;
      }

      const success = await copyZoneToLayer(detail.id, sourceLayerId, targetLayerId, featureIndex);

      if (success) {
        showToast("success", "✅ Zone copied to layer successfully!");
        const updatedDetail = await getMapDetail(detail.id);
        setDetail(updatedDetail);
      } else {
        showToast("error", "❌ Failed to copy zone to layer");
      }
    } catch (error) {
      console.error('Error copying zone:', error);
      showToast("error", "❌ Error copying zone");
    }
  }, [detail, contextMenu, showToast, setDetail]);

  const handleDeleteZone = useCallback(async () => {
    if (!detail || !contextMenu.feature || !contextMenu.layerId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${getFeatureName(contextMenu.feature)}"?`
    );

    if (!confirmed) return;

    const layerId = contextMenu.layerId;
    const targetLayer = detail.layers.find(l => l.id === layerId);

    if (!targetLayer) {
      showToast("error", "❌ Layer not found");
      return;
    }

    try {
      const layerData = JSON.parse(targetLayer.layerData);
      const featureIndex = findFeatureIndex(layerData, contextMenu.feature);

      if (featureIndex === -1) {
        showToast("error", "❌ Feature not found in layer");
        return;
      }

      const updatedGeoJSON = removeFeatureFromGeoJSON(layerData, featureIndex);
      const success = await updateLayerData(detail.id, layerId, updatedGeoJSON);

      if (success) {
        showToast("success", "✅ Zone deleted successfully!");

        if (contextMenu.leafletLayer && mapRef.current) {
          mapRef.current.removeLayer(contextMenu.leafletLayer);
        }

        const updatedDetail = await getMapDetail(detail.id);
        setDetail(updatedDetail);
      } else {
        showToast("error", "❌ Failed to delete zone");
      }
    } catch (error) {
      console.error('Error deleting zone:', error);
      showToast("error", "❌ Error deleting zone");
    }
  }, [detail, contextMenu, showToast, mapRef, setDetail]);

  return {
    contextMenu,
    setContextMenu,
    handleZoomToFit,
    handleCopyCoordinates,
    handleLayerSelected,
    handleDeleteZone
  };
}
