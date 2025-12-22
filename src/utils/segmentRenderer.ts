/**
 * Shared rendering utilities for storymap segments
 * Used by both edit page and storymap viewer to avoid code duplication
 */

import type { Segment, Location, FrontendTransitionType } from "@/lib/api-storymap";
import type L from "leaflet";
import { applyLayerStyle, type ExtendedLayer } from "@/utils/mapUtils";
import { applyZoneHighlight, applyLayerHighlight, type HighlightOptions } from "@/utils/zoneHighlightEffects";
import { iconEmojiMap } from "@/constants/icons";

type LeafletInstance = typeof import("leaflet");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Flag to track if leaflet-imageoverlay-rotated has been loaded
let rotatedOverlayLoaded = false;

// Lazy load leaflet-imageoverlay-rotated when needed
function ensureRotatedOverlayLoaded(L: LeafletInstance) {
  if (!rotatedOverlayLoaded && typeof window !== 'undefined' && L) {
    try {
      require('leaflet-imageoverlay-rotated');
      rotatedOverlayLoaded = true;
    } catch (error) {
      console.error('Failed to load leaflet-imageoverlay-rotated:', error);
    }
  }
}

function isLeafletMapReady(map?: L.Map | null): boolean {
  try {
    if (!map) return false;

    const container = map.getContainer();
    if (!container || !container.parentElement) {
      return false;
    }

    if ((container as any)._leaflet_id === undefined) {
      return false;
    }

    const size = map.getSize();
    if (!size || size.x <= 0 || size.y <= 0) {
      return false;
    }

    const panes = map.getPanes();
    if (!panes || !panes.mapPane) {
      return false;
    }

    const mapPane = panes.mapPane as any;
    if (mapPane && mapPane._leaflet_pos === undefined) {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // ignore invalidate errors
      }
    }

    return true;
  } catch {
    return false;
  }
}

async function waitForMapReady(map: L.Map, maxAttempts = 10, delayMs = 50): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isLeafletMapReady(map)) {
      return true;
    }
    await delay(delayMs);
  }
  return isLeafletMapReady(map);
}
export interface RenderSegmentOptions {
  transitionType?: FrontendTransitionType;
  durationMs?: number;
  cameraAnimationType?: "Jump" | "Ease" | "Fly";
  cameraAnimationDurationMs?: number;
  skipCameraState?: boolean;
  disableTwoPhaseFly?: boolean;
  highlightZones?: HighlightOptions;
  highlightLayers?: HighlightOptions;
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
  if (!(await waitForMapReady(map))) {
    console.warn("⚠️ Map not ready for rendering zones, skipping segment", segment.segmentId);
    return { layers: [], bounds: [] };
  }
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

      // Build zone style object
      const zoneStyle: any = {};
      
      if (segmentZone.fillZone) {
        zoneStyle.fill = true;
        zoneStyle.fillColor = segmentZone.fillColor || '#FFD700';
        zoneStyle.fillOpacity = segmentZone.fillOpacity ?? 0.3;
      } else {
        zoneStyle.fill = false;
        zoneStyle.fillOpacity = 0;
      }

      if (segmentZone.highlightBoundary) {
        zoneStyle.stroke = true;
        zoneStyle.color = segmentZone.boundaryColor || '#FFD700';
        zoneStyle.weight = segmentZone.boundaryWidth || 2;
        zoneStyle.opacity = 1;
      } else {
        zoneStyle.stroke = false;
        zoneStyle.weight = 0;
        zoneStyle.opacity = 0;
      }

      // Set default line properties for better rendering
      zoneStyle.lineCap = 'round';
      zoneStyle.lineJoin = 'round';

      const geoJsonLayer = L.geoJSON(geoJsonData, {
        style: zoneStyle,
      });

      // Store target opacity for animation restoration
      (geoJsonLayer as any)._targetOpacity = zoneStyle.opacity !== undefined ? zoneStyle.opacity : 1;
      (geoJsonLayer as any)._targetFillOpacity = zoneStyle.fillOpacity !== undefined ? zoneStyle.fillOpacity : 0;

      geoJsonLayer.addTo(map);
      if (options?.transitionType && options.transitionType !== 'Jump') {
        try {
          geoJsonLayer.setStyle({ opacity: 0, fillOpacity: 0 });
        } catch {}
      }

