"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { TileLayer, LatLngTuple } from "leaflet";
import type L from "leaflet";
import type { MapWithPM, Layer } from "@/types";
import { getMapDetail, type MapDetail, type RawLayer } from "@/lib/api-maps";
import { getCustomMarkerIcon, getCustomDefaultIcon } from "@/constants/mapIcons";
import { loadLayerToMap } from "@/utils/mapUtils";
import { getSegments, Segment } from "@/lib/api-storymap";

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

export default function StoryMapControlPage() {
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
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Broadcast channel for syncing with viewer
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const dataLayerRefs = useRef<Map<string, L.Layer>>(new Map());

  const currentSegment = segments[currentSegmentIndex];

  // Initialize broadcast channel
  useEffect(() => {
    if (typeof window !== 'undefined' && mapId) {
      broadcastRef.current = new BroadcastChannel(`storymap-${mapId}`);
      console.log('[Control] Broadcast channel created:', `storymap-${mapId}`);
    }

    return () => {
      broadcastRef.current?.close();
    };
  }, [mapId]);

  // Broadcast segment changes to viewers
  const broadcastSegmentChange = useCallback((index: number) => {
    if (broadcastRef.current && segments[index]) {
      const message = {
        type: 'segment-change',
        segmentIndex: index,
        segment: segments[index],
        timestamp: Date.now(),
      };
      broadcastRef.current.postMessage(message);
      console.log('[Control] Broadcasting segment change:', index);
    }
  }, [segments]);

  // Broadcast play state
  const broadcastPlayState = useCallback((playing: boolean) => {
    if (broadcastRef.current) {
      const message = {
        type: 'play-state',
        isPlaying: playing,
        timestamp: Date.now(),
      };
      broadcastRef.current.postMessage(message);
      console.log('[Control] Broadcasting play state:', playing);
    }
  }, []);

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
              const { getSegmentLayers } = await import("@/lib/api-poi");
              const segmentLayers = await getSegmentLayers(mapId, segment.segmentId);
              
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
        zoomControl: true,
        minZoom: 2,
        maxZoom: 20,
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
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Load all layers
      for (const layer of layers) {
        try {
          const success = await loadLayerToMap(map, layer, dataLayerRefs);
          if (!success) {
            console.warn(`Failed to load layer ${layer.name}`);
          }
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

  // Handle segment changes - show/hide layers + broadcast
  useEffect(() => {
    if (!currentSegment || !mapRef.current) return;

    const currentLayerIds = new Set(
      currentSegment.elements
        .filter((el) => el.type === "layer" && el.layerId)
        .map((el) => el.layerId!)
    );

    console.log(
      "[Control] Showing layers for segment:",
      currentSegment.name,
      Array.from(currentLayerIds)
    );

    // Show/hide layers
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

    // Broadcast to viewers
    broadcastSegmentChange(currentSegmentIndex);
  }, [currentSegment, currentSegmentIndex, broadcastSegmentChange]);

  // Playback controls
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    broadcastPlayState(true);
    playIntervalRef.current = setInterval(() => {
      setCurrentSegmentIndex((prev) => {
        if (prev >= segments.length - 1) {
          setIsPlaying(false);
          broadcastPlayState(false);
          if (playIntervalRef.current) clearInterval(playIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 5000);
  }, [segments.length, broadcastPlayState]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    broadcastPlayState(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, [broadcastPlayState]);

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

  // Copy viewer URL
  const copyViewerUrl = useCallback(() => {
    const viewerUrl = `${window.location.origin}/storymap/${mapId}`;
    navigator.clipboard.writeText(viewerUrl);
    alert('Viewer URL copied to clipboard!');
  }, [mapId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-white text-xl">Loading Control Panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <a href="/" className="text-blue-400 hover:text-blue-300 underline">
            Go back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-900">
      {/* Left: Map Preview (smaller) */}
      <div className="w-2/3 relative border-r border-zinc-700">
        <div ref={mapEl} className="absolute inset-0" />
        
        {/* Overlay indicator */}
        <div className="absolute top-4 left-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg font-semibold z-10">
          🎮 CONTROL MODE
        </div>
      </div>

      {/* Right: Control Panel */}
      <div className="w-1/3 flex flex-col bg-zinc-800">
        {/* Header */}
        <div className="p-6 border-b border-zinc-700">
          <h1 className="text-2xl font-bold text-white mb-2">
            {detail?.mapName || "Story Map"}
          </h1>
          <p className="text-sm text-zinc-400 mb-4">
            Control playback and broadcast to viewers
          </p>
          
          {/* Viewer URL */}
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/storymap/${mapId}`}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-300"
            />
            <button
              onClick={copyViewerUrl}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
              title="Copy viewer URL"
            >
              📋 Copy
            </button>
          </div>
        </div>

        {/* Current Segment Info */}
        <div className="p-6 border-b border-zinc-700">
          {currentSegment && (
            <>
              <div className="text-xs text-emerald-400 mb-2">
                SEGMENT {currentSegmentIndex + 1} / {segments.length}
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {currentSegment.name}
              </h2>
              {currentSegment.description && (
                <p className="text-sm text-zinc-400 mb-3">
                  {currentSegment.description}
                </p>
              )}
              {currentSegment.storyContent && (
                <div className="text-sm text-zinc-500 max-h-24 overflow-y-auto">
                  {currentSegment.storyContent}
                </div>
              )}
            </>
          )}
        </div>

        {/* Playback Controls */}
        <div className="p-6 border-b border-zinc-700">
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

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentSegmentIndex === 0}
              className="p-3 rounded-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white shadow-lg"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleNext}
              disabled={currentSegmentIndex === segments.length - 1}
              className="p-3 rounded-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Segments List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3">SEGMENTS</h3>
          <div className="space-y-2">
            {segments.map((segment, index) => (
              <button
                key={segment.segmentId}
                onClick={() => handleGoToSegment(index)}
                className={`w-full text-left p-4 rounded-lg transition-all ${
                  index === currentSegmentIndex
                    ? "bg-gradient-to-r from-purple-600 to-emerald-600 text-white shadow-lg"
                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{segment.name}</div>
                    {segment.description && (
                      <div className="text-xs opacity-70 truncate">
                        {segment.description}
                      </div>
                    )}
                  </div>
                  {index === currentSegmentIndex && (
                    <div className="flex-shrink-0 text-emerald-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700">
          <button
            onClick={() => (window.location.href = `/maps/${mapId}`)}
            className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded"
          >
            Back to Editor
          </button>
        </div>
      </div>
    </div>
  );
}
