import { useCallback, useRef } from "react";
import type L from "leaflet";
import type { Layer, LeafletMouseEvent, PMCreateEvent, ExtendedLayer, GeomanLayer } from "@/types";
import type { FeatureData } from "@/utils/mapUtils";
import {
  serializeFeature,
  extractLayerStyle,
  getFeatureType as getFeatureTypeUtil,
  saveFeature,
  updateFeatureInDB,
} from "@/utils/mapUtils";

interface UseFeatureManagementParams {
  mapId: string;
  features: FeatureData[];
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>;
  setFeatureVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  storeOriginalStyle: (layer: Layer) => void;
  handleLayerHover: (layer: Layer | null, isEntering: boolean) => void;
  handleLayerClick: (layer: Layer, isShiftKey: boolean) => void;
  resetToOriginalStyle: (layer: Layer) => void;
}

/**
 * Custom hook to manage feature creation, editing, and lifecycle
 */
export function useFeatureManagement({
  mapId,
  features,
  setFeatures,
  setFeatureVisibility,
  storeOriginalStyle,
  handleLayerHover,
  handleLayerClick,
  resetToOriginalStyle,
}: UseFeatureManagementParams) {
  const lastUpdateRef = useRef<Map<string, number>>(new Map());
  const recentlyCreatedFeatureIdsRef = useRef<Set<string>>(new Set());

  /**
   * Handle feature creation from Geoman pm:create event
   */
  const handleFeatureCreate = useCallback(
    async (
      e: PMCreateEvent,
      customMarkerIcon: L.Icon | L.DivIcon | null,
      LModule: typeof L,
      sketch: L.FeatureGroup
    ) => {
      const extLayer = e.layer as ExtendedLayer;
      sketch.addLayer(e.layer);

      // Apply custom marker icon for markers
      if (extLayer instanceof LModule.Marker && customMarkerIcon) {
        extLayer.setIcon(customMarkerIcon);
      }

      // Store original style
      storeOriginalStyle(e.layer);

      // Attach hover and click event listeners
      e.layer.on("mouseover", () => handleLayerHover(e.layer, true));
      e.layer.on("mouseout", () => handleLayerHover(e.layer, false));
      e.layer.on("click", (event: LeafletMouseEvent) => {
        // Stop propagation to prevent base layer click from firing
        if (event.originalEvent) {
          event.originalEvent.stopPropagation();
        }
        handleLayerClick(e.layer, event.originalEvent.shiftKey);
      });

      const type = getFeatureTypeUtil(extLayer);
      const localId = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newFeature: FeatureData = {
        id: localId,
        name: `${type} ${features.length + 1}`,
        type,
        layer: extLayer,
        isVisible: true,
      };

      // Save to database
      try {
        const savedFeature = await saveFeature(mapId, "", extLayer, features, setFeatures);

        if (savedFeature?.featureId) {
          // Track this feature as recently created by current user IMMEDIATELY
          // This must happen before SignalR event can arrive to prevent race condition
          const featureId = savedFeature.featureId;
          recentlyCreatedFeatureIdsRef.current.add(featureId);

          // Remove from tracking after 5 seconds (enough time for SignalR event to arrive)
          setTimeout(() => {
            recentlyCreatedFeatureIdsRef.current.delete(featureId);
          }, 5000);
        }

        if (savedFeature) {
          // Attach edit/drag/rotate event listeners for the saved feature
          e.layer.on("pm:edit", async () => {
            if (savedFeature.featureId) {
              const now = Date.now();
              const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
              if (now - lastUpdate < 1000) return;
              lastUpdateRef.current.set(savedFeature.featureId, now);

              try {
                // Reset to original style first to remove selection styling
                resetToOriginalStyle(e.layer);
                await updateFeatureInDB(mapId, savedFeature.featureId, savedFeature);
              } catch (error) {
                console.error("Error updating feature after edit:", error);
              }
            }
          });

          e.layer.on("pm:dragend", async () => {
            if (savedFeature.featureId) {
              const now = Date.now();
              const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
              if (now - lastUpdate < 1000) return;
              lastUpdateRef.current.set(savedFeature.featureId, now);

              try {
                resetToOriginalStyle(e.layer);
                await updateFeatureInDB(mapId, savedFeature.featureId, savedFeature);
              } catch (error) {
                console.error("Error updating feature after drag:", error);
              }
            }
          });

          e.layer.on("pm:rotateend", async () => {
            if (savedFeature.featureId) {
              const now = Date.now();
              const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
              if (now - lastUpdate < 1000) return;
              lastUpdateRef.current.set(savedFeature.featureId, now);

              try {
                await updateFeatureInDB(mapId, savedFeature.featureId, savedFeature);
              } catch (error) {
                console.error("Error updating feature after rotation:", error);
              }
            }
          });

          // Update visibility for the saved feature
          setFeatureVisibility((prev) => ({
            ...prev,
            [savedFeature.id]: true,
            ...(savedFeature.featureId ? { [savedFeature.featureId]: true } : {}),
          }));
        } else {
          setFeatures((prev) => [...prev, newFeature]);
          setFeatureVisibility((prev) => ({
            ...prev,
            [newFeature.id]: true,
          }));
        }
      } catch (error) {
        console.error("Error saving to database:", error);
        // Only add to features if save failed
        setFeatures((prev) => [...prev, newFeature]);
        setFeatureVisibility((prev) => ({
          ...prev,
          [newFeature.id]: true,
        }));
      }

      // Enable dragging and editing via Geoman
      if ("pm" in e.layer && e.layer.pm) {
        (e.layer as GeomanLayer).pm.enable({
          draggable: true,
          allowEditing: true,
          allowSelfIntersection: true,
        });
      }
    },
    [
      mapId,
      features,
      setFeatures,
      setFeatureVisibility,
      storeOriginalStyle,
      handleLayerHover,
      handleLayerClick,
      resetToOriginalStyle,
    ]
  );

  /**
   * Handle sketch-level edit event
   */
  const handleSketchEdit = useCallback(
    async (e: { layer: Layer; shape: string }) => {
      const extLayer = e.layer as ExtendedLayer;

      const editedFeature = features.find((f) => f.layer === extLayer);
      if (editedFeature && editedFeature.featureId) {
        const now = Date.now();
        const lastUpdate = lastUpdateRef.current.get(editedFeature.featureId) || 0;
        if (now - lastUpdate < 1000) return; // Skip if updated less than 1 second ago
        lastUpdateRef.current.set(editedFeature.featureId, now);

        try {
          await updateFeatureInDB(mapId, editedFeature.featureId, editedFeature);

          setFeatures((prev) =>
            prev.map((f) =>
              f.id === editedFeature.id || f.featureId === editedFeature.featureId
                ? { ...f, layer: extLayer }
                : f
            )
          );
        } catch (error) {
          console.error("Error updating feature:", error);
        }
      }
    },
    [features, mapId, setFeatures]
  );

  /**
   * Handle sketch-level dragend event
   */
  const handleSketchDragEnd = useCallback(
    async (e: { layer: Layer; shape: string }) => {
      const extLayer = e.layer as ExtendedLayer;

      const draggedFeature = features.find((f) => f.layer === extLayer);
      if (draggedFeature && draggedFeature.featureId) {
        const now = Date.now();
        const lastUpdate = lastUpdateRef.current.get(draggedFeature.featureId) || 0;
        if (now - lastUpdate < 1000) return; // Skip if updated less than 1 second ago
        lastUpdateRef.current.set(draggedFeature.featureId, now);

        try {
          await updateFeatureInDB(mapId, draggedFeature.featureId, draggedFeature);

          setFeatures((prev) =>
            prev.map((f) =>
              f.id === draggedFeature.id || f.featureId === draggedFeature.featureId
                ? { ...f, layer: extLayer }
                : f
            )
          );
        } catch (error) {
          console.error("Error updating feature after drag:", error);
        }
      }
      resetToOriginalStyle(e.layer);
    },
    [features, mapId, setFeatures, resetToOriginalStyle]
  );

  /**
   * Handle sketch-level rotateend event
   */
  const handleSketchRotateEnd = useCallback(
    async (e: { layer: Layer }) => {
      const extLayer = e.layer as ExtendedLayer;

      const rotatedFeature = features.find((f) => f.layer === extLayer);
      if (rotatedFeature && rotatedFeature.featureId) {
        const now = Date.now();
        const lastUpdate = lastUpdateRef.current.get(rotatedFeature.featureId) || 0;
        if (now - lastUpdate < 1000) return; // Skip if updated less than 1 second ago
        lastUpdateRef.current.set(rotatedFeature.featureId, now);

        try {
          await updateFeatureInDB(mapId, rotatedFeature.featureId, rotatedFeature);

          setFeatures((prev) =>
            prev.map((f) =>
              f.id === rotatedFeature.id || f.featureId === rotatedFeature.featureId
                ? { ...f, layer: extLayer }
                : f
            )
          );
        } catch (error) {
          console.error("Error updating feature after rotation:", error);
        }
      }
    },
    [features, mapId, setFeatures]
  );

  return {
    lastUpdateRef,
    recentlyCreatedFeatureIdsRef,
    handleFeatureCreate,
    handleSketchEdit,
    handleSketchDragEnd,
    handleSketchRotateEnd,
  };
}
