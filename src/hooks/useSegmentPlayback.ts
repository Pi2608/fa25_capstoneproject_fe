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
  onLocationClick?: (location: any, event?: any) => void;
};

export function useSegmentPlayback({
  mapId,
  segments,
  currentMap,
  currentSegmentLayers,
  setCurrentSegmentLayers,
  setActiveSegmentId,
  onSegmentSelect,
  onLocationClick,
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

            // Create marker icon based on config
            const iconSize = location.iconSize || 32;
            const iconColor = location.iconColor || '#FF0000';
            
            // Determine icon content: IconUrl (image), IconType (emoji), or default
            let iconHtml = '';
            if (location.iconUrl) {
              // Use custom image
              iconHtml = `<img src="${location.iconUrl}" style="
                width: ${iconSize}px;
                height: ${iconSize}px;
                object-fit: contain;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
              " />`;
            } else {
              // Use emoji or default
              const iconContent = location.iconType || '📍';
              iconHtml = `<div style="
                font-size: ${iconSize}px;
                text-align: center;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
                color: ${iconColor};
                line-height: 1;
              ">${iconContent}</div>`;
            }

            const marker = L.marker(latLng, {
              icon: L.divIcon({
                className: 'location-marker',
                html: iconHtml,
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconSize / 2, iconSize],
              }),
              zIndexOffset: location.zIndex || 100,
            });

            // Add tooltip if enabled - support HTML content
            // During playback, always show title as permanent label above marker
            const tooltipContent = location.title || location.tooltipContent || '';
            if (tooltipContent) {
              marker.bindTooltip(tooltipContent, {
                permanent: true, // Always show during playback
                direction: 'top',
                className: 'location-title-tooltip',
                opacity: 0.95,
                offset: [0, -(iconSize / 2) - 8], // Position above marker
              });
            }

            // Add popup if enabled - rich HTML content with media, audio, external link
            if (location.openPopupOnClick && location.popupContent) {
              // Build media gallery
              let mediaHtml = '';
              if (location.mediaResources) {
                const mediaUrls = location.mediaResources.split('\n').filter((url: string) => url.trim());
                if (mediaUrls.length > 0) {
                  mediaHtml = '<div style="margin: 12px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px;">';
                  mediaUrls.forEach((url: string) => {
                    const trimmedUrl = url.trim();
                    // Check if image or video
                    if (trimmedUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                      mediaHtml += `<img src="${trimmedUrl}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${trimmedUrl}', '_blank')" />`;
                    } else if (trimmedUrl.match(/\.(mp4|webm|ogg)$/i)) {
                      mediaHtml += `<video controls style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px;"><source src="${trimmedUrl}" /></video>`;
                    }
                  });
                  mediaHtml += '</div>';
                }
              }

              // Build audio player
              let audioHtml = '';
              if (location.playAudioOnClick && location.audioUrl) {
                audioHtml = `
                  <div style="margin: 12px 0;">
                    <audio controls style="width: 100%; height: 32px;">
                      <source src="${location.audioUrl}" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                `;
              }

              // Build external link button
              let linkHtml = '';
              if (location.externalUrl) {
                linkHtml = `
                  <div style="margin: 12px 0;">
                    <a href="${location.externalUrl}" target="_blank" rel="noopener noreferrer" 
                       style="display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                      🔗 Open External Link
                    </a>
                  </div>
                `;
              }

              const popupHtml = `
                <div style="min-width: 250px; max-width: 400px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937;">
                    ${location.title}
                  </h3>
                  ${location.subtitle ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280; font-style: italic;">${location.subtitle}</p>` : ''}
                  <div style="margin: 12px 0; font-size: 14px; line-height: 1.6; color: #374151;">
                    ${location.popupContent}
                  </div>
                  ${mediaHtml}
                  ${audioHtml}
                  ${linkHtml}
                </div>
              `;
              
              // Use custom modal if callback provided, otherwise use Leaflet popup
              if (onLocationClick) {
                marker.on('click', (e: any) => {
                  onLocationClick(location, e);
                });
              } else {
                marker.bindPopup(popupHtml, {
                  maxWidth: 400,
                  className: 'location-popup-custom',
                });
              }
            } else if (onLocationClick && (location.tooltipContent || location.description)) {
              // If no popup but has tooltip content and callback, allow click to show modal
              marker.on('click', (e: any) => {
                onLocationClick(location, e);
              });
            }

            const entryEffect = (location as any).entryEffect || 'fade';
            const entryDelayMs = (location as any).entryDelayMs || 0;
            const entryDurationMs = (location as any).entryDurationMs || 400;
            
            marker.addTo(currentMap);
            
            // Apply entry animation (only if not using segment transition)
            if (!opts?.transitionType && entryEffect !== 'none') {
              const markerElement = marker.getElement();
              if (markerElement) {
                // Initial state
                markerElement.style.transition = 'none';
                markerElement.style.opacity = '0';
                
                if (entryEffect === 'fade') {
                  markerElement.style.opacity = '0';
                } else if (entryEffect === 'scale') {
                  markerElement.style.transform = 'scale(0)';
                  markerElement.style.opacity = '0';
                } else if (entryEffect === 'slide-up') {
                  markerElement.style.transform = 'translateY(20px)';
                  markerElement.style.opacity = '0';
                } else if (entryEffect === 'bounce') {
                  markerElement.style.transform = 'scale(0.3)';
                  markerElement.style.opacity = '0';
                }
                
                // Animate after delay
                setTimeout(() => {
                  if (!markerElement) return;
                  markerElement.style.transition = `all ${entryDurationMs}ms ease-out`;
                  markerElement.style.opacity = '1';
                  markerElement.style.transform = 'scale(1) translateY(0)';
                }, entryDelayMs);
              }
            } else if (opts?.transitionType && opts.transitionType !== 'Jump') {
              // Use segment transition fade
              try { marker.setOpacity?.(0); } catch {}
            }
            
            newLayers.push(marker);
            
            allBounds.push(L.latLngBounds([latLng, latLng]));
          } catch (error) {
            console.error(`❌ Failed to render location ${location.poiId || location.locationId}:`, error);
          }
        }

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

        if (camType === 'Jump') {
          currentMap.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
        } else if (camType === 'Ease') {
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
          const needsTwoPhase = !opts && Math.abs(currentZoom - targetZoom) > 1 && oldLayers.length > 0;
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
        } catch (error) {
          console.error("❌ Failed to fit bounds:", error);
        }
      } else {
        console.warn("⚠️ Empty segment: no camera state and no zones/locations");
      }

      // ==================== LAYER CROSS-FADE ====================
      const doFade = opts?.transitionType && opts.transitionType !== 'Jump';
      const totalMs = opts?.durationMs ?? 800;

      if (!doFade) {

        oldLayers.forEach(layer => {
          try { currentMap.removeLayer(layer); } catch {}
        });
        if (newLayers.length > 0) setCurrentSegmentLayers(newLayers);
      } else {
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
      
      
      setActiveSegmentId(segment.segmentId);
      await handleViewSegment(segment, options);
      onSegmentSelect?.(segment);
      
      // Check if this transition requires user action
      if (t && t.requireUserAction) {
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
  
    currentSegmentLayers.forEach(layer => {
      try {
        currentMap.removeLayer(layer);
      } catch (e) {
        console.warn("Failed to remove layer:", e);
      }
    });
    
    setCurrentSegmentLayers([]);
    setActiveSegmentId(null);
  };

  const handleContinueAfterUserAction = () => {
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
