/**
 * Shared rendering utilities for storymap segments
 * Used by both edit page and storymap viewer to avoid code duplication
 */

import type { Segment, Location } from "@/lib/api-storymap";
import type L from "leaflet";

type LeafletInstance = typeof import("leaflet");
export interface RenderSegmentOptions {
  transitionType?: "Jump" | "Ease" | "Linear";
  durationMs?: number;
  cameraAnimationType?: "Jump" | "Ease" | "Fly";
  cameraAnimationDurationMs?: number;
  skipCameraState?: boolean;
  disableTwoPhaseFly?: boolean;
}

export interface RenderResult {
  layers: any[];
  bounds: L.LatLngBounds[];
}

/**
 * Render zones from a segment onto the map
 */
export async function renderSegmentZones(
  segment: Segment,
  map: L.Map,
  L: LeafletInstance,
  options?: RenderSegmentOptions
): Promise<RenderResult> {
  const layers: any[] = [];
  const bounds: L.LatLngBounds[] = [];

  if (!segment.zones || segment.zones.length === 0) {
    return { layers, bounds };
  }

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

      geoJsonLayer.addTo(map);
      if (options?.transitionType && options.transitionType !== 'Jump') {
        try {
          geoJsonLayer.setStyle({ opacity: 0, fillOpacity: 0 });
        } catch {}
      }
      layers.push(geoJsonLayer);

      const layerBounds = geoJsonLayer.getBounds();
      if (layerBounds.isValid()) {
        bounds.push(layerBounds);
      }

      // Add label if enabled
      if (segmentZone.showLabel) {
        try {
          let labelPosition: [number, number];
          
          if (zone.centroid) {
            const centroid = JSON.parse(zone.centroid);
            labelPosition = [centroid.coordinates[1], centroid.coordinates[0]];
          } else {
            const center = layerBounds.getCenter();
            labelPosition = [center.lat, center.lng];
          }

          const labelMarker = L.marker(labelPosition, {
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
          labelMarker.addTo(map);
          if (options?.transitionType && options.transitionType !== 'Jump') {
            try { (labelMarker as any).setOpacity?.(0); } catch {}
          }
          layers.push(labelMarker);
        } catch (labelError) {
          console.error(`Failed to add label for zone ${zone.zoneId}:`, labelError);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to render zone ${zone.zoneId}:`, error);
    }
  }

  return { layers, bounds };
}

/**
 * Build HTML content for location popup
 */
export function buildLocationPopupHtml(location: Location): string {
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

  return `
    <div style="min-width: 250px; max-width: 400px;">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1f2937;">
        ${location.title}
      </h3>
      ${location.subtitle ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280; font-style: italic;">${location.subtitle}</p>` : ''}
      <div style="margin: 12px 0; font-size: 14px; line-height: 1.6; color: #374151;">
        ${location.popupContent || ''}
      </div>
      ${mediaHtml}
      ${audioHtml}
      ${linkHtml}
    </div>
  `;
}

/**
 * Render locations from a segment onto the map
 */
export async function renderSegmentLocations(
  segment: Segment,
  map: L.Map,
  L: LeafletInstance,
  options?: RenderSegmentOptions & {
    onLocationClick?: (location: Location, event?: any) => void;
  }
): Promise<RenderResult> {
  const layers: any[] = [];
  const bounds: L.LatLngBounds[] = [];

  if (!segment.locations || segment.locations.length === 0) {
    return { layers, bounds };
  }

  for (const location of segment.locations) {
    try {
      if (location.isVisible === false) {
        continue;
      }

      if (!location.markerGeometry) {
        console.warn(`⚠️ Location ${location.locationId} has no geometry`);
        continue;
      }

      let geoJsonData;
      try {
        geoJsonData = JSON.parse(location.markerGeometry);
      } catch (parseError) {
        console.error(`❌ Failed to parse geometry for location ${location.locationId}:`, parseError);
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
        const popupHtml = buildLocationPopupHtml(location);
        
        // Use custom modal if callback provided, otherwise use Leaflet popup
        if (options?.onLocationClick) {
          marker.on('click', (e: any) => {
            options.onLocationClick!(location, e);
          });
        } else {
          marker.bindPopup(popupHtml, {
            maxWidth: 400,
            className: 'location-popup-custom',
          });
        }
      } else if (options?.onLocationClick && (location.tooltipContent || location.description)) {
        // If no popup but has tooltip content and callback, allow click to show modal
        marker.on('click', (e: any) => {
          options.onLocationClick!(location, e);
        });
      }

      const entryEffect = (location as any).entryEffect || 'fade';
      const entryDelayMs = (location as any).entryDelayMs || 0;
      const entryDurationMs = (location as any).entryDurationMs || 400;
      
      marker.addTo(map);
      
      // Apply entry animation (only if not using segment transition)
      if (!options?.transitionType && entryEffect !== 'none') {
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
      } else if (options?.transitionType && options.transitionType !== 'Jump') {
        // Use segment transition fade
        try { marker.setOpacity?.(0); } catch {}
      }
      
      layers.push(marker);
      
      bounds.push(L.latLngBounds([latLng, latLng]));
    } catch (error) {
      console.error(`❌ Failed to render location ${location.locationId}:`, error);
    }
  }

  return { layers, bounds };
}

/**
 * Apply camera state to map with animation
 */
export function applyCameraState(
  segment: Segment,
  map: L.Map,
  options?: RenderSegmentOptions & { oldLayersCount?: number }
): void {
  if (!segment.cameraState || options?.skipCameraState) {
    return;
  }

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
  
  const currentZoom = map.getZoom();
  const targetZoom = parsedCamera.zoom || 10;
  const targetCenter = parsedCamera.center;

  const camType = options?.cameraAnimationType || 'Fly';
  const camDurationSec = (options?.cameraAnimationDurationMs ?? 1500) / 1000;

  // Helper function to check if map container is ready
  const isMapReady = (map: L.Map): boolean => {
    try {
      const container = map.getContainer();
      if (!container || !container.parentElement) {
        return false;
      }
      if ((container as any)._leaflet_id === undefined) {
        return false;
      }
      const size = map.getSize();
      return size.x > 0 && size.y > 0;
    } catch {
      return false;
    }
  };

  // Wait for map to be ready before applying camera state
  const applyCameraWithRetry = (attempts = 0) => {
    if (!isMapReady(map)) {
      if (attempts < 10) {
        // Retry after a short delay
        setTimeout(() => applyCameraWithRetry(attempts + 1), 50);
        return;
      } else {
        console.warn("⚠️ Map container not ready after multiple attempts, using simple setView");
        try {
          map.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
        } catch (e) {
          console.error("❌ Failed to set view even with fallback:", e);
        }
        return;
      }
    }

    // Map is ready, proceed with camera animation
    try {
      if (camType === 'Jump') {
        // Immediate jump without animation
        map.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
      } else if (camType === 'Ease') {
        // Smooth pan and zoom separately for an eased feel
        try {
          map.panTo([targetCenter[1], targetCenter[0]], { animate: true, duration: camDurationSec * 0.6 });
          setTimeout(() => {
            try {
              map.setZoom(targetZoom, { animate: true });
            } catch {}
          }, camDurationSec * 600);
        } catch {
          map.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: true });
        }
      } else {
        const zoomDiff = targetZoom - currentZoom;
        const shouldUseTwoPhase = 
          !options?.disableTwoPhaseFly &&
          zoomDiff < -3 &&
          !options?.transitionType &&
          (options?.oldLayersCount || 0) > 0;
        
        if (shouldUseTwoPhase) {
          const midZoom = Math.min(currentZoom, targetZoom) - 1;
          map.flyTo([targetCenter[1], targetCenter[0]], midZoom, { duration: Math.max(0.2, camDurationSec * 0.3), animate: true });
          setTimeout(() => {
            try {
              map.flyTo([targetCenter[1], targetCenter[0]], targetZoom, { duration: Math.max(0.2, camDurationSec * 0.7), animate: true });
            } catch (e) {
              console.error("❌ Failed to flyTo in second phase:", e);
            }
          }, Math.max(150, camDurationSec * 300));
        } else {
          // Direct flyTo - smooth transition from current position to target (always used for teacher-controlled)
          map.flyTo([targetCenter[1], targetCenter[0]], targetZoom, { duration: camDurationSec, animate: true });
        }
      }
    } catch (error) {
      console.error("❌ Error applying camera state:", error);
      // Fallback to simple setView
      try {
        map.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
      } catch (e) {
        console.error("❌ Failed to set view as fallback:", e);
      }
    }
  };

  // Start applying camera state with retry logic
  applyCameraWithRetry();
}

/**
 * Auto-fit bounds if no camera state
 */
export function autoFitBounds(
  bounds: L.LatLngBounds[],
  map: L.Map,
  options?: RenderSegmentOptions
): void {
  if (bounds.length > 0) {
    try {
      const combinedBounds = bounds[0];
      for (let i = 1; i < bounds.length; i++) {
        combinedBounds.extend(bounds[i]);
      }
      const camType = options?.cameraAnimationType || 'Fly';
      const camDurationSec = (options?.cameraAnimationDurationMs ?? 1500) / 1000;
      const animate = camType !== 'Jump';
      map.fitBounds(combinedBounds, {
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
}

/**
 * Apply layer cross-fade transition
 */
export function applyLayerCrossFade(
  oldLayers: any[],
  newLayers: any[],
  map: L.Map,
  options?: RenderSegmentOptions,
  onComplete?: (newLayers: any[]) => void
): void {
  const doFade = options?.transitionType && options.transitionType !== 'Jump';
  const totalMs = options?.durationMs ?? 800;
  
  if (!doFade) {
    oldLayers.forEach(layer => {
      try { map.removeLayer(layer); } catch {}
    });
    if (newLayers.length > 0 && onComplete) {
      onComplete(newLayers);
    }
  } else {
    const start = performance.now();
    const easing = (t: number) => {
      if (options?.transitionType === 'Linear') return t;
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
        oldLayers.forEach(layer => {
          try { map.removeLayer(layer); } catch {}
        });
        if (newLayers.length > 0 && onComplete) {
          onComplete(newLayers);
        }
      }
    };
    oldLayers.forEach(l => setOpacitySafe(l, 1));
    newLayers.forEach(l => setOpacitySafe(l, 0));
    requestAnimationFrame(step);
  }
}

/**
 * Main function to render a segment - combines all rendering logic
 */
export async function renderSegment(
  segment: Segment,
  map: L.Map,
  L: LeafletInstance,
  options?: RenderSegmentOptions & {
    onLocationClick?: (location: Location, event?: any) => void;
  },
  oldLayers: any[] = []
): Promise<{ layers: any[] }> {
  const newLayers: any[] = [];
  const allBounds: L.LatLngBounds[] = [];

  // Render zones
  const zoneResult = await renderSegmentZones(segment, map, L, options);
  newLayers.push(...zoneResult.layers);
  allBounds.push(...zoneResult.bounds);

  // Render locations
  const locationResult = await renderSegmentLocations(segment, map, L, options);
  newLayers.push(...locationResult.layers);
  allBounds.push(...locationResult.bounds);

  // Apply camera state or auto-fit bounds
  if (segment.cameraState && !options?.skipCameraState) {
    applyCameraState(segment, map, options);
  } else if (allBounds.length > 0) {
    autoFitBounds(allBounds, map, options);
  }

  // Apply layer transitions
  applyLayerCrossFade(
    oldLayers,
    newLayers,
    map,
    options,
    () => {} // onComplete will be handled by caller
  );

  return { layers: newLayers };
}
