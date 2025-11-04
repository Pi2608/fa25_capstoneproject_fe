"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { TileLayer, LatLngTuple, FeatureGroup } from "leaflet";
import type L from "leaflet";
import type { MapWithPM, Layer } from "@/types";
import { getMapDetail, type MapDetail, type RawLayer } from "@/lib/api-maps";
import { getSegments, type Segment } from "@/lib/api-storymap";
import { getCustomMarkerIcon, getCustomDefaultIcon } from "@/constants/mapIcons";
import { loadLayerToMap } from "@/utils/mapUtils";

type StoryElement = {
  id: string;
  type: "layer" | "poi";
  name: string;
  layerId?: string;
  poiId?: string;
  displayOrder: number;
};

type TimelineSegment = Segment & {
  elements: StoryElement[];
};

export default function StoryMapPlayerPage() {
  const params = useParams<{ mapId: string }>();
  const mapId = params?.mapId ?? "";

  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [layers, setLayers] = useState<RawLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlled, setIsControlled] = useState(false); // Controlled by presenter
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Broadcast channel for receiving from control page
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const dataLayerRefs = useRef<Map<string, L.Layer>>(new Map());

  const currentSegment = segments[currentSegmentIndex];

  // Initialize broadcast channel to listen to control page
  useEffect(() => {
    if (typeof window !== 'undefined' && mapId) {
      broadcastRef.current = new BroadcastChannel(`storymap-${mapId}`);
      
      broadcastRef.current.onmessage = (event) => {
        console.log('[Viewer] Received broadcast:', event.data);
        
        if (event.data.type === 'segment-change') {
          setCurrentSegmentIndex(event.data.segmentIndex);
          setIsControlled(true);
        } else if (event.data.type === 'play-state') {
          setIsPlaying(event.data.isPlaying);
          setIsControlled(true);
        }
      };

      console.log('[Viewer] Listening to broadcast channel:', `storymap-${mapId}`);
    }

    return () => {
      broadcastRef.current?.close();
    };
  }, [mapId]);

  // Load map data
  useEffect(() => {
    if (!mapId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [mapDetail, segmentsData] = await Promise.all([
          getMapDetail(mapId),
          getSegments(mapId),
        ]);

        if (!alive) return;

        // Only show published maps
        if (mapDetail.status !== "Published") {
          setError("This map is not published yet");
          return;
        }

        setDetail(mapDetail);

        // Load layers
        if (mapDetail.layers) {
          setLayers(mapDetail.layers);
        }

        // Load elements for each segment
        const segmentsWithElements = await Promise.all(
          segmentsData.map(async (segment) => {
            try {
              // Import getSegmentLayers dynamically
              const { getSegmentLayers } = await import("@/lib/api-storymap");
              const segmentLayers = await getSegmentLayers(mapId, segment.segmentId);
              
              // Convert to StoryElement format
              const elements: StoryElement[] = segmentLayers.map((sl, index) => ({
                id: sl.segmentLayerId,
                type: "layer" as const,
                name: mapDetail.layers?.find(l => l.id === sl.layerId)?.name || "Layer",
                layerId: sl.layerId,
                displayOrder: sl.zIndex ?? index,
              }));

              return {
                ...segment,
                elements,
              };
            } catch (error) {
              console.error(`Failed to load elements for segment ${segment.name}:`, error);
              return {
                ...segment,
                elements: [],
              };
            }
          })
        );

        setSegments(segmentsWithElements);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load map");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mapId]);

  // Initialize map
  useEffect(() => {
    if (!detail || !mapEl.current || mapRef.current) return;
    let alive = true;
    const el = mapEl.current;

    (async () => {
      const L = (await import("leaflet")).default;

      // Set custom icons
      const customDefaultIcon = await getCustomDefaultIcon();
      const customMarkerIcon = await getCustomMarkerIcon();

      if (customDefaultIcon) {
        (L.Icon.Default as any) = L.Icon.extend({
          options: {
            iconSize: [12, 12],
            iconAnchor: [6, 6],
            popupAnchor: [0, -6],
            shadowSize: [0, 0],
            shadowAnchor: [0, 0],
          },
          _getIconUrl: function () {
            return "";
          },
          createIcon: function () {
            return customDefaultIcon.createIcon();
          },
          createShadow: function () {
            return null;
          },
        });
      }

      if (!alive || !el) return;

      const initialCenter: LatLngTuple = [
        Number(detail.initialLatitude ?? 14.058324),
        Number(detail.initialLongitude ?? 108.277199),
      ];
      const initialZoom = Number(detail.initialZoom ?? 6);

      const map = L.map(el, {
        zoomControl: false,
        minZoom: 2,
        maxZoom: 20,
        attributionControl: false,
      }).setView(initialCenter, initialZoom) as MapWithPM;

      mapRef.current = map;

      // Add base layer
      const baseKey =
        detail.baseMapProvider === "Satellite"
          ? "sat"
          : detail.baseMapProvider === "Dark"
          ? "dark"
          : "osm";

      const tiles: Record<string, string> = {
        osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        sat: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      };

      baseRef.current = L.tileLayer(tiles[baseKey], {
        attribution: "",
      }).addTo(map);

      // Load all layers initially (hidden)
      for (const layer of layers) {
        try {
          const success = await loadLayerToMap(map, layer, dataLayerRefs);
          if (!success) {
            console.warn(`Failed to load layer ${layer.name}`);
          }
          // Layers are added to map by loadLayerToMap, remove them initially
          const leafletLayer = dataLayerRefs.current.get(layer.id);
          if (leafletLayer && map.hasLayer(leafletLayer)) {
            map.removeLayer(leafletLayer);
          }
        } catch (error) {
          console.error(`Failed to load layer ${layer.name}:`, error);
        }
      }
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
    };
  }, [detail, layers]);

  // Handle segment changes - show/hide layers
  useEffect(() => {
    if (!currentSegment || !mapRef.current) return;

    const currentLayerIds = new Set(
      currentSegment.elements
        .filter((el) => el.type === "layer" && el.layerId)
        .map((el) => el.layerId!)
    );

    console.log(
      "[StoryMap Player] Showing layers for segment:",
      currentSegment.name,
      Array.from(currentLayerIds)
    );

    // Show/hide layers based on current segment
    dataLayerRefs.current.forEach((leafletLayer, layerId) => {
      const shouldShow = currentLayerIds.has(layerId);

      if (shouldShow) {
        if (!mapRef.current!.hasLayer(leafletLayer)) {
          mapRef.current!.addLayer(leafletLayer);
        }
      } else {
        if (mapRef.current!.hasLayer(leafletLayer)) {
          mapRef.current!.removeLayer(leafletLayer);
        }
      }
    });
  }, [currentSegment]);

  // Playback controls
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    playIntervalRef.current = setInterval(() => {
      setCurrentSegmentIndex((prev) => {
        if (prev >= segments.length - 1) {
          setIsPlaying(false);
          if (playIntervalRef.current) clearInterval(playIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 5000); // 5 seconds per segment
  }, [segments.length]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const handleNext = useCallback(() => {
    handlePause();
    setCurrentSegmentIndex((prev) => Math.min(prev + 1, segments.length - 1));
  }, [segments.length, handlePause]);

  const handlePrevious = useCallback(() => {
    handlePause();
    setCurrentSegmentIndex((prev) => Math.max(prev - 1, 0));
  }, [handlePause]);

  const handleGoToSegment = useCallback(
    (index: number) => {
      handlePause();
      setCurrentSegmentIndex(index);
    },
    [handlePause]
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-white text-xl">Loading Story Map...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <a
            href="/"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Go back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-zinc-900 overflow-hidden">
      {/* Map */}
      <div ref={mapEl} className="absolute inset-0 z-0" />

      {/* Header - Map Title */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {detail?.mapName || "Story Map"}
            </h1>
            {detail?.description && (
              <p className="text-zinc-300 text-sm">{detail.description}</p>
            )}
          </div>
          {isControlled && (
            <div className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE - Controlled by Presenter
            </div>
          )}
        </div>
      </div>

      {/* Segment Info Overlay */}
      {currentSegment && (
        <div className="absolute top-24 left-6 z-10 bg-black/80 backdrop-blur-lg rounded-lg p-6 max-w-md border border-zinc-700">
          <div className="text-xs text-emerald-400 mb-2">
            SEGMENT {currentSegmentIndex + 1} / {segments.length}
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {currentSegment.name}
          </h2>
          {currentSegment.summary && (
            <p className="text-zinc-300 text-sm mb-4">
              {currentSegment.summary}
            </p>
          )}
          {currentSegment.storyContent && (
            <div className="text-zinc-400 text-sm">
              {currentSegment.storyContent}
            </div>
          )}
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-300"
              style={{
                width: `${((currentSegmentIndex + 1) / segments.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Segment Thumbnails */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent">
          {segments.map((segment, index) => (
            <button
              key={segment.segmentId}
              onClick={() => handleGoToSegment(index)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all ${
                index === currentSegmentIndex
                  ? "bg-gradient-to-r from-purple-600 to-emerald-600 text-white shadow-lg"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              <div className="text-xs font-medium">{index + 1}</div>
              <div className="text-xs truncate max-w-[100px]">
                {segment.name}
              </div>
            </button>
          ))}
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Previous */}
          <button
            onClick={handlePrevious}
            disabled={currentSegmentIndex === 0 || isControlled}
            className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            title={isControlled ? "Controlled by presenter" : "Previous"}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={isControlled}
            className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isControlled ? "Controlled by presenter" : (isPlaying ? "Pause" : "Play")}
          >
            {isPlaying ? (
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 9v6m4-6v6"
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={handleNext}
            disabled={currentSegmentIndex === segments.length - 1 || isControlled}
            className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            title={isControlled ? "Controlled by presenter" : "Next"}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-zinc-700 mx-2" />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-all"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isFullscreen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              )}
            </svg>
          </button>

          {/* Close/Exit */}
          <button
            onClick={() => (window.location.href = "/")}
            className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition-all"
            title="Exit"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
