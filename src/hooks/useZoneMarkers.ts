import { useEffect, useRef } from "react";
import type L from "leaflet";
import type { MapWithPM } from "@/types";
import { getMapZones, type MapZone } from "@/lib/api-maps";

interface UseZoneMarkersParams {
    mapId: string;
    mapRef: React.MutableRefObject<MapWithPM | null>;
    isMapReady: boolean;
}

/**
 * Custom hook to manage Zone rendering on the map
 * Handles loading, rendering, and lifecycle of Zone GeoJSON layers
 */
export function useZoneMarkers({
    mapId,
    mapRef,
    isMapReady,
}: UseZoneMarkersParams) {
    const zoneLayersRef = useRef<L.GeoJSON[]>([]);

    useEffect(() => {
        if (!mapRef.current || !mapId || !isMapReady) return;

        let cancelled = false;

        const loadAndRenderZones = async () => {
            try {
                // Clear existing zone layers
                zoneLayersRef.current.forEach((layer) => {
                    try {
                        mapRef.current?.removeLayer(layer);
                    } catch { }
                });
                zoneLayersRef.current = [];

                // Load zones
                const mapZones = await getMapZones(mapId);
                if (cancelled || !mapRef.current) {
                    return;
                }

                const L = (await import("leaflet")).default;

                // Render each zone
                for (const mapZone of mapZones) {
                    if (cancelled || !mapRef.current) break;

                    try {
                        if (mapZone.isVisible === false) {
                            continue;
                        }

                        const zone = mapZone.zone;
                        if (!zone || !zone.geometry) {
                            continue;
                        }

                        let geoJsonData;
                        try {
                            geoJsonData = JSON.parse(zone.geometry);
                        } catch (parseError) {
                            console.error(`Failed to parse zone geometry for ${zone.name}:`, parseError);
                            continue;
                        }

                        // Create GeoJSON layer with styling
                        const geoJsonLayer = L.geoJSON(geoJsonData, {
                            style: () => ({
                                color: mapZone.boundaryColor || "#3388ff",
                                weight: mapZone.boundaryWidth || 2,
                                opacity: mapZone.highlightBoundary ? 1 : 0.5,
                                fillColor: mapZone.fillColor || "#3388ff",
                                fillOpacity: mapZone.fillZone ? (mapZone.fillOpacity || 0.2) : 0,
                            }),
                        });

                        // Store zone ID for cleanup
                        (geoJsonLayer as any)._mapZoneId = mapZone.mapZoneId;

                        // Add label if enabled
                        if (mapZone.showLabel) {
                            const labelText = mapZone.labelOverride || zone.name || "";
                            if (labelText) {
                                geoJsonLayer.bindTooltip(labelText, {
                                    permanent: true,
                                    direction: "center",
                                    className: "zone-label-tooltip",
                                    opacity: 0.9,
                                });
                            }
                        }

                        // Add popup with zone info
                        geoJsonLayer.bindPopup(`
              <div style="font-family: system-ui, sans-serif;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${zone.name}</h3>
                ${zone.description ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">${zone.description}</p>` : ""}
                <p style="margin: 4px 0; font-size: 11px; color: #999;">Type: ${zone.zoneType}</p>
              </div>
            `);

                        // Add click handler for zone selection (opens PropertiesPanel)
                        geoJsonLayer.on('click', () => {
                            window.dispatchEvent(new CustomEvent("selectZone", {
                                detail: {
                                    mapZone,
                                    zone,
                                }
                            }));
                        });

                        // Add layer to map
                        geoJsonLayer.addTo(mapRef.current);
                        zoneLayersRef.current.push(geoJsonLayer);
                    } catch (error) {
                        console.error(`Failed to render zone ${mapZone.mapZoneId}:`, error);
                    }
                }
            } catch (error) {
                console.error("Failed to load zones:", error);
            }
        };

        loadAndRenderZones();

        // Listen for zone changes
        const handleZoneChange = () => {
            if (!cancelled && mapRef.current) {
                loadAndRenderZones();
            }
        };

        window.addEventListener("refreshMapZones", handleZoneChange);
        window.addEventListener("zoneCreated", handleZoneChange);
        window.addEventListener("zoneUpdated", handleZoneChange);
        window.addEventListener("zoneDeleted", handleZoneChange);

        return () => {
            cancelled = true;
            window.removeEventListener("refreshMapZones", handleZoneChange);
            window.removeEventListener("zoneCreated", handleZoneChange);
            window.removeEventListener("zoneUpdated", handleZoneChange);
            window.removeEventListener("zoneDeleted", handleZoneChange);
            zoneLayersRef.current.forEach((layer) => {
                try {
                    mapRef.current?.removeLayer(layer);
                } catch { }
            });
            zoneLayersRef.current = [];
        };
    }, [mapId, isMapReady, mapRef]);

    return {
        zoneLayersRef,
    };
}
