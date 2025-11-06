import { useState, useEffect, useCallback } from "react";
import { Segment, TimelineTransition } from "@/lib/api-storymap";
import { getTimelineTransitions } from "@/lib/api-storymap";

type UseSegmentPlaybackProps = {
  mapId: string;
  segments: Segment[];
  currentMap: any;
  currentSegmentLayers: any[];
  setCurrentSegmentLayers: (layers: any[]) => void;
  setActiveSegmentId: (id: string | null) => void;
  onSegmentSelect?: (segment: Segment) => void;
};

export function useSegmentPlayback({
  mapId,
  segments,
  currentMap,
  currentSegmentLayers,
  setCurrentSegmentLayers,
  setActiveSegmentId,
  onSegmentSelect,
}: UseSegmentPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [waitingForUserAction, setWaitingForUserAction] = useState(false);
  const [currentTransition, setCurrentTransition] = useState<TimelineTransition | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTimelineTransitions(mapId);
        console.log("🎬 Loaded timeline transitions:", data);
        if (!cancelled) setTransitions(data || []);
      } catch (e) {
        console.warn("Failed to load timeline transitions:", e);
        if (!cancelled) setTransitions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [mapId]);

  type TransitionOptions = {
    transitionType?: "Jump" | "Ease" | "Linear";
    durationMs?: number;
    cameraAnimationType?: "Jump" | "Ease" | "Fly";
    cameraAnimationDurationMs?: number;
  };

  const findTransition = useCallback((fromId?: string | null, toId?: string | null) => {
    if (!fromId || !toId) return undefined as TimelineTransition | undefined;
    return transitions.find(t => t.fromSegmentId === fromId && t.toSegmentId === toId);
  }, [transitions]);

  // ==================== VIEW SEGMENT ON MAP ====================
  const handleViewSegment = useCallback(async (segment: Segment, opts?: TransitionOptions) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available");
      return;
    }

    try {
      const L = (await import("leaflet")).default;
      const oldLayers = [...currentSegmentLayers];
      
      const newLayers: any[] = [];
      const allBounds: any[] = [];
      

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
            if (opts?.transitionType && opts.transitionType !== 'Jump') {
              try {
                geoJsonLayer.setStyle({ opacity: 0, fillOpacity: 0 });
              } catch {}
            }
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
                if (opts?.transitionType && opts.transitionType !== 'Jump') {
                  try { (labelMarker as any).setOpacity?.(0); } catch {}
                }
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
            if (opts?.transitionType && opts.transitionType !== 'Jump') {
              try { marker.setOpacity?.(0); } catch {}
            }
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

        const camType = opts?.cameraAnimationType || 'Fly';
        const camDurationSec = (opts?.cameraAnimationDurationMs ?? 1500) / 1000;

        console.log(`📹 Camera animation: type=${camType}, duration=${camDurationSec}s, zoom ${currentZoom}→${targetZoom}`);

        if (camType === 'Jump') {
          // Immediate jump without animation
          console.log("⚡ Jump: immediate setView");
          currentMap.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
        } else if (camType === 'Ease') {
          // Smooth pan and zoom separately for an eased feel
          console.log("🌊 Ease: panTo then setZoom");
          try {
            currentMap.panTo([targetCenter[1], targetCenter[0]], { animate: true, duration: camDurationSec * 0.6 });
            setTimeout(() => {
              try {
                currentMap.setZoom(targetZoom, { animate: true });
              } catch {}
            }, camDurationSec * 600);
          } catch {
            currentMap.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: true });
          }
        } else {
          // Fly (default)
          // Only use two-phase if NO transition options (manual view) AND significant zoom change
          const needsTwoPhase = !opts && Math.abs(currentZoom - targetZoom) > 1 && oldLayers.length > 0;
          console.log(`✈️ Fly: ${needsTwoPhase ? 'two-phase (zoom out then in)' : 'direct flyTo'}`);
          if (needsTwoPhase) {
            const midZoom = Math.min(currentZoom, targetZoom) - 2;
            currentMap.flyTo([targetCenter[1], targetCenter[0]], midZoom, { duration: Math.max(0.2, camDurationSec * 0.4), animate: true });
            setTimeout(() => {
              currentMap.flyTo([targetCenter[1], targetCenter[0]], targetZoom, { duration: Math.max(0.2, camDurationSec * 0.6), animate: true });
            }, Math.max(200, camDurationSec * 400));
          } else {
            currentMap.flyTo([targetCenter[1], targetCenter[0]], targetZoom, { duration: camDurationSec, animate: true });
          }
        }
      } else if (allBounds.length > 0) {
        // Auto-fit bounds if no camera state
        try {
          const combinedBounds = allBounds[0];
          for (let i = 1; i < allBounds.length; i++) {
            combinedBounds.extend(allBounds[i]);
          }
          const camType = opts?.cameraAnimationType || 'Fly';
          const camDurationSec = (opts?.cameraAnimationDurationMs ?? 1500) / 1000;
          const animate = camType !== 'Jump';
          currentMap.fitBounds(combinedBounds, {
            padding: [80, 80],
            animate,
            duration: animate ? camDurationSec : undefined,
            maxZoom: 15,
          });
          console.log(`📦 Auto-fitted bounds to show ${allBounds.length} elements (no camera state)`);
        } catch (error) {
          console.error("❌ Failed to fit bounds:", error);
        }
      } else {
        console.warn("⚠️ Empty segment: no camera state and no zones/locations");
      }

      // ==================== LAYER CROSS-FADE ====================
      const doFade = opts?.transitionType && opts.transitionType !== 'Jump';
      const totalMs = opts?.durationMs ?? 800;
      console.log(`🎭 Layer transition: type=${opts?.transitionType || 'default'}, fade=${doFade}, duration=${totalMs}ms, old=${oldLayers.length}, new=${newLayers.length}`);
      
      if (!doFade) {
        // Clear old immediately and keep new as-is
        console.log("⚡ Jump transition: removing old layers immediately");
        oldLayers.forEach(layer => {
          try { currentMap.removeLayer(layer); } catch {}
        });
        if (newLayers.length > 0) setCurrentSegmentLayers(newLayers);
      } else {
        console.log(`🌈 Cross-fade transition: ${opts?.transitionType} over ${totalMs}ms`);
        const start = performance.now();
        const easing = (t: number) => {
          if (opts?.transitionType === 'Linear') return t;
          // EaseInOutQuad
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        };

        const setOpacitySafe = (layer: any, value: number) => {
          try { layer.setOpacity?.(value); } catch {}
          try { layer.setStyle?.({ opacity: value, fillOpacity: value }); } catch {}
        };

        const step = () => {
          const now = performance.now();
          const tRaw = Math.min(1, (now - start) / Math.max(1, totalMs));
          const t = Math.max(0, Math.min(1, easing(tRaw)));
          oldLayers.forEach(l => setOpacitySafe(l, 1 - t));
          newLayers.forEach(l => setOpacitySafe(l, t));
          if (tRaw < 1) {
            requestAnimationFrame(step);
          } else {
            // Cleanup old layers
            oldLayers.forEach(layer => {
              try { currentMap.removeLayer(layer); } catch {}
            });
            if (newLayers.length > 0) setCurrentSegmentLayers(newLayers);
          }
        };
        // Ensure initial state
        oldLayers.forEach(l => setOpacitySafe(l, 1));
        newLayers.forEach(l => setOpacitySafe(l, 0));
        requestAnimationFrame(step);
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
      const prevSegment = currentPlayIndex > 0 ? segments[currentPlayIndex - 1] : undefined;
      const t = findTransition(prevSegment?.segmentId ?? null, segment.segmentId);
      
      console.log(`🔄 Segment ${currentPlayIndex}: ${prevSegment?.segmentId || 'START'} → ${segment.segmentId}`);
      console.log(`📌 Found transition:`, t);
      
      // Normalize case from backend (linear/ease/jump → Linear/Ease/Jump)
      const normalizeTransitionType = (str: string): "Jump" | "Ease" | "Linear" => {
        const lower = str.toLowerCase();
        if (lower === 'jump') return 'Jump';
        if (lower === 'ease') return 'Ease';
        return 'Linear';
      };
      
      const normalizeCameraType = (str: string): "Jump" | "Ease" | "Fly" => {
        const lower = str.toLowerCase();
        if (lower === 'jump') return 'Jump';
        if (lower === 'ease') return 'Ease';
        return 'Fly';
      };
      
      const options: TransitionOptions | undefined = t ? {
        transitionType: normalizeTransitionType(t.transitionType),
        durationMs: t.durationMs,
        cameraAnimationType: t.animateCamera ? normalizeCameraType(t.cameraAnimationType) : 'Jump',
        cameraAnimationDurationMs: t.animateCamera ? t.cameraAnimationDurationMs : undefined,
      } : undefined;
      
      console.log(`⚙️ Applying transition options:`, options);
      
      setActiveSegmentId(segment.segmentId);
      await handleViewSegment(segment, options);
      onSegmentSelect?.(segment);
      
      // Check if this transition requires user action
      if (t && t.requireUserAction) {
        console.log(`⏸️ Waiting for user action: "${t.triggerButtonText}"`);
        setCurrentTransition(t);
        setWaitingForUserAction(true);
        setIsPlaying(false); // Pause playback
        return; // Don't schedule next segment
      }
      
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
    setWaitingForUserAction(false);
    setCurrentTransition(null);
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

  const handleContinueAfterUserAction = () => {
    console.log("▶️ User clicked continue, resuming playback");
    setWaitingForUserAction(false);
    setCurrentTransition(null);
    setCurrentPlayIndex(prev => prev + 1); // Move to next segment
    setIsPlaying(true); // Resume playback
  };

  return {
    isPlaying,
    currentPlayIndex,
    waitingForUserAction,
    currentTransition,
    handleViewSegment,
    handlePlayPreview,
    handleStopPreview,
    handleClearMap,
    handleContinueAfterUserAction,
  };
}
