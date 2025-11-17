import { useCallback, useRef } from "react";
import type L from "leaflet";
import type { Layer, LayerStyle, PathLayer, MapWithPM } from "@/types";
import type { MapSelection } from "@/hooks/useMapCollaboration";
import { extractLayerStyle } from "@/utils/mapUtils";
import type { FeatureData } from "@/utils/mapUtils";

interface OtherUserSelection {
  selection: MapSelection;
  marker?: L.Marker;
  highlight?: Layer;
}

interface UseCollaborationVisualizationParams {
  mapRef: React.MutableRefObject<MapWithPM | null>;
  originalStylesRef: React.MutableRefObject<Map<Layer, LayerStyle>>;
  features: FeatureData[];
}

/**
 * Custom hook to manage visualization of other users' selections on the map
 */
export function useCollaborationVisualization({
  mapRef,
  originalStylesRef,
  features,
}: UseCollaborationVisualizationParams) {
  const otherUsersSelectionsRef = useRef<Map<string, OtherUserSelection>>(new Map());

  /**
   * Visualize another user's selection on the map
   */
  const visualizeOtherUserSelection = useCallback((selection: MapSelection) => {
    if (!mapRef.current) return;

    const existing = otherUsersSelectionsRef.current.get(selection.userId);

    // Remove existing visualization
    if (existing) {
      if (existing.marker && mapRef.current.hasLayer(existing.marker)) {
        mapRef.current.removeLayer(existing.marker);
      }
      if (existing.highlight && mapRef.current.hasLayer(existing.highlight)) {
        mapRef.current.removeLayer(existing.highlight);
      }
    }

    // Create new visualization based on selection type
    (async () => {
      const L = (await import("leaflet")).default;

      if (selection.selectionType === "Point" || selection.selectionType === "Marker") {
        if (selection.latitude && selection.longitude) {
          const marker = L.marker([selection.latitude, selection.longitude], {
            icon: L.divIcon({
              className: 'other-user-selection-marker',
              html: `<div style="
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: ${selection.highlightColor};
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            zIndexOffset: 1000,
          });
          marker.addTo(mapRef.current!);
          otherUsersSelectionsRef.current.set(selection.userId, { selection, marker });
        }
      } else if (selection.selectedObjectId) {
        // Try to find and highlight the selected feature/layer
        const currentFeatures = features; // Capture current features
        const feature = currentFeatures.find(f => f.featureId === selection.selectedObjectId || f.id === selection.selectedObjectId);
        if (feature && feature.layer && 'setStyle' in feature.layer) {
          const originalStyle = originalStylesRef.current.get(feature.layer) || extractLayerStyle(feature.layer);
          (feature.layer as unknown as PathLayer).setStyle({
            ...originalStyle,
            color: selection.highlightColor,
            weight: (typeof originalStyle.weight === 'number' ? originalStyle.weight : 3) + 2,
            fillColor: selection.highlightColor,
            fillOpacity: 0.3,
          });
          otherUsersSelectionsRef.current.set(selection.userId, { selection, highlight: feature.layer });
        }
      }
    })();
  }, [features, mapRef, originalStylesRef]);

  /**
   * Remove a user's selection visualization from the map
   */
  const removeUserSelectionVisualization = useCallback((userId: string) => {
    if (!mapRef.current) return;

    const existing = otherUsersSelectionsRef.current.get(userId);
    if (existing) {
      if (existing.marker && mapRef.current.hasLayer(existing.marker)) {
        mapRef.current.removeLayer(existing.marker);
      }
      if (existing.highlight && 'setStyle' in existing.highlight) {
        const originalStyle = originalStylesRef.current.get(existing.highlight);
        if (originalStyle) {
          (existing.highlight as unknown as PathLayer).setStyle(originalStyle);
        }
      }
      otherUsersSelectionsRef.current.delete(userId);
    }
  }, [mapRef, originalStylesRef]);

  return {
    otherUsersSelectionsRef,
    visualizeOtherUserSelection,
    removeUserSelectionVisualization,
  };
}
