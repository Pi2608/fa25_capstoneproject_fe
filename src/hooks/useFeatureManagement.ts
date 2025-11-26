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
import { updateMapFeature } from "@/lib/api-maps";
import type { FeatureGroup } from "leaflet";

interface UseFeatureManagementParams {
  mapId: string;
  features: FeatureData[];
  setFeatures: React.Dispatch<React.SetStateAction<FeatureData[]>>;
  setFeatureVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  storeOriginalStyle: (layer: Layer) => void;
  handleLayerHover: (layer: Layer | null, isEntering: boolean) => void;
  handleLayerClick: (layer: Layer, isShiftKey: boolean) => void;
  resetToOriginalStyle: (layer: Layer) => void;
  sketchRef: React.MutableRefObject<FeatureGroup | null>;
  rafThrottle: <T extends (...args: any[]) => any>(func: T) => (...args: Parameters<T>) => void;
  currentLayerId?: string | null; // Current selected layer ID for new features
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
  sketchRef,
  rafThrottle,
  currentLayerId = null,
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
        // Use currentLayerId if available, otherwise use empty string (no layer)
        const layerIdForFeature = currentLayerId || "";
        const savedFeature = await saveFeature(mapId, layerIdForFeature, extLayer, features, setFeatures, sketch);

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
      currentLayerId,
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

