import { useEffect, useRef } from "react";
import type L from "leaflet";
import type { MapWithPM } from "@/types";
import { getMapLocations } from "@/lib/api-storymap";
import { MapLocation } from "@/lib/api-location";

interface UsePoiMarkersParams {
  mapId: string;
  mapRef: React.MutableRefObject<MapWithPM | null>;
  isMapReady: boolean;
  setPoiTooltipModal: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      locationId?: string;
      title?: string;
      subtitle?: string;
      content?: string;
    }>
  >;
}

/**
 * Custom hook to manage POI markers on the map
 * Handles loading, rendering, and lifecycle of POI markers
 */
export function usePoiMarkers({
  mapId,
  mapRef,
  isMapReady,
  setPoiTooltipModal,
}: UsePoiMarkersParams) {
  const poiMarkersRef = useRef<L.Marker[]>([]);
  const editingLocationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || !mapId || !isMapReady) return;

    let cancelled = false;

    const loadAndRenderPois = async () => {
      try {
        // Clear existing POI markers
        poiMarkersRef.current.forEach((marker) => {
          try {
            // Cleanup tooltip modal if exists
            const tooltipCleanup = (marker as any)._tooltipCleanup;
            if (tooltipCleanup) {
              tooltipCleanup();
            }
            // Remove any existing tooltip modal
            const existingTooltip = document.querySelector(
              `.poi-tooltip-modal[data-location-id="${(marker as any)._locationId}"]`
            );
            if (existingTooltip) {
              existingTooltip.remove();
            }
            mapRef.current?.removeLayer(marker);
          } catch { }
        });
        poiMarkersRef.current = [];

        // Load POIs
        const pois = (await getMapLocations(mapId)) as MapLocation[];
        if (cancelled || !mapRef.current) {
          return;
        }

        const L = (await import("leaflet")).default;

        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }

        // Render each POI
        for (const poi of pois) {
          if (cancelled || !mapRef.current) break;

          try {
            if (poi.isVisible === false) {
              continue;
            }

            // CRITICAL FIX: Skip rendering location being edited to prevent duplicate markers
            if (editingLocationIdRef.current && poi.locationId === editingLocationIdRef.current) {
              continue;
            }

            if (!poi.markerGeometry) {
              continue;
            }

            let geoJsonData;
            try {
              geoJsonData = JSON.parse(poi.markerGeometry);
            } catch (parseError) {
              continue;
            }

            const coords = geoJsonData.coordinates;
            const latLng: [number, number] = [coords[1], coords[0]];

            // Create marker icon based on config
            const iconSize = poi.iconSize || 32;
            const iconColor = poi.iconColor || "#FF0000";

            // Determine icon content: IconUrl (image), IconType (emoji), or default
            let iconHtml = "";
            const defaultIcon = "📍";

            if (poi.iconUrl) {
              // Use custom image
              iconHtml = `<div style="
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: ${iconSize}px !important;
                height: ${iconSize}px !important;
                background: transparent !important;
                visibility: visible !important;
                opacity: 1 !important;
              "><img src="${poi.iconUrl}" style="
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)) !important;
                pointer-events: none !important;
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
              " alt="${poi.title}" /></div>`;
            } else {
              // Use emoji or default
              const iconContent =
                (poi.iconType && poi.iconType.trim()) || defaultIcon;
              iconHtml = `<div style="
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: ${iconSize}px !important;
                height: ${iconSize}px !important;
                font-size: ${iconSize}px !important;
                text-align: center !important;
                line-height: 1 !important;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)) !important;
                color: ${iconColor} !important;
                background: transparent !important;
                pointer-events: none !important;
                user-select: none !important;
                visibility: visible !important;
                opacity: 1 !important;
                font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif !important;
              ">${iconContent}</div>`;
            }

            const marker = L.marker(latLng, {
              icon: L.divIcon({
                className: "poi-marker",
                html: iconHtml,
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconSize / 2, iconSize],
                popupAnchor: [0, -iconSize],
              }),
              zIndexOffset: poi.zIndex || 100,
              interactive: true,
              keyboard: true,
              riseOnHover: true,
            });

            // Store POI ID for cleanup
            (marker as any)._locationId = poi.locationId;

            // Auto-play audio on click if configured
            if (poi.playAudioOnClick && poi.audioUrl) {
              marker.on('click', () => {
                // Create and play audio
                const audio = new Audio(poi.audioUrl);
                audio.play().catch(err => {
                  console.warn('Failed to auto-play audio:', err);
                });
              });
            }

            // Add click handler to show info panel (replaces old popup)
            if (poi.showTooltip !== false && poi.tooltipContent) {
              // Process content
              const rawContent = poi.tooltipContent || "";
              let processedContent = rawContent;

              // Method 1: Parse JSON string if needed
              if (rawContent.startsWith('"') && rawContent.endsWith('"')) {
                try {
                  processedContent = JSON.parse(rawContent);
                } catch (e) {
                  // Not JSON, use as-is
                }
              }

              // Method 2: Unescape common escape sequences
              if (
                processedContent.includes('\\"') ||
                processedContent.includes("\\n") ||
                processedContent.includes("\\r")
              ) {
                processedContent = processedContent
                  .replace(/\\"/g, '"')
                  .replace(/\\n/g, "\n")
                  .replace(/\\r/g, "\r")
                  .replace(/\\t/g, "\t")
                  .replace(/\\\\/g, "\\");
              }

              // Method 3: Decode HTML entities
              try {
                const textarea = document.createElement("textarea");
                textarea.innerHTML = processedContent;
                const decoded = textarea.value;
                if (decoded !== processedContent) {
                  processedContent = decoded;
                }
              } catch (e) {
                // Decode failed, use as-is
              }

              // Add click listener to open info panel
              marker.on('click', () => {
                setPoiTooltipModal({
                  isOpen: true,
                  locationId: poi.locationId,
                  title: poi.title || '',
                  subtitle: poi.subtitle,
                  content: processedContent,
                });
              });
            }

            // Add popup if enabled - rich HTML content with media, audio, external link
            if (poi.openSlideOnClick && poi.slideContent) {
              // Build media gallery
              let mediaHtml = "";
              if (poi.mediaResources) {
                const mediaUrls = poi.mediaResources
                  .split("\n")
                  .filter((url: string) => url.trim());
                if (mediaUrls.length > 0) {
                  mediaHtml =
                    '<div style="margin: 12px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px;">';
                  mediaUrls.forEach((url: string) => {
                    const trimmedUrl = url.trim();
                    // Check if image or video
                    if (trimmedUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                      mediaHtml += `<img src="${trimmedUrl}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${trimmedUrl}', '_blank')" />`;
                    } else if (trimmedUrl.match(/\.(mp4|webm|ogg)$/i)) {
                      mediaHtml += `<video controls style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px;"><source src="${trimmedUrl}" /></video>`;
                    }
                  });
                  mediaHtml += "</div>";
                }
              }

              // Build audio player
              let audioHtml = "";
              if (poi.playAudioOnClick && poi.audioUrl) {
                audioHtml = `
                  <div style="margin: 12px 0;">
                    <audio controls style="width: 100%; height: 32px;">
                      <source src="${poi.audioUrl}" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                `;
              }

              // Build external link button
              let linkHtml = "";
              if (poi.storyContent && poi.storyContent.trim()) {
                const storyContent = JSON.parse(poi.storyContent);
                linkHtml = `
                  <div style="margin: 12px 0;">
                    <a href="${poi.storyContent}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">
                      ${storyContent.title}
                    </a>
                  </div>
                `;
              }

              const popupContent = `
                <div style="max-width: 300px; font-family: system-ui, -apple-system, sans-serif;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${poi.title
                }</h3>
                  <p style="margin: 8px 0; font-size: 14px; color: #333; white-space: pre-wrap;">${poi.slideContent || ""
                }</p>
                  ${mediaHtml}
                  ${audioHtml}
                  ${linkHtml}
                </div>
              `;

              marker.bindPopup(popupContent, {
                maxWidth: 320,
                className: "poi-popup",
              });
            }

            // Add marker to map
            marker.addTo(mapRef.current);
            poiMarkersRef.current.push(marker);
          } catch (error) {
            console.error(`❌ Failed to render POI ${poi.locationId} (${poi.title}):`, error);
          }
        }

        // Force map to refresh marker positions
        if (mapRef.current && poiMarkersRef.current.length > 0) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (mapRef.current && poiMarkersRef.current.length > 0) {
                mapRef.current.invalidateSize();

                poiMarkersRef.current.forEach((marker) => {
                  if (marker) {
                    const currentLatLng = marker.getLatLng();
                    marker.setLatLng(currentLatLng);
                  }
                });
              }
            });
          });
        }
      } catch (error) {
      }
    };

    loadAndRenderPois();

    // Listen for POI changes
    const handlePoiChange = () => {
      // CRITICAL FIX: Don't clear editing state here, let form close event handle it
      // This prevents flickering when location is updated but form is still open
      if (!cancelled && mapRef.current) {
        loadAndRenderPois();
      }
    };

    // CRITICAL FIX: Listen for repick location event to hide old marker when choosing new position
    const handleRepickLocation = (e: Event) => {
      const customEvent = e as CustomEvent;
      const locationId = customEvent.detail?.locationId;
      if (locationId) {
        editingLocationIdRef.current = locationId;
        // Re-render to hide the location being edited
        if (!cancelled && mapRef.current) {
          loadAndRenderPois();
        }
      }
    };

    // Listen for cancel edit to show location again
    const handleCancelEdit = () => {
      editingLocationIdRef.current = null;
      if (!cancelled && mapRef.current) {
        loadAndRenderPois();
      }
    };

    window.addEventListener("repickLocation", handleRepickLocation as EventListener);
    window.addEventListener("cancelLocationEdit", handleCancelEdit);
    window.addEventListener("locationCreated", handlePoiChange);
    window.addEventListener("locationUpdated", handlePoiChange);
    window.addEventListener("locationDeleted", handlePoiChange);
    // Legacy event names for backward compatibility
    window.addEventListener("poi:created", handlePoiChange);
    window.addEventListener("poi:updated", handlePoiChange);
    window.addEventListener("poi:deleted", handlePoiChange);

    return () => {
      cancelled = true;
      window.removeEventListener("repickLocation", handleRepickLocation as EventListener);
      window.removeEventListener("cancelLocationEdit", handleCancelEdit);
      window.removeEventListener("locationCreated", handlePoiChange);
      window.removeEventListener("locationUpdated", handlePoiChange);
      window.removeEventListener("locationDeleted", handlePoiChange);
      window.removeEventListener("poi:created", handlePoiChange);
      window.removeEventListener("poi:updated", handlePoiChange);
      window.removeEventListener("poi:deleted", handlePoiChange);
      poiMarkersRef.current.forEach((marker) => {
        try {
          mapRef.current?.removeLayer(marker);
        } catch { }
      });
      poiMarkersRef.current = [];
    };
  }, [mapId, isMapReady, mapRef, setPoiTooltipModal]);

  return {
    poiMarkersRef,
  };
}