      // Apply highlight effect if enabled
      if (options?.highlightZones?.enabled) {
        applyZoneHighlight(geoJsonLayer, options.highlightZones);
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
  if (!(await waitForMapReady(map))) {
    console.warn("⚠️ Map not ready for rendering locations, skipping segment", segment.segmentId);
    return { layers: [], bounds: [] };
  }
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
      const rotation = parseInt((location as any).rotation) || 0;
      const defaultIcon = '📍';

      // Debug logging
      console.log('[SegmentRenderer] Rendering location:', {
        title: location.title,
        hasIconUrl: !!location.iconUrl,
        iconUrl: location.iconUrl,
        rotation: rotation,
        rotationRaw: (location as any).rotation,
        iconSize: iconSize
      });

      let marker: any;

      // Use imageOverlay.rotated for custom images, regular marker for emojis
      if (location.iconUrl) {
        // Ensure leaflet-imageoverlay-rotated is loaded
        ensureRotatedOverlayLoaded(L);

        const hasRotatedFunction = typeof (L as any).imageOverlay?.rotated === 'function';
        console.log('[SegmentRenderer] Rotated overlay available?', hasRotatedFunction);

        // Check if rotated overlay is available
        if (hasRotatedFunction) {
          console.log('[SegmentRenderer] Using imageOverlay.rotated with rotation:', rotation);
          // Calculate the three corners for imageOverlay.rotated based on center point, size, and rotation
          const metersPerPixel = 156543.03392 * Math.cos(latLng[0] * Math.PI / 180) / Math.pow(2, map.getZoom());
          const sizeInMeters = iconSize * metersPerPixel;
          const sizeInDegrees = sizeInMeters / 111320; // Approximate meters to degrees

          // Calculate corners based on rotation
          const rotRad = (rotation * Math.PI) / 180;
          const halfSize = sizeInDegrees / 2;

          // Calculate rotated corners relative to center
          const cos = Math.cos(rotRad);
          const sin = Math.sin(rotRad);

          // Top-left corner (before rotation: -halfSize, +halfSize)
          const tlLat = latLng[0] + (halfSize * cos - halfSize * sin);
          const tlLng = latLng[1] + (-halfSize * cos - halfSize * sin);

          // Top-right corner (before rotation: +halfSize, +halfSize)
          const trLat = latLng[0] + (halfSize * cos + halfSize * sin);
          const trLng = latLng[1] + (halfSize * cos - halfSize * sin);

          // Bottom-left corner (before rotation: -halfSize, -halfSize)
          const blLat = latLng[0] + (-halfSize * cos - halfSize * sin);
          const blLng = latLng[1] + (-halfSize * cos + halfSize * sin);

          // Create rotated image overlay
          marker = (L as any).imageOverlay.rotated(
            location.iconUrl,
            L.latLng(tlLat, tlLng),
            L.latLng(trLat, trLng),
            L.latLng(blLat, blLng),
            {
              opacity: 1,
              interactive: true,
              className: 'location-image-overlay',
            }
          );
        } else {
          // Fallback to regular marker with CSS rotation if rotated overlay not available
          console.log('[SegmentRenderer] Using CSS fallback with rotation:', rotation);
          const iconHtml = `<img src="${location.iconUrl}" style="width: ${iconSize}px; height: ${iconSize}px; transform: rotate(${rotation}deg); transform-origin: center center;" />`;
          marker = L.marker(latLng, {
            icon: L.divIcon({
              html: iconHtml,
              iconSize: [iconSize, iconSize],
              className: 'location-image-marker',
            }),
          });
        }
      } else {
        // Use emoji or default - Map iconType key to emoji
        let iconContent = defaultIcon;
        if (location.iconType && location.iconType.trim()) {
          const trimmedIconType = location.iconType.trim();
          // If it's a key in iconEmojiMap, use the emoji; otherwise use it directly (might already be emoji)
          iconContent = iconEmojiMap[trimmedIconType] || trimmedIconType || defaultIcon;
        }
        // Use emoji or default with CSS rotation for non-image markers
        const iconHtml = `<div style="
          width: ${iconSize}px;
          height: ${iconSize}px;
          transform: rotate(${rotation}deg);
          transform-origin: center center;
        ">
          <div style="
            font-size: ${iconSize}px;
            text-align: center;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            color: ${iconColor};
            line-height: 1;
          ">${iconContent}</div>
        </div>`;

        marker = L.marker(latLng, {
          icon: L.divIcon({
            className: 'location-marker',
            html: iconHtml,
            iconSize: [iconSize, iconSize],
            iconAnchor: [iconSize / 2, iconSize / 2],
          }),
          zIndexOffset: location.zIndex || 100,
        });
      }

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

      // Add popup that shows when clicked - always show popup for all locations
      const hasContent = location.tooltipContent || location.subtitle;
      const popupHtml = `
        <div style="min-width: 200px; max-width: 400px;">
          <h3 style="margin: 0 0 ${hasContent ? '8px' : '0'}; font-size: 16px; font-weight: 600; color: #1f2937;">
            ${location.title || 'Location'}
          </h3>
          ${location.subtitle ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-style: italic;">${location.subtitle}</p>` : ''}
          ${location.tooltipContent ? `<div style="margin: 8px 0; font-size: 14px; line-height: 1.6; color: #374151;">${location.tooltipContent}</div>` : ''}
        </div>
      `;

      // Use custom modal if callback provided, otherwise use Leaflet popup
      if (options?.onLocationClick) {
        marker.on('click', (e: any) => {
          options.onLocationClick!(location, e);
        });
      } else {
        // Create popup pane with high z-index if it doesn't exist
        if (!map.getPane('location-popup-pane')) {
          const popupPane = map.createPane('location-popup-pane');
          popupPane.style.zIndex = '10000'; // Very high z-index to ensure it's above everything
        }

        marker.bindPopup(popupHtml, {
          maxWidth: 400,
          minWidth: 200,
          className: 'location-popup-custom',
          pane: 'location-popup-pane', // Use custom pane with high z-index
          closeButton: true,
          autoClose: false, // Don't auto-close when clicking elsewhere
          closeOnClick: false, // Don't close on map click
        });

        // Ensure popup opens on marker click
        marker.on('click', () => {
          console.log(`📍 Marker clicked: ${location.title}`);
          marker.openPopup();
          console.log(`✅ Popup opened for: ${location.title}`);
        });
      }

      const entryEffect = (location as any).entryEffect || 'fade';
      const entryDelayMs = (location as any).entryDelayMs || 0;
      const entryDurationMs = (location as any).entryDurationMs || 400;

      marker.addTo(map);

      // Store timing metadata for visibility control during playback
      const exitDelayMs = (location as any).exitDelayMs;
      const markerElement = marker.getElement();

      if (markerElement) {
        // Store timing data on the marker for later use during playback
        (marker as any)._locationTiming = {
          entryTime: entryDelayMs,
          exitTime: exitDelayMs !== undefined ? exitDelayMs : Infinity,
          entryEffect: entryEffect,
          entryDuration: entryDurationMs
        };

        // If we have timing controls, start hidden and let playback control visibility
        if (exitDelayMs !== undefined && entryDelayMs > 0) {
          markerElement.style.opacity = '0';
          markerElement.style.display = 'none';
        }
      }

      // Apply entry animation (only if not using segment transition)
      if (!options?.transitionType && entryEffect !== 'none') {
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

          // Animate after delay (only if no explicit timing controls)
          if ((location as any).exitDelayMs === undefined || entryDelayMs === 0) {
            setTimeout(() => {
              if (!markerElement) return;
              markerElement.style.transition = `all ${entryDurationMs}ms ease-out`;
              markerElement.style.opacity = '1';
              markerElement.style.transform = 'scale(1) translateY(0)';
            }, entryDelayMs);
          }
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

  // Wait for map to be ready before applying camera state
  const applyCameraWithRetry = (attempts = 0) => {
    if (!isLeafletMapReady(map)) {
      if (attempts < 10) {
        // Retry after a short delay
        setTimeout(() => applyCameraWithRetry(attempts + 1), 50);
        return;
      } else {
        console.warn("⚠️ Map container not ready after multiple attempts, using simple setView");
        if (isLeafletMapReady(map)) {
          try {
            map.setView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
          } catch (e) {
            console.error("❌ Failed to set view even with fallback:", e);
          }
        }
        return;
      }
    }

    // Map is ready, proceed with camera animation
    const safeSetView = (latlng: [number, number], zoom: number, opts?: any) => {
      if (!isLeafletMapReady(map)) {
        console.warn("⚠️ Map not ready for setView, skipping");
        return false;
      }
      try {
        // Ensure map is invalidated before setting view
        try {
          map.invalidateSize({ animate: false });
        } catch (e) {
          // Ignore invalidateSize errors
        }
        map.setView(latlng, zoom, opts);
        return true;
      } catch (error) {
        console.error("❌ Failed to setView:", error);
        return false;
      }
    };

    const safeFlyTo = (latlng: [number, number], zoom: number, opts?: any) => {
      if (!isLeafletMapReady(map)) {
        console.warn("⚠️ Map not ready for flyTo, trying setView instead");
        return safeSetView(latlng, zoom, { animate: false });
      }
      try {
        // Ensure map is invalidated before flying
        try {
          map.invalidateSize({ animate: false });
        } catch (e) {
          // Ignore invalidateSize errors
        }
        map.flyTo(latlng, zoom, opts);
        return true;
      } catch (error) {
        console.error("❌ Failed to flyTo, trying setView:", error);
        return safeSetView(latlng, zoom, { animate: false });
      }
    };

    try {
      if (camType === 'Jump') {
        // Immediate jump without animation
        safeSetView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
      } else if (camType === 'Ease') {
        // Smooth pan and zoom separately for an eased feel
        try {
          if (isLeafletMapReady(map)) {
            map.panTo([targetCenter[1], targetCenter[0]], { animate: true, duration: camDurationSec * 0.6 });
          }
          setTimeout(() => {
            if (!isLeafletMapReady(map)) return;
            try {
              map.setZoom(targetZoom, { animate: true });
            } catch (e) {
              console.error("❌ Failed to set zoom during ease:", e);
              safeSetView([targetCenter[1], targetCenter[0]], targetZoom, { animate: true });
            }
          }, camDurationSec * 600);
        } catch {
          safeSetView([targetCenter[1], targetCenter[0]], targetZoom, { animate: true });
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
          safeFlyTo([targetCenter[1], targetCenter[0]], midZoom, { duration: Math.max(0.2, camDurationSec * 0.3), animate: true });
          setTimeout(() => {
            safeFlyTo([targetCenter[1], targetCenter[0]], targetZoom, { duration: Math.max(0.2, camDurationSec * 0.7), animate: true });
          }, Math.max(150, camDurationSec * 300));
        } else {
          // Direct flyTo - smooth transition from current position to target (always used for teacher-controlled)
          safeFlyTo([targetCenter[1], targetCenter[0]], targetZoom, { duration: camDurationSec, animate: true });
        }
      }
    } catch (error) {
      console.error("❌ Error applying camera state:", error);
      // Fallback to simple setView
      safeSetView([targetCenter[1], targetCenter[0]], targetZoom, { animate: false });
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

    const setOpacitySafe = (layer: any, value: number, isNewLayer: boolean = false) => {
      // For new layers, use target opacity if available, otherwise use animation value
      if (isNewLayer && layer._targetOpacity !== undefined) {
        const targetOpacity = layer._targetOpacity;
        const targetFillOpacity = layer._targetFillOpacity !== undefined ? layer._targetFillOpacity : targetOpacity * 0.2;
        const finalOpacity = targetOpacity * value;
        const finalFillOpacity = targetFillOpacity * value;
        try { layer.setOpacity?.(finalOpacity); } catch {}
        try { layer.setStyle?.({ opacity: finalOpacity, fillOpacity: finalFillOpacity }); } catch {}
        // For GeoJSON layers with sub-layers, apply to each sub-layer
        if (layer.eachLayer) {
          layer.eachLayer((subLayer: any) => {
            if (subLayer._targetOpacity !== undefined) {
              const subTargetOpacity = subLayer._targetOpacity;
              const subTargetFillOpacity = subLayer._targetFillOpacity !== undefined ? subLayer._targetFillOpacity : subTargetOpacity * 0.2;
              const subFinalOpacity = subTargetOpacity * value;
              const subFinalFillOpacity = subTargetFillOpacity * value;
              try { subLayer.setOpacity?.(subFinalOpacity); } catch {}
              try { subLayer.setStyle?.({ opacity: subFinalOpacity, fillOpacity: subFinalFillOpacity }); } catch {}
            } else {
              try { subLayer.setOpacity?.(value); } catch {}
              try { subLayer.setStyle?.({ opacity: value, fillOpacity: value }); } catch {}
            }
          });
        }
      } else {
        // For old layers or layers without target opacity, use animation value directly
        try { layer.setOpacity?.(value); } catch {}
        try { layer.setStyle?.({ opacity: value, fillOpacity: value }); } catch {}
        // For GeoJSON layers with sub-layers, apply to each sub-layer
        if (layer.eachLayer) {
          layer.eachLayer((subLayer: any) => {
            try { subLayer.setOpacity?.(value); } catch {}
            try { subLayer.setStyle?.({ opacity: value, fillOpacity: value }); } catch {}
          });
        }
      }
    };

    const step = () => {
      const now = performance.now();
      const tRaw = Math.min(1, (now - start) / Math.max(1, totalMs));
      const t = Math.max(0, Math.min(1, easing(tRaw)));
      oldLayers.forEach(l => setOpacitySafe(l, 1 - t, false));
      newLayers.forEach(l => setOpacitySafe(l, t, true));
      if (tRaw < 1) {
        requestAnimationFrame(step);
      } else {
        oldLayers.forEach(layer => {
          try { map.removeLayer(layer); } catch {}
        });
        // Restore final opacity for new layers
        newLayers.forEach(layer => {
          if (layer._targetOpacity !== undefined) {
            const targetOpacity = layer._targetOpacity;
            const targetFillOpacity = layer._targetFillOpacity !== undefined ? layer._targetFillOpacity : targetOpacity * 0.2;
            try { layer.setOpacity?.(targetOpacity); } catch {}
            try { layer.setStyle?.({ opacity: targetOpacity, fillOpacity: targetFillOpacity }); } catch {}
          }
          // For GeoJSON layers with sub-layers, restore opacity for each sub-layer
          if (layer.eachLayer) {
            layer.eachLayer((subLayer: any) => {
              if (subLayer._targetOpacity !== undefined) {
                const subTargetOpacity = subLayer._targetOpacity;
                const subTargetFillOpacity = subLayer._targetFillOpacity !== undefined ? subLayer._targetFillOpacity : subTargetOpacity * 0.2;
                try { subLayer.setOpacity?.(subTargetOpacity); } catch {}
                try { subLayer.setStyle?.({ opacity: subTargetOpacity, fillOpacity: subTargetFillOpacity }); } catch {}
              }
            });
          }
        });
        if (newLayers.length > 0 && onComplete) {
          onComplete(newLayers);
        }
      }
    };
    oldLayers.forEach(l => setOpacitySafe(l, 1, false));
    newLayers.forEach(l => setOpacitySafe(l, 0, true));
    requestAnimationFrame(step);
  }
}

/**
 * Render layers and map features from a segment onto the map
 */
export async function renderSegmentLayers(
  segment: Segment,
  map: L.Map,
  L: LeafletInstance,
  options?: RenderSegmentOptions
): Promise<RenderResult> {
  if (!(await waitForMapReady(map))) {
    console.warn("⚠️ Map not ready for rendering layers, skipping segment", segment.segmentId);
    return { layers: [], bounds: [] };
  }
  const layers: any[] = [];
  const bounds: L.LatLngBounds[] = [];

  if (!segment.layers || segment.layers.length === 0) {
    return { layers, bounds };
  }

  // Sort layers by displayOrder
  const sortedLayers = [...segment.layers].sort((a, b) => a.displayOrder - b.displayOrder);

  for (const segmentLayer of sortedLayers) {
    if (segmentLayer.isVisible === false) {
      continue;
    }

    try {
      // Render layer data (GeoJSON) if available
      if (segmentLayer.layer?.layerData) {
        try {
          const layerData = segmentLayer.layer.layerData;
          let layerStyle = segmentLayer.layer.layerStyle || {};

          // Apply style override if provided
          if (segmentLayer.styleOverride) {
            try {
              const overrideStyle = JSON.parse(segmentLayer.styleOverride);
              layerStyle = { ...layerStyle, ...overrideStyle };
            } catch {
              // Ignore invalid style override
            }
          }

          // Parse layerData if it's a string
          let geoJsonData = layerData;
          if (typeof layerData === 'string') {
            geoJsonData = JSON.parse(layerData);
          }

          if (geoJsonData && geoJsonData.type === 'FeatureCollection' && geoJsonData.features) {
            const geoJsonLayer = L.geoJSON(geoJsonData as any, {
              style: Object.keys(layerStyle).length > 0 ? layerStyle : undefined,
            });

            // Store target opacity from segment layer config
            const targetOpacity = segmentLayer.opacity !== undefined ? segmentLayer.opacity : 1;
            const baseFillOpacity = typeof layerStyle === 'object' && layerStyle.fillOpacity !== undefined ? layerStyle.fillOpacity : 0.2;
            const targetFillOpacity = targetOpacity * baseFillOpacity;
            
            // Store target opacity in layer metadata for later restoration
            (geoJsonLayer as any)._targetOpacity = targetOpacity;
            (geoJsonLayer as any)._targetFillOpacity = targetFillOpacity;

            // Apply opacity from segment layer config
            if (targetOpacity !== 1) {
              geoJsonLayer.setStyle({ 
                opacity: targetOpacity,
                fillOpacity: targetFillOpacity
              });
            }
            
            // Also store target opacity for each sub-layer in GeoJSON
            geoJsonLayer.eachLayer((subLayer: any) => {
              if (subLayer.setStyle) {
                const subBaseOpacity = typeof layerStyle === 'object' && layerStyle.opacity !== undefined ? layerStyle.opacity : 1;
                const subBaseFillOpacity = typeof layerStyle === 'object' && layerStyle.fillOpacity !== undefined ? layerStyle.fillOpacity : 0.2;
                (subLayer as any)._targetOpacity = subBaseOpacity * targetOpacity;
                (subLayer as any)._targetFillOpacity = subBaseFillOpacity * targetOpacity;
              }
            });

            // Set z-index
            if (segmentLayer.zIndex !== undefined) {
              (geoJsonLayer as any).setZIndex?.(segmentLayer.zIndex);
            }

            geoJsonLayer.addTo(map);

            // Apply entry animation (will be restored by cross-fade)
            if (options?.transitionType && options.transitionType !== 'Jump') {
              try {
                geoJsonLayer.setStyle({ opacity: 0, fillOpacity: 0 });
              } catch {}
            }

            // Apply highlight effect if enabled
            if (options?.highlightLayers?.enabled) {
              applyLayerHighlight(geoJsonLayer, options.highlightLayers);
            }

            layers.push(geoJsonLayer);

            const layerBounds = geoJsonLayer.getBounds();
            if (layerBounds.isValid()) {
              bounds.push(layerBounds);
            }
          }
        } catch (layerError) {
          console.error(`❌ Failed to render layer ${segmentLayer.layerId}:`, layerError);
        }
      }

      // Render map features (annotations, markers, etc.)
      if (segmentLayer.mapFeatures && segmentLayer.mapFeatures.length > 0) {
        for (const feature of segmentLayer.mapFeatures) {
          if (feature.isVisible === false) continue;

          try {
            // Parse feature style
            let featureStyle: any = {};
            if (feature.style) {
              try {
                featureStyle = typeof feature.style === 'string' 
                  ? JSON.parse(feature.style) 
                  : feature.style;
              } catch {
                // Use default style
              }
            }

            // Parse properties for popup content
            let properties: any = {};
            if (feature.properties) {
              try {
                properties = typeof feature.properties === 'string' 
                  ? JSON.parse(feature.properties) 
                  : feature.properties;
              } catch {}
            }

            const geometryType = feature.geometryType?.toLowerCase();

            // Handle Rectangle separately (uses bounds format, not GeoJSON)
            if (geometryType === 'rectangle') {
              try {
                let coordinates: any;
                try {
                  coordinates = typeof feature.coordinates === 'string' 
                    ? JSON.parse(feature.coordinates) 
                    : feature.coordinates;
                } catch {
                  console.warn(`⚠️ Invalid coordinates for Rectangle feature ${feature.featureId}`);
                  continue;
                }

                // Rectangle format: [minLng, minLat, maxLng, maxLat]
                if (!Array.isArray(coordinates) || coordinates.length !== 4) {
                  console.warn(`⚠️ Invalid Rectangle bounds format for feature ${feature.featureId}`);
                  continue;
                }

                const [minLng, minLat, maxLng, maxLat] = coordinates;
                
                // L.rectangle expects [[south, west], [north, east]] = [[minLat, minLng], [maxLat, maxLng]]
                const rectangleLayer = L.rectangle(
                  [[minLat, minLng], [maxLat, maxLng]]
                ) as ExtendedLayer;

                // Apply full style using applyLayerStyle (same as edit map)
                if (Object.keys(featureStyle).length > 0) {
                  applyLayerStyle(rectangleLayer, featureStyle);
                }

                // Apply segment layer opacity to feature
                if (segmentLayer.opacity !== undefined && segmentLayer.opacity !== 1) {
                  const currentOpacity = featureStyle.opacity !== undefined ? featureStyle.opacity : 1;
                  const currentFillOpacity = featureStyle.fillOpacity !== undefined ? featureStyle.fillOpacity : 0.2;
                  rectangleLayer.setStyle({
                    opacity: currentOpacity * segmentLayer.opacity,
                    fillOpacity: currentFillOpacity * segmentLayer.opacity
                  });
                  // Store target opacity for animation restoration
                  (rectangleLayer as any)._targetOpacity = currentOpacity * segmentLayer.opacity;
                  (rectangleLayer as any)._targetFillOpacity = currentFillOpacity * segmentLayer.opacity;
                } else {
                  // Store target opacity from feature style
                  (rectangleLayer as any)._targetOpacity = featureStyle.opacity !== undefined ? featureStyle.opacity : 1;
                  (rectangleLayer as any)._targetFillOpacity = featureStyle.fillOpacity !== undefined ? featureStyle.fillOpacity : 0.2;
                }

                if (feature.zIndex !== undefined) {
                  (rectangleLayer as any).setZIndex?.(feature.zIndex);
                }

                rectangleLayer.addTo(map);

                // Apply entry animation
                if (options?.transitionType && options.transitionType !== 'Jump') {
                  try {
                    rectangleLayer.setStyle({ opacity: 0, fillOpacity: 0 });
                  } catch {}
                }

                layers.push(rectangleLayer);

                const featureBounds = rectangleLayer.getBounds();
                if (featureBounds.isValid()) {
                  bounds.push(featureBounds);
                }
              } catch (rectError) {
                console.error(`❌ Failed to render Rectangle feature ${feature.featureId}:`, rectError);
              }
              continue; // Skip to next feature
            }

            // Handle other geometry types (Point, LineString, Polygon, Circle)
            let coordinates: any;
            try {
              coordinates = typeof feature.coordinates === 'string' 
                ? JSON.parse(feature.coordinates) 
                : feature.coordinates;
            } catch {
              console.warn(`⚠️ Invalid coordinates for feature ${feature.featureId}`);
              continue;
            }

            if (!coordinates) {
              continue;
            }

            // Handle Point geometry
            if (geometryType === 'point') {
              if (!coordinates.coordinates || !Array.isArray(coordinates.coordinates)) {
                continue;
              }

              const coords = coordinates.coordinates;
              const latLng: [number, number] = [coords[1], coords[0]];

              // Create marker with custom icon
              let iconHtml = '';
              if (featureStyle.iconUrl) {
                iconHtml = `<img src="${featureStyle.iconUrl}" style="width: ${featureStyle.iconSize?.[0] || 32}px; height: ${featureStyle.iconSize?.[1] || 32}px;" />`;
              } else if (properties.text) {
                iconHtml = properties.text;
              } else {
                iconHtml = feature.name || '📍';
              }

              const marker = L.marker(latLng, {
                icon: L.divIcon({
                  className: featureStyle.className || 'map-feature-marker',
                  html: iconHtml,
                  iconSize: featureStyle.iconSize || [32, 32],
                  iconAnchor: featureStyle.iconAnchor || [16, 16],
                }),
                zIndexOffset: feature.zIndex || segmentLayer.zIndex || 0,
              });

              // Add popup if feature has name or description
              if (feature.name || feature.description || properties.text) {
                const popupContent = `
                  <div style="min-width: 200px;">
                    ${feature.name ? `<h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${feature.name}</h3>` : ''}
                    ${feature.description ? `<p style="margin: 0; font-size: 14px; color: #666;">${feature.description}</p>` : ''}
                    ${properties.text ? `<div style="margin-top: 8px;">${properties.text}</div>` : ''}
                  </div>
                `;
                marker.bindPopup(popupContent);
              }

              marker.addTo(map);
              
              // Apply entry animation
              if (options?.transitionType && options.transitionType !== 'Jump') {
                try { marker.setOpacity?.(0); } catch {}
              }

              layers.push(marker);
              bounds.push(L.latLngBounds([latLng, latLng]));
            } else if (geometryType === 'circle') {
              // Handle Circle geometry - can be stored as Polygon in GeoJSON or have radius in style
              let circleLayer: ExtendedLayer | null = null;
              
              // Check if radius is in style
              if (featureStyle.radius && typeof featureStyle.radius === 'number') {
                // Circle with explicit radius from style
                if (coordinates.type === 'Point' && coordinates.coordinates) {
                  const [lng, lat] = coordinates.coordinates;
                  circleLayer = L.circle([lat, lng], { radius: featureStyle.radius }) as ExtendedLayer;
                } else if (coordinates.type === 'Polygon' && coordinates.coordinates) {
                  // Extract center from polygon and use radius from style
                  const polygonCoords = coordinates.coordinates[0];
                  if (polygonCoords && polygonCoords.length > 0) {
                    const [lng, lat] = polygonCoords[0];
                    circleLayer = L.circle([lat, lng], { radius: featureStyle.radius }) as ExtendedLayer;
                  }
                }
              } else if (coordinates.type === 'Polygon' && coordinates.coordinates) {
                // Circle stored as Polygon - calculate center and radius
                const polygonCoords = coordinates.coordinates[0];
                if (polygonCoords && polygonCoords.length > 0) {
                  const [lng, lat] = polygonCoords[0];
                  // Calculate approximate radius from polygon
                  const center = L.latLng(lat, lng);
                  const firstPoint = L.latLng(polygonCoords[0][1], polygonCoords[0][0]);
                  const radius = center.distanceTo(firstPoint);
                  circleLayer = L.circle([lat, lng], { radius }) as ExtendedLayer;
                }
              }

              if (circleLayer) {
                // Apply full style using applyLayerStyle (same as edit map)
                if (Object.keys(featureStyle).length > 0) {
                  applyLayerStyle(circleLayer, featureStyle);
                }

                // Apply segment layer opacity to feature
                if (segmentLayer.opacity !== undefined && segmentLayer.opacity !== 1) {
                  const currentOpacity = featureStyle.opacity !== undefined ? featureStyle.opacity : 1;
                  const currentFillOpacity = featureStyle.fillOpacity !== undefined ? featureStyle.fillOpacity : 0.2;
                  circleLayer.setStyle({
                    opacity: currentOpacity * segmentLayer.opacity,
                    fillOpacity: currentFillOpacity * segmentLayer.opacity
                  });
                  // Store target opacity for animation restoration
                  (circleLayer as any)._targetOpacity = currentOpacity * segmentLayer.opacity;
                  (circleLayer as any)._targetFillOpacity = currentFillOpacity * segmentLayer.opacity;
                } else {
                  // Store target opacity from feature style
                  (circleLayer as any)._targetOpacity = featureStyle.opacity !== undefined ? featureStyle.opacity : 1;
                  (circleLayer as any)._targetFillOpacity = featureStyle.fillOpacity !== undefined ? featureStyle.fillOpacity : 0.2;
                }

                if (feature.zIndex !== undefined) {
                  (circleLayer as any).setZIndex?.(feature.zIndex);
                }

                circleLayer.addTo(map);
                
                // Apply entry animation
                if (options?.transitionType && options.transitionType !== 'Jump') {
                  try {
                    circleLayer.setStyle({ opacity: 0, fillOpacity: 0 });
                  } catch {}
                }

                layers.push(circleLayer);

                const featureBounds = circleLayer.getBounds();
                if (featureBounds.isValid()) {
                  bounds.push(featureBounds);
                }
              } else {
                console.warn(`⚠️ Failed to render Circle feature ${feature.featureId}`);
              }
            } else {
              // For other geometry types (LineString, Polygon), render as GeoJSON
              if (!coordinates.type || !coordinates.coordinates) {
                console.warn(`⚠️ Invalid GeoJSON geometry for feature ${feature.featureId}`);
                continue;
              }

              const geoJsonFeature = {
                type: 'Feature',
                geometry: coordinates,
                properties: properties,
              };

              // Create GeoJSON layer without style first
              const featureLayer = L.geoJSON(geoJsonFeature as any) as ExtendedLayer;

              // Apply full style using applyLayerStyle (same as edit map)
              // This ensures all style properties (color, fillColor, stroke, fill, opacity, fillOpacity, weight, dashArray, lineCap, lineJoin, etc.) are applied correctly
              if (Object.keys(featureStyle).length > 0) {
                // For GeoJSON layers, we need to apply style to each sub-layer
                featureLayer.eachLayer((layer: any) => {
                  if (layer.setStyle) {
                    applyLayerStyle(layer as ExtendedLayer, featureStyle);
                    
                    // Apply segment layer opacity to feature sub-layer
                    if (segmentLayer.opacity !== undefined && segmentLayer.opacity !== 1) {
                      const currentOpacity = featureStyle.opacity !== undefined ? featureStyle.opacity : 1;
                      const currentFillOpacity = featureStyle.fillOpacity !== undefined ? featureStyle.fillOpacity : 0.2;
                      layer.setStyle({
                        opacity: currentOpacity * segmentLayer.opacity,
                        fillOpacity: currentFillOpacity * segmentLayer.opacity
                      });
                      // Store target opacity for animation restoration
                      (layer as any)._targetOpacity = currentOpacity * segmentLayer.opacity;
                      (layer as any)._targetFillOpacity = currentFillOpacity * segmentLayer.opacity;
                    } else {
                      // Store target opacity from feature style
                      (layer as any)._targetOpacity = featureStyle.opacity !== undefined ? featureStyle.opacity : 1;
                      (layer as any)._targetFillOpacity = featureStyle.fillOpacity !== undefined ? featureStyle.fillOpacity : 0.2;
                    }
                  }
                });
              } else {
                // Even without feature style, apply segment layer opacity
                if (segmentLayer.opacity !== undefined && segmentLayer.opacity !== 1) {
                  featureLayer.eachLayer((layer: any) => {
                    if (layer.setStyle) {
                      layer.setStyle({
                        opacity: segmentLayer.opacity,
                        fillOpacity: segmentLayer.opacity * 0.2
                      });
                      (layer as any)._targetOpacity = segmentLayer.opacity;
                      (layer as any)._targetFillOpacity = segmentLayer.opacity * 0.2;
                    }
                  });
                }
              }

              if (feature.zIndex !== undefined) {
                (featureLayer as any).setZIndex?.(feature.zIndex);
              }

              featureLayer.addTo(map);
              
              // Apply entry animation
              if (options?.transitionType && options.transitionType !== 'Jump') {
                try {
                  featureLayer.setStyle({ opacity: 0, fillOpacity: 0 });
                } catch {}
              }

              layers.push(featureLayer);

              const featureBounds = featureLayer.getBounds();
              if (featureBounds.isValid()) {
                bounds.push(featureBounds);
              }
            }
          } catch (featureError) {
            console.error(`❌ Failed to render feature ${feature.featureId}:`, featureError);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Failed to render segment layer ${segmentLayer.segmentLayerId}:`, error);
    }
  }

  return { layers, bounds };
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

  // Render layers and map features
  const layerResult = await renderSegmentLayers(segment, map, L, options);
  newLayers.push(...layerResult.layers);
  allBounds.push(...layerResult.bounds);

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
