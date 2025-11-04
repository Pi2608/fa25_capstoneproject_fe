"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { FeatureGroup } from "leaflet";
import type L from "leaflet";
import type {
  BaseKey,
  LMap,
  MapWithPM,
  LeafletMouseEvent,
} from "@/types";

import {
  type FeatureData,
  loadFeaturesToMap,
  loadLayerToMap,
} from "@/utils/mapUtils";
import { getCustomMarkerIcon, getCustomDefaultIcon } from "@/constants/mapIcons";
import { StoryMapPlayer } from "@/components/storymap";
import { getMapDetail, MapDetail, MapStatus } from "@/lib/api-maps";

export default function ViewMapPage() {
  const params = useParams<{ mapId: string }>();
  const mapId = params?.mapId ?? "";

  const [isMapReady, setIsMapReady] = useState(false);
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("Draft");

  const [layers, setLayers] = useState<FeatureData[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const sketchRef = useRef<FeatureGroup | null>(null);
  const dataLayerRefs = useRef<Map<string, L.Layer>>(new Map());

  const applyBaseLayer = (key: BaseKey) => {
    if (!mapRef.current) return;
    if (baseRef.current) {
      try {
        mapRef.current.removeLayer(baseRef.current);
        baseRef.current = null;
      } catch (error) {
        console.warn("Failed to remove existing baseLayer:", error);
      }
    }

    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled) return;

        let layer: L.TileLayer;
        if (key === "sat") {
          layer = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 20, attribution: "Tiles © Esri" }
          );
        } else if (key === "dark") {
          layer = L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            { maxZoom: 20, attribution: "© OpenStreetMap contributors © CARTO" }
          );
        } else {
          layer = L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 20, attribution: "© OpenStreetMap contributors" }
          );
        }

        if (!cancelled && mapRef.current) {
          layer.addTo(mapRef.current as any);
          baseRef.current = layer;
        }
      } catch (error) {
        console.error("Failed to apply baseLayer:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (!mapId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const m = await getMapDetail(mapId);
        if (!alive) return;
        setDetail(m);
        setMapStatus(m.status || "Draft");
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Không tải được bản đồ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mapId]);

  useEffect(() => {
    if (!detail || !mapEl.current || mapRef.current) return;
    let alive = true;
    const el = mapEl.current;

    (async () => {
      const L = (await import("leaflet")).default;

      // Get custom icons
      const customDefaultIcon = await getCustomDefaultIcon();
      const customMarkerIcon = await getCustomMarkerIcon();

      if (customDefaultIcon) {
        (L.Icon.Default as any) = L.Icon.extend({
          options: {
            iconSize: [12, 12],
            iconAnchor: [6, 6],
            popupAnchor: [0, -6],
            shadowSize: [0, 0],
            shadowAnchor: [0, 0]
          },
          _getIconUrl: function() {
            return '';
          },
          createIcon: function() {
            return customDefaultIcon.createIcon();
          },
          createShadow: function() {
            return null;
          }
        });
      }

      if (!alive || !el) return;

      const VN_CENTER: [number, number] = [14.058324, 108.277199];
      const VN_ZOOM = 6;

      const rawLat = Number(detail.initialLatitude ?? 0);
      const rawLng = Number(detail.initialLongitude ?? 0);
      const rawZoom = Number(detail.initialZoom ?? 6);
      const isZeroZero = Math.abs(rawLat) < 1e-6 && Math.abs(rawLng) < 1e-6;

      const useVN = isZeroZero;
      const initialCenter: [number, number] = useVN ? VN_CENTER : [rawLat, rawLng];
      const initialZoom = useVN ? VN_ZOOM : Math.min(Math.max(rawZoom || VN_ZOOM, 3), 12);

      const map = L.map(el, { 
        zoomControl: false, 
        minZoom: 2, 
        maxZoom: 20,
        dragging: true,
        scrollWheelZoom: true,
      }).setView(initialCenter, initialZoom) as MapWithPM;
      
      mapRef.current = map;
      if (!alive) return;
      setIsMapReady(true);

      applyBaseLayer(detail.baseMapProvider === "Satellite" ? "sat" : detail.baseMapProvider === "Dark" ? "dark" : "osm");

      const sketch = L.featureGroup().addTo(map as any);
      sketchRef.current = sketch;

      try {
        const dbFeatures = await loadFeaturesToMap(detail.id, L, sketch);
        
        // Apply custom marker icons
        dbFeatures.forEach(feature => {
          if (feature.layer && feature.layer instanceof L.Marker && customMarkerIcon) {
            (feature.layer as any).setIcon(customMarkerIcon);
          }
        });
        
        setLayers(dbFeatures);
        const initialFeatureVisibility: Record<string, boolean> = {};
        dbFeatures.forEach(feature => {
          initialFeatureVisibility[feature.id] = feature.isVisible ?? true;
        });
        setLayerVisibility(initialFeatureVisibility);
      } catch (error) {
        console.error("Failed to load features:", error);
      }
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
      setIsMapReady(false);
    };
  }, [detail?.id, applyBaseLayer]);

  useEffect(() => {
    if (!mapRef.current || !detail?.layers || detail.layers.length === 0 || !isMapReady) return;
    const map = mapRef.current;

    let alive = true;

    (async () => {
      const initialLayerVisibility: Record<string, boolean> = {};

      for (const layer of detail.layers) {
        if (!alive) break;
        const isVisible = layer.isVisible ?? true;
        initialLayerVisibility[layer.id] = isVisible;

        try {
          const loaded = await loadLayerToMap(map as any, layer, dataLayerRefs);
          if (loaded && !isVisible) {
            const leafletLayer = dataLayerRefs.current.get(layer.id);
            if (leafletLayer && map.hasLayer(leafletLayer)) {
              map.removeLayer(leafletLayer);
            }
          }
        } catch (error) {
          console.error(`Error loading layer ${layer.name}:`, error);
        }
      }

      if (alive) setLayerVisibility(initialLayerVisibility);
    })();

    return () => {
      alive = false;
    };
  }, [detail?.layers, detail?.id, isMapReady]);

  useEffect(() => {
    if (!mapRef.current) return;

    Object.entries(layerVisibility).forEach(([layerId, isVisible]) => {
      const layerOnMap = dataLayerRefs.current.get(layerId);
      if (!layerOnMap) return;

      const isOnMap = mapRef.current!.hasLayer(layerOnMap);

      if (isVisible && !isOnMap) {
        mapRef.current!.addLayer(layerOnMap);
      } else if (!isVisible && isOnMap) {
        mapRef.current!.removeLayer(layerOnMap);
      }
    });
  }, [layerVisibility]);

  useEffect(() => {
    applyBaseLayer(detail?.baseMapProvider === "Satellite" ? "sat" : detail?.baseMapProvider === "Dark" ? "dark" : "osm");
  }, [detail?.baseMapProvider, applyBaseLayer]);

  const getStatusInfo = () => {
    switch (mapStatus) {
      case "Draft":
        return { label: "Nháp", color: "bg-gray-600" };
      case "UnderReview":
        return { label: "Đang xem xét", color: "bg-yellow-600" };
      case "Published":
        return { label: "Đã publish", color: "bg-green-600" };
      case "Unpublished":
        return { label: "Đã unpublish", color: "bg-orange-600" };
      case "Archived":
        return { label: "Đã archive", color: "bg-red-600" };
      default:
        return { label: "Unknown", color: "bg-gray-600" };
    }
  };

  const statusInfo = getStatusInfo();

  if (loading) {
    return (
      <main className="h-screen w-screen grid place-items-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Đang tải bản đồ...</p>
        </div>
      </main>
    );
  }

  if (err || !detail) {
    return (
      <main className="h-screen w-screen grid place-items-center bg-black text-red-300">
        <div className="text-center">
          <p className="text-2xl mb-2">❌</p>
          <p>{err ?? "Không tải được bản đồ"}</p>
        </div>
      </main>
    );
  }

  // Check if map is published
  if (mapStatus !== "Published") {
    return (
      <main className="h-screen w-screen grid place-items-center bg-black text-white">
        <div className="text-center max-w-md mx-auto px-4">
          <p className="text-6xl mb-4">🔒</p>
          <h1 className="text-2xl font-bold mb-2">Story Map chưa được publish</h1>
          <p className="text-gray-400 mb-6">
            Story Map này đang ở trạng thái <span className={`px-2 py-1 rounded ${statusInfo.color}`}>{statusInfo.label}</span> và chưa sẵn sàng để xem công khai.
          </p>
          <div className="space-y-2 text-left bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-gray-300">
              <strong>Trạng thái hiện tại:</strong> {statusInfo.label}
            </p>
            <p className="text-sm text-gray-300">
              <strong>Tên bản đồ:</strong> {detail.mapName}
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white"
          >
            Quay lại
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-[3000] pointer-events-none">
        <div className="pointer-events-auto bg-black/70 backdrop-blur-md ring-1 ring-white/15 shadow-xl py-3 px-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <h1 className="text-white font-bold text-lg">{detail.mapName}</h1>
              {detail.description && (
                <p className="text-gray-300 text-sm hidden md:block">{detail.description}</p>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color} text-white`}>
                ✓ {statusInfo.label}
              </span>
            </div>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-white text-sm font-medium transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapEl} className="absolute inset-0" />

      {/* Story Map Player */}
      <StoryMapPlayer mapId={mapId} />

      {/* Style */}
      <style jsx global>{`
        .leaflet-container { width: 100%; height: 100%; }
        .leaflet-control-container { z-index: 1000; }
      `}</style>
    </main>
  );
}