  /**
   * Handle polygon cut event (pm:cut)
   */
  const handlePolygonCut = useCallback(
    async (e: any) => {
      try {
        if (!mapId) return;

        const originalLayer = e.originalLayer;
        
        // Geoman pm:cut event can have either 'layer' (single) or 'layers' (multiple)
        let newLayers: any[] = [];
        if (e.layer) {
          // Single resulting layer
          newLayers = [e.layer];
        } else if (e.layers && Array.isArray(e.layers)) {
          // Multiple resulting layers
          newLayers = e.layers;
        }

        console.log("pm:cut event received:", { 
          originalLayer, 
          newLayersCount: newLayers.length,
          eventKeys: Object.keys(e),
          hasLayer: !!e.layer,
          hasLayers: !!e.layers
        });

        if (!originalLayer || newLayers.length === 0) {
          console.warn("Invalid pm:cut event data:", e);
          return;
        }

        // Find the original feature from the originalLayer using current features state
        const originalFeature = features.find((f) => f.layer === originalLayer);

        if (!originalFeature || !originalFeature.featureId) {
          console.warn("Original feature not found for cut operation. Available features:", features.length);
          return;
        }

        const originalFeatureId = originalFeature.featureId;

        // Update the first new layer with the original featureId
        const firstNewLayer = newLayers[0] as ExtendedLayer;
        if (firstNewLayer) {
          // Wait a bit for Leaflet to fully initialize the new layer
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Get coordinates using toGeoJSON() which is more reliable
          let newCoordinates: string | null = null;
          if (typeof (firstNewLayer as any).toGeoJSON === "function") {
            try {
              const geoJSON = (firstNewLayer as any).toGeoJSON();
              console.log("Polygon cut - toGeoJSON result:", geoJSON);
              if (geoJSON && geoJSON.geometry && geoJSON.geometry.coordinates) {
                newCoordinates = JSON.stringify(geoJSON.geometry.coordinates);
              }
            } catch (err) {
              console.warn("Error getting GeoJSON from new layer:", err);
            }
          }
          
          // Fallback: try getLatLngs()
          if (!newCoordinates && typeof (firstNewLayer as any).getLatLngs === "function") {
            try {
              const latlngs = (firstNewLayer as any).getLatLngs();
              console.log("Polygon cut - getLatLngs result:", latlngs);
              if (latlngs && Array.isArray(latlngs) && latlngs[0]) {
                // Convert LatLng array to coordinates array [lng, lat]
                const coords = latlngs[0].map((ll: any) => [ll.lng, ll.lat]);
                newCoordinates = JSON.stringify([coords]);
                // Also update _latlngs
                (firstNewLayer as any)._latlngs = latlngs;
              }
            } catch (err) {
              console.warn("Error getting LatLngs from new layer:", err);
            }
          }
          
          // Create updated feature with new layer
          const updatedFeature: FeatureData = {
            ...originalFeature,
            layer: firstNewLayer,
          };

          // Store original style for the new layer
          storeOriginalStyle(firstNewLayer);

          // If we got new coordinates, update directly with them
          if (newCoordinates) {
            // Call API directly with new coordinates
            const layerStyle = extractLayerStyle(firstNewLayer);
            const body = {
              name: originalFeature.name,
              description: "",
              featureCategory: "Data" as const,
              annotationType: "Highlighter" as const,
              geometryType: "Polygon" as const,
              coordinates: newCoordinates,
              properties: "{}",
              style: JSON.stringify(layerStyle),
              isVisible: originalFeature.isVisible,
              zIndex: 0,
              layerId: null,
            };
            
            await updateMapFeature(mapId, originalFeatureId, body);
          } else {
            // Fallback to updateFeatureInDB (which uses serializeFeature)
            console.warn("Polygon cut - no new coordinates found, using serializeFeature");
            await updateFeatureInDB(mapId, originalFeatureId, updatedFeature);
          }

          // Reset to original style to remove selection styling (orange color)
          resetToOriginalStyle(firstNewLayer);

          // Update local state for first layer
          setFeatures((prev) =>
            prev.map((f) => (f.featureId === originalFeatureId ? updatedFeature : f))
          );
        }

        // Create new features for remaining layers (if any)
        if (newLayers.length > 1) {
          for (let i = 1; i < newLayers.length; i++) {
            const newLayer = newLayers[i] as ExtendedLayer;
            const saved = await saveFeature(
              mapId,
              "",
              newLayer,
              features,
              setFeatures,
              sketchRef.current || undefined
            );

            if (saved && saved.featureId) {
              // Attach event listeners to the new feature
              storeOriginalStyle(newLayer);
              
              // Reset to original style to remove any selection styling
              resetToOriginalStyle(newLayer);
              
              const hoverOverHandler = rafThrottle(() => handleLayerHover(newLayer, true));
              const hoverOutHandler = rafThrottle(() => handleLayerHover(newLayer, false));
              newLayer.on("mouseover", hoverOverHandler);
              newLayer.on("mouseout", hoverOutHandler);
              newLayer.on("click", (event: LeafletMouseEvent) => {
                if (event.originalEvent) {
                  event.originalEvent.stopPropagation();
                }
                handleLayerClick(newLayer, event.originalEvent.shiftKey);
              });

              if ("pm" in newLayer && (newLayer as GeomanLayer).pm) {
                (newLayer as GeomanLayer).pm.enable({
                  draggable: true,
                  allowEditing: true,
                  allowSelfIntersection: true,
                });

                newLayer.on("pm:edit", async () => {
                  const now = Date.now();
                  const lastUpdate = lastUpdateRef.current.get(saved.featureId!) || 0;
                  if (now - lastUpdate < 1000) return;
                  lastUpdateRef.current.set(saved.featureId!, now);
                  try {
                    resetToOriginalStyle(newLayer);
                    setFeatures((currentFeatures) => {
                      const featureData =
                        currentFeatures.find((f) => f.featureId === saved.featureId) || saved;
                      updateFeatureInDB(mapId, saved.featureId!, featureData).catch((err) => {
                        console.error("Error updating feature after edit:", err);
                      });
                      return currentFeatures;
                    });
                  } catch (error) {
                    console.error("Error updating feature after edit:", error);
                  }
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error handling polygon cut:", error);
      }
    },
    [
      mapId,
      features,
      setFeatures,
      storeOriginalStyle,
      handleLayerHover,
      handleLayerClick,
      resetToOriginalStyle,
      sketchRef,
      rafThrottle,
    ]
  );

  return {
    lastUpdateRef,
    recentlyCreatedFeatureIdsRef,
    handleFeatureCreate,
    handleSketchEdit,
    handleSketchDragEnd,
    handleSketchRotateEnd,
    handlePolygonCut,
  };
}
