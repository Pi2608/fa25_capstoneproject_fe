"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { TileLayer } from "leaflet";
import type { MapWithPM } from "@/types";
import { useSegmentPlayback } from "@/hooks/useSegmentPlayback";
import { Segment } from "@/lib/api-storymap";

type StoryMapViewerProps = {
  mapId: string;
  segments: Segment[];
  baseMapProvider?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  onSegmentChange?: (segment: Segment, index: number) => void;
  controlledIndex?: number; // For control page synchronization
  controlledPlaying?: boolean;
  controlsEnabled?: boolean;
};

export default function StoryMapViewer({
  mapId,
  segments,
  baseMapProvider = "OpenStreetMap",
  initialCenter = [10.8231, 106.6297],
  initialZoom = 10,
  onSegmentChange,
  controlledIndex,
  controlledPlaying,
  controlsEnabled = true,
}: StoryMapViewerProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);

  const [currentSegmentLayers, setCurrentSegmentLayers] = useState<any[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Use the powerful segment playback hook
  const playback = useSegmentPlayback({
    mapId,
    segments,
    currentMap: mapRef.current,
    currentSegmentLayers,
    setCurrentSegmentLayers,
    setActiveSegmentId,
    onSegmentSelect: (segment) => {
      const index = segments.findIndex((s) => s.segmentId === segment.segmentId);
      onSegmentChange?.(segment, index);
    },
  });

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    let alive = true;

    (async () => {
      const L = (await import("leaflet")).default;

      if (!alive || !mapEl.current) return;

      const map = L.map(mapEl.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: false,
      }) as MapWithPM;

      mapRef.current = map;

      // Add base layer
      const baseKey =
        baseMapProvider === "Satellite"
          ? "sat"
          : baseMapProvider === "Dark"
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
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [baseMapProvider, initialCenter, initialZoom]);

  // Sync with external control (for control page)
  useEffect(() => {
    if (controlledIndex !== undefined && segments[controlledIndex]) {
      playback.handleViewSegment(segments[controlledIndex]);
    }
  }, [controlledIndex, segments]);

  useEffect(() => {
    if (controlledPlaying !== undefined) {
      if (controlledPlaying && !playback.isPlaying) {
        playback.handlePlayPreview();
      } else if (!controlledPlaying && playback.isPlaying) {
        playback.handleStopPreview();
      }
    }
  }, [controlledPlaying]);

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapEl} className="w-full h-full" />

      {/* Continue Button Overlay (when requireUserAction = true) */}
      {playback.waitingForUserAction && playback.currentTransition && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-800 border-2 border-zinc-700 rounded-xl p-8 shadow-2xl max-w-lg mx-4 transform transition-all">
            {playback.currentTransition.showOverlay && playback.currentTransition.overlayContent && (
              <div className="mb-6 text-zinc-200 text-center">
                <div className="text-2xl font-bold mb-3 text-white">
                  {playback.currentTransition.transitionName || "Story Continues"}
                </div>
                <div className="text-base leading-relaxed whitespace-pre-wrap">
                  {playback.currentTransition.overlayContent}
                </div>
              </div>
            )}
            
            <button
              onClick={playback.handleContinueAfterUserAction}
              className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-lg font-semibold rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              {playback.currentTransition.triggerButtonText || "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Playback Controls (hidden when controlsEnabled = false) */}
      {controlsEnabled && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-6 py-3 flex items-center gap-4 shadow-xl">
          <button
            onClick={playback.isPlaying ? playback.handleStopPreview : playback.handlePlayPreview}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
            title={playback.isPlaying ? "Pause" : "Play"}
          >
            {playback.isPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="text-white text-sm font-medium">
            {playback.currentPlayIndex + 1} / {segments.length}
          </div>

          <button
            onClick={playback.handleClearMap}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
            title="Clear Map"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}