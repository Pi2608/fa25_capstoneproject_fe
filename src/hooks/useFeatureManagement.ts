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
  sketch: L.FeatureGroup | null;
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
  sketch,
}: UseFeatureManagementParams) {
  const lastUpdateRef = useRef<Map<string, number>>(new Map());
  const recentlyCreatedFeatureIdsRef = useRef<Set<string>>(new Set());
  const recentlyCutFeatureIdsRef = useRef<Set<string>>(new Set());

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
        const savedFeature = await saveFeature(mapId, "", extLayer, features, setFeatures, sketch);

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
              // Ignore edit events for recently cut features (Geoman issue #826)
              if (recentlyCutFeatureIdsRef.current.has(savedFeature.featureId)) {
                console.log(`Ignoring edit event for recently cut feature ${savedFeature.featureId}`);
                return;
              }

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
   * Handle feature cut event
   * According to Geoman docs: "the cutted layer will be replaced, not updated"
   * We need to UPDATE the existing feature with the new geometry, not delete it
   */
  const handleFeatureCut = useCallback(
    async (e: {
      originalLayer: Layer;
      layer: Layer;
      layers?: Layer[];
    }) => {
      console.log("pm:cut event triggered", e);

      const originalExtLayer = e.originalLayer as ExtendedLayer;

      // Find the original feature that was cut
      const originalFeature = features.find((f) => f.layer === originalExtLayer);
      if (!originalFeature || !originalFeature.featureId) {
        console.warn("Original feature not found for cut operation");
        return;
      }

      try {
        // Mark this feature as recently cut to ignore subsequent pm:edit events
        // This solves the Geoman issue #826 where pm:edit fires after pm:cut
        recentlyCutFeatureIdsRef.current.add(originalFeature.featureId);
        setTimeout(() => {
          recentlyCutFeatureIdsRef.current.delete(originalFeature.featureId!);
        }, 2000);

        // Get the result layer(s) from the cut operation
        const resultLayer = e.layer as ExtendedLayer;
        const resultLayers = e.layers ? e.layers : [resultLayer];

        console.log(`Cut produced ${resultLayers.length} result layer(s)`);

        // MAIN RESULT: Update the original feature with the first result layer's geometry
        const mainResultLayer = resultLayers[0] as ExtendedLayer;

        // Update the feature's layer reference to point to the new layer
        const updatedFeature: FeatureData = {
          ...originalFeature,
          layer: mainResultLayer,
        };

        // Update in database with new geometry
        console.log(`Updating feature ${originalFeature.featureId} with cut geometry`);
        await updateFeatureInDB(mapId, originalFeature.featureId, updatedFeature);

        // Update in state
        setFeatures((prev) =>
          prev.map((f) =>
            f.featureId === originalFeature.featureId
              ? updatedFeature
              : f
          )
        );

        // Transfer event listeners and styling to the new layer
        storeOriginalStyle(mainResultLayer);

        mainResultLayer.on("mouseover", () => handleLayerHover(mainResultLayer, true));
        mainResultLayer.on("mouseout", () => handleLayerHover(mainResultLayer, false));
        mainResultLayer.on("click", (event: LeafletMouseEvent) => {
          if (event.originalEvent) {
            event.originalEvent.stopPropagation();
          }
          handleLayerClick(mainResultLayer, event.originalEvent.shiftKey);
        });

        // Attach edit/drag/rotate handlers to the new layer
        mainResultLayer.on("pm:edit", async () => {
          if (originalFeature.featureId) {
            if (recentlyCutFeatureIdsRef.current.has(originalFeature.featureId)) {
              return;
            }
            const now = Date.now();
            const lastUpdate = lastUpdateRef.current.get(originalFeature.featureId) || 0;
            if (now - lastUpdate < 1000) return;
            lastUpdateRef.current.set(originalFeature.featureId, now);
            try {
              resetToOriginalStyle(mainResultLayer);
              await updateFeatureInDB(mapId, originalFeature.featureId, updatedFeature);
            } catch (error) {
              console.error("Error updating feature after edit:", error);
            }
          }
        });

        mainResultLayer.on("pm:dragend", async () => {
          if (originalFeature.featureId) {
            const now = Date.now();
            const lastUpdate = lastUpdateRef.current.get(originalFeature.featureId) || 0;
            if (now - lastUpdate < 1000) return;
            lastUpdateRef.current.set(originalFeature.featureId, now);
            try {
              resetToOriginalStyle(mainResultLayer);
              await updateFeatureInDB(mapId, originalFeature.featureId, updatedFeature);
            } catch (error) {
              console.error("Error updating feature after drag:", error);
            }
          }
        });

        mainResultLayer.on("pm:rotateend", async () => {
          if (originalFeature.featureId) {
            const now = Date.now();
            const lastUpdate = lastUpdateRef.current.get(originalFeature.featureId) || 0;
            if (now - lastUpdate < 1000) return;
            lastUpdateRef.current.set(originalFeature.featureId, now);
            try {
              await updateFeatureInDB(mapId, originalFeature.featureId, updatedFeature);
            } catch (error) {
              console.error("Error updating feature after rotation:", error);
            }
          }
        });

        // Enable editing on the main result layer
        if ("pm" in mainResultLayer && mainResultLayer.pm) {
          (mainResultLayer as GeomanLayer).pm.enable({
            draggable: true,
            allowEditing: true,
            allowSelfIntersection: true,
          });
        }

        console.log(`Successfully updated feature ${originalFeature.featureId} after cut`);

        // ADDITIONAL RESULTS: If cut created multiple layers, save the rest as new features
        if (resultLayers.length > 1) {
          console.log(`Cut created ${resultLayers.length - 1} additional layer(s), saving as new features`);

          for (let i = 1; i < resultLayers.length; i++) {
            const additionalLayer = resultLayers[i] as ExtendedLayer;

            // Add to sketch if not already there
            if (sketch && !sketch.hasLayer(additionalLayer)) {
              sketch.addLayer(additionalLayer);
            }

            // Store style
            storeOriginalStyle(additionalLayer);

            // Attach hover and click listeners
            additionalLayer.on("mouseover", () => handleLayerHover(additionalLayer, true));
            additionalLayer.on("mouseout", () => handleLayerHover(additionalLayer, false));
            additionalLayer.on("click", (event: LeafletMouseEvent) => {
              if (event.originalEvent) {
                event.originalEvent.stopPropagation();
              }
              handleLayerClick(additionalLayer, event.originalEvent.shiftKey);
            });

            // Save as new feature to database
            try {
              const savedFeature = await saveFeature(
                mapId,
                originalFeature.layerId || "",
                additionalLayer,
                features,
                setFeatures,
                sketch || undefined
              );

              if (savedFeature?.featureId) {
                console.log(`Successfully saved additional cut feature with ID: ${savedFeature.featureId}`);

                // Track as recently created
                recentlyCreatedFeatureIdsRef.current.add(savedFeature.featureId);
                setTimeout(() => {
                  recentlyCreatedFeatureIdsRef.current.delete(savedFeature.featureId!);
                }, 5000);

                // Attach edit/drag/rotate handlers
                additionalLayer.on("pm:edit", async () => {
                  if (savedFeature.featureId) {
                    if (recentlyCutFeatureIdsRef.current.has(savedFeature.featureId)) {
                      return;
                    }
                    const now = Date.now();
                    const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
                    if (now - lastUpdate < 1000) return;
                    lastUpdateRef.current.set(savedFeature.featureId, now);
                    try {
                      resetToOriginalStyle(additionalLayer);
                      await updateFeatureInDB(mapId, savedFeature.featureId, savedFeature);
                    } catch (error) {
                      console.error("Error updating additional cut feature after edit:", error);
                    }
                  }
                });

                additionalLayer.on("pm:dragend", async () => {
                  if (savedFeature.featureId) {
                    const now = Date.now();
                    const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
                    if (now - lastUpdate < 1000) return;
                    lastUpdateRef.current.set(savedFeature.featureId, now);
                    try {
                      resetToOriginalStyle(additionalLayer);
                      await updateFeatureInDB(mapId, savedFeature.featureId, savedFeature);
                    } catch (error) {
                      console.error("Error updating additional cut feature after drag:", error);
                    }
                  }
                });

                additionalLayer.on("pm:rotateend", async () => {
                  if (savedFeature.featureId) {
                    const now = Date.now();
                    const lastUpdate = lastUpdateRef.current.get(savedFeature.featureId) || 0;
                    if (now - lastUpdate < 1000) return;
                    lastUpdateRef.current.set(savedFeature.featureId, now);
                    try {
                      await updateFeatureInDB(mapId, savedFeature.featureId, savedFeature);
                    } catch (error) {
                      console.error("Error updating additional cut feature after rotation:", error);
                    }
                  }
                });

                // Update visibility
                setFeatureVisibility((prev) => ({
                  ...prev,
                  [savedFeature.id]: true,
                  ...(savedFeature.featureId ? { [savedFeature.featureId]: true } : {}),
                }));

                // Enable editing
                if ("pm" in additionalLayer && additionalLayer.pm) {
                  (additionalLayer as GeomanLayer).pm.enable({
                    draggable: true,
                    allowEditing: true,
                    allowSelfIntersection: true,
                  });
                }
              }
            } catch (error) {
              console.error("Error saving additional cut feature:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error handling feature cut:", error);
      }
    },
    [
      features,
      mapId,
      setFeatures,
      setFeatureVisibility,
      storeOriginalStyle,
      handleLayerHover,
      handleLayerClick,
      resetToOriginalStyle,
      sketch,
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
        // Ignore edit events for recently cut features (Geoman issue #826)
        if (recentlyCutFeatureIdsRef.current.has(editedFeature.featureId)) {
          console.log(`Ignoring edit event for recently cut feature ${editedFeature.featureId}`);
          return;
        }

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
    handleFeatureCut,
    handleSketchEdit,
    handleSketchDragEnd,
    handleSketchRotateEnd,
  };
}
