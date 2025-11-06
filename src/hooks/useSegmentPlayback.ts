import { useState, useEffect, useCallback } from "react";
import { Segment } from "@/lib/api-storymap";

type UseSegmentPlaybackProps = {
  segments: Segment[];
  currentMap: any;
  currentSegmentLayers: any[];
  setCurrentSegmentLayers: (layers: any[]) => void;
  setActiveSegmentId: (id: string | null) => void;
  onSegmentSelect?: (segment: Segment) => void;
};

export function useSegmentPlayback({
  segments,
  currentMap,
  currentSegmentLayers,
  setCurrentSegmentLayers,
  setActiveSegmentId,
  onSegmentSelect,
}: UseSegmentPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);

  // ==================== VIEW SEGMENT ON MAP ====================
  const handleViewSegment = useCallback(async (segment: Segment) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available");
      return;
    }

    try {
      const L = (await import("leaflet")).default;

      // Clear previous layers
      currentSegmentLayers.forEach(layer => {
        try {
          currentMap.removeLayer(layer);
        } catch (e) {
          console.warn("Failed to remove layer:", e);
        }
      });
      
      const newLayers: any[] = [];
      const allBounds: any[] = [];
      
      setCurrentSegmentLayers(newLayers);

      // ==================== RENDER ZONES ====================
      if (segment.zones && segment.zones.length > 0) {
        for (const segmentZone of segment.zones) {
          const zone = segmentZone.zone;
          if (!zone) continue;

          if (!zone.geometry || zone.geometry.trim() === '') {
            console.warn(`⚠️ Zone ${zone.zoneId} has no geometry`);
            continue;
          }

          try {
            let geoJsonData;
            try {
              geoJsonData = JSON.parse(zone.geometry);
            } catch (parseError) {
              continue;
            }

            const geoJsonLayer = L.geoJSON(geoJsonData, {
              style: () => {
                const style: any = {};
                
                if (segmentZone.fillZone) {
                  style.fillColor = segmentZone.fillColor || '#FFD700';
                  style.fillOpacity = segmentZone.fillOpacity || 0.3;
                } else {
                  style.fillOpacity = 0;
                }

                if (segmentZone.highlightBoundary) {
                  style.color = segmentZone.boundaryColor || '#FFD700';
                  style.weight = segmentZone.boundaryWidth || 2;
                } else {
                  style.weight = 0;
                }

                return style;
              },
            });

            geoJsonLayer.addTo(currentMap);
            newLayers.push(geoJsonLayer);

            const layerBounds = geoJsonLayer.getBounds();
            if (layerBounds.isValid()) {
              allBounds.push(layerBounds);
            }

            // Add label if enabled
            if (segmentZone.showLabel) {
              try {
                let labelPosition;
                
                if (zone.centroid) {
                  const centroid = JSON.parse(zone.centroid);
                  labelPosition = [centroid.coordinates[1], centroid.coordinates[0]];
                } else {
                  const center = layerBounds.getCenter();
                  labelPosition = [center.lat, center.lng];
                }

                const labelMarker = L.marker(labelPosition as [number, number], {
                  icon: L.divIcon({
                    className: 'zone-label',
                    html: `<div style="
                      background: rgba(0, 0, 0, 0.7);
                      color: white;
                      padding: 4px 8px;
                      border-radius: 4px;
                      font-size: 14px;
                      font-weight: 500;
                      white-space: nowrap;
                      border: 2px solid rgba(255, 255, 255, 0.8);
                    ">${segmentZone.labelOverride || zone.name}</div>`,
                    iconSize: undefined,
                  }),
                });
                labelMarker.addTo(currentMap);
                newLayers.push(labelMarker);
              } catch (labelError) {
                console.error(`Failed to add label for zone ${zone.zoneId}:`, labelError);
              }
            }
          } catch (error) {
            console.error(`❌ Failed to render zone ${zone.zoneId}:`, error);
          }
        }
      }

      // ==================== RENDER LOCATIONS ====================
      if (segment.locations && segment.locations.length > 0) {
        for (const location of segment.locations) {
          try {
            if (location.isVisible === false) {
              continue;
            }

            if (!location.markerGeometry) {
              console.warn(`⚠️ Location ${location.poiId || location.locationId} has no geometry`);
              continue;
            }

            let geoJsonData;
            try {
              geoJsonData = JSON.parse(location.markerGeometry);
            } catch (parseError) {
              console.error(`❌ Failed to parse geometry for location ${location.poiId || location.locationId}:`, parseError);
              continue;
            }

            const coords = geoJsonData.coordinates;
            const latLng: [number, number] = [coords[1], coords[0]];

            const iconHtml = `<div style="
              font-size: ${location.iconSize || 32}px;
              text-align: center;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
              color: ${location.iconColor || '#FF0000'};
            ">${location.iconType || '📍'}</div>`;

            const marker = L.marker(latLng, {
              icon: L.divIcon({
                className: 'location-marker',
                html: iconHtml,
                iconSize: [location.iconSize || 32, location.iconSize || 32],
                iconAnchor: [(location.iconSize || 32) / 2, location.iconSize || 32],
              }),
              zIndexOffset: location.zIndex || 100,
            });

            if (location.showTooltip && location.tooltipContent) {
              marker.bindTooltip(location.tooltipContent, {
                permanent: false,
                direction: 'top',
                className: 'location-tooltip',
                opacity: 0.95,
              });
            }

            if (location.openPopupOnClick && location.popupContent) {
              const popupHtml = `
                <div style="min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${location.title}</h3>
                  ${location.subtitle ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">${location.subtitle}</p>` : ''}
                  <p style="margin: 0; font-size: 14px;">${location.popupContent}</p>
                </div>
              `;
              marker.bindPopup(popupHtml);
            }

            marker.addTo(currentMap);
            newLayers.push(marker);
            
            allBounds.push(L.latLngBounds([latLng, latLng]));
          } catch (error) {
            console.error(`❌ Failed to render location ${location.poiId || location.locationId}:`, error);
          }
        }

        console.log(`✅ Rendered ${segment.locations.length} locations`);
      }

      // ==================== CAMERA STATE ====================
      if (segment.cameraState) {
        let parsedCamera;
        if (typeof segment.cameraState === 'string') {
          try {
            parsedCamera = JSON.parse(segment.cameraState);
          } catch (e) {
            console.error("❌ Failed to parse camera state:", e);
            return;
          }
        } else {
          parsedCamera = segment.cameraState;
        }
        
        if (!parsedCamera || !parsedCamera.center || !Array.isArray(parsedCamera.center) || parsedCamera.center.length < 2) {
          console.error("❌ Invalid camera state structure:", parsedCamera);
          return;
        }
        
        const currentZoom = currentMap.getZoom();
        const targetZoom = parsedCamera.zoom || 10;
        const targetCenter = parsedCamera.center;
        
        // Zoom transition effect
        if (Math.abs(currentZoom - targetZoom) > 1 || currentSegmentLayers.length > 0) {
          const midZoom = Math.min(currentZoom, targetZoom) - 2;
          
          currentMap.flyTo(
            [targetCenter[1], targetCenter[0]],
            midZoom,
            {
              duration: 0.8,
              animate: true,
            }
          );
          
          setTimeout(() => {
            currentMap.flyTo(
              [targetCenter[1], targetCenter[0]],
              targetZoom,
              {
                duration: 1.2,
                animate: true,
              }
            );
          }, 800);
        } else {
          currentMap.flyTo(
            [targetCenter[1], targetCenter[0]],
            targetZoom,
            {
              duration: 1.5,
              animate: true,
            }
          );
        }
      } else if (allBounds.length > 0) {
        // Auto-fit bounds if no camera state
        try {
          const combinedBounds = allBounds[0];
          for (let i = 1; i < allBounds.length; i++) {
            combinedBounds.extend(allBounds[i]);
          }
          
          currentMap.fitBounds(combinedBounds, {
            padding: [80, 80],
            animate: true,
            duration: 1.5,
            maxZoom: 15,
          });
          console.log(`📦 Auto-fitted bounds to show ${allBounds.length} elements (no camera state)`);
        } catch (error) {
          console.error("❌ Failed to fit bounds:", error);
        }
      } else {
        console.warn("⚠️ Empty segment: no camera state and no zones/locations");
      }

      if (newLayers.length > 0) {
        setCurrentSegmentLayers(newLayers);
      }
    } catch (error) {
      console.error("❌ Failed to view segment on map:", error);
    }
  }, [currentMap, currentSegmentLayers, setCurrentSegmentLayers]);

  // ==================== AUTO-PLAY EFFECT ====================
  useEffect(() => {
    if (!isPlaying || segments.length === 0) return;

    let timeoutId: NodeJS.Timeout;

    const playNextSegment = async () => {
      if (currentPlayIndex >= segments.length) {
        setIsPlaying(false);
        setCurrentPlayIndex(0);
        return;
      }

      const segment = segments[currentPlayIndex];
      setActiveSegmentId(segment.segmentId);
      await handleViewSegment(segment);
      onSegmentSelect?.(segment);
      
      const duration = segment.durationMs || 5000;
      timeoutId = setTimeout(() => {
        setCurrentPlayIndex(prev => prev + 1);
      }, duration);
    };

    playNextSegment();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentPlayIndex, segments.length]);

  // ==================== PLAYBACK CONTROLS ====================
  const handlePlayPreview = () => {
    if (segments.length === 0) return;
    setCurrentPlayIndex(0);
    setIsPlaying(true);
  };

  const handleStopPreview = () => {
    setIsPlaying(false);
    setCurrentPlayIndex(0);
  };

  const handleClearMap = () => {
    if (!currentMap) return;
    
    console.log(`🧹 Clearing ${currentSegmentLayers.length} layers from map...`);
    currentSegmentLayers.forEach(layer => {
      try {
        currentMap.removeLayer(layer);
      } catch (e) {
        console.warn("Failed to remove layer:", e);
      }
    });
    
    setCurrentSegmentLayers([]);
    setActiveSegmentId(null);
    console.log("✅ Map cleared");
  };

  return {
    isPlaying,
    currentPlayIndex,
    handleViewSegment,
    handlePlayPreview,
    handleStopPreview,
    handleClearMap,
  };
}
