"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import type { TileLayer } from "leaflet";
import type { MapWithPM } from "@/types";
import { useSegmentPlayback } from "@/hooks/useSegmentPlayback";
import { Segment, type Location, getRouteAnimationsBySegment, RouteAnimation } from "@/lib/api-storymap";
import SequentialRoutePlaybackWrapper from "@/components/storymap/SequentialRoutePlaybackWrapper";

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
  onLocationClick?: (location: Location) => void;
  onPlayingChange?: (isPlaying: boolean) => void; // Callback when play/pause state changes
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
  onLocationClick,
  onPlayingChange,
}: StoryMapViewerProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapWithPM | null>(null);
  const baseRef = useRef<TileLayer | null>(null);
  const [mapInstance, setMapInstance] = useState<MapWithPM | null>(null);

  const [currentSegmentLayers, setCurrentSegmentLayers] = useState<any[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // ========== CONTROLLED MODE STATE (for student view) ==========
  // Separate state for controlled mode - doesn't use playback hook's auto-advance
  const [controlledRouteAnimations, setControlledRouteAnimations] = useState<RouteAnimation[]>([]);
  const [controlledSegmentStartTime, setControlledSegmentStartTime] = useState<number>(0);
  const [isControlledPlaying, setIsControlledPlaying] = useState(false);
  const [isRouteAnimationsLoaded, setIsRouteAnimationsLoaded] = useState(false); // Track if animations are loaded
  const pendingPlayRef = useRef(false); // Track if we should play after loading
  const playStartTimeRef = useRef<number>(0); // Track when playback started to ignore rapid stop signals

  // Determine if we're in controlled mode (student view)
  const isControlledMode = controlledIndex !== undefined && !controlsEnabled;

  // Use the powerful segment playback hook (only for autonomous mode - teacher/preview)
  const playback = useSegmentPlayback({
    mapId,
    segments,
    currentMap: mapInstance,
    currentSegmentLayers,
    setCurrentSegmentLayers,
    setActiveSegmentId,
    onSegmentSelect: (segment) => {
      const index = segments.findIndex((s) => s.segmentId === segment.segmentId);
      onSegmentChange?.(segment, index);
    },
    onLocationClick,
  });

  const [playbackTime, setPlaybackTime] = useState(0);
  const totalDuration = segments.reduce((sum, seg) => sum + (seg.durationMs || 0), 0) / 1000;

  const formatTime = useCallback((seconds: number): string => {
    const safeSeconds = Math.max(0, seconds);
    const mins = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

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
      setMapInstance(map);

      // Add base layer - support all base layer types
      const baseLayerMap: Record<string, string> = {
        "OSM": "osm",
        "OpenStreetMap": "osm",
        "Satellite": "sat",
        "Dark": "dark",
        "Positron": "positron",
        "DarkMatter": "dark-matter",
        "Terrain": "terrain",
        "Toner": "toner",
        "Watercolor": "watercolor",
        "Topo": "topo",
      };
      
      const baseKey = baseLayerMap[baseMapProvider || "OSM"] || "osm";

      const baseLayerConfig: Record<string, { url: string; attribution: string; maxZoom?: number; subdomains?: string[] }> = {
        osm: {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
        },
        sat: {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attribution: "Tiles © Esri",
          maxZoom: 20,
        },
        dark: {
          url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 20,
          subdomains: ["a", "b", "c"],
        },
        positron: {
          url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 20,
          subdomains: ["a", "b", "c"],
        },
        "dark-matter": {
          url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 20,
          subdomains: ["a", "b", "c"],
        },
        terrain: {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
          attribution: "Tiles © Esri",
          maxZoom: 20,
        },
        toner: {
          url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
          attribution: "© OpenStreetMap contributors © CARTO",
          maxZoom: 20,
          subdomains: ["a", "b", "c"],
        },
        watercolor: {
          url: "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png",
          attribution: "© OpenStreetMap contributors, Tiles style by Wikimedia, under CC BY-SA",
          maxZoom: 19,
          subdomains: [],
        },
        topo: {
          url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
          attribution: "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)",
          maxZoom: 17,
          subdomains: [],
        },
      };

      const config = baseLayerConfig[baseKey] || baseLayerConfig["osm"];
      const tileLayerOptions: any = {
        attribution: config.attribution || "",
        maxZoom: config.maxZoom || 20,
      };
      
      if (config.subdomains !== undefined) {
        tileLayerOptions.subdomains = config.subdomains;
      } else if (baseKey !== "sat" && baseKey !== "terrain") {
        tileLayerOptions.subdomains = ["a", "b", "c"];
      }
      
      baseRef.current = L.tileLayer(config.url, tileLayerOptions).addTo(map);
      
      map.whenReady(() => {
        if (alive && mapRef.current === map) {
          setTimeout(() => {
            try {
              const size = map.getSize();
              const container = map.getContainer();
              if (size && size.x > 0 && size.y > 0 && container && container.offsetWidth > 0) {
                setIsMapReady(true);
              }
            } catch {
              // Will be checked by the checkMapReady interval below
            }
          }, 100);
        }
      });
    })();

    return () => {
      alive = false;
      setIsMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, [baseMapProvider]); // Only recreate map when baseMapProvider changes, not center/zoom

  // Track map ready state
  const [isMapReady, setIsMapReady] = useState(false);

  // Mark map as ready when it's initialized
  useEffect(() => {
    if (!mapRef.current) {
      setIsMapReady(false);
      return;
    }

    const checkMapReady = () => {
      try {
        const map = mapRef.current;
        if (map && map.getContainer()) {
          const container = map.getContainer();
          const size = map.getSize();
          if (size && size.x > 0 && size.y > 0 && container.offsetWidth > 0) {
            setIsMapReady(true);
            return true;
          }
        }
      } catch {
        // Map not ready yet
      }
      return false;
    };

    if (checkMapReady()) {
      return;
    }

    const interval = setInterval(() => {
      if (checkMapReady()) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [baseMapProvider]); // Only check when baseMapProvider changes

  // Track if initial view has been set (to avoid resetting map on prop changes)
  const initialViewSetRef = useRef(false);

  // Reset initial view flag when base map provider changes (map gets recreated)
  useEffect(() => {
    initialViewSetRef.current = false;
  }, [baseMapProvider]);

  // Set initial view ONLY once when map is first ready
  // After that, segment changes will control the view
  useEffect(() => {
    if (!mapRef.current || !isMapReady || initialViewSetRef.current) return;

    // Only set initial view once when map first becomes ready
    try {
      console.log("[StoryMapViewer] Setting initial map view:", initialCenter, initialZoom);
      mapRef.current.setView(initialCenter, initialZoom, { animate: false });
      initialViewSetRef.current = true;
    } catch (e) {
      console.error("Failed to set initial view:", e);
    }
  }, [isMapReady]); // Only depend on isMapReady, not initialCenter/Zoom

  // Track last viewed segment index to prevent re-rendering the same segment
  const lastViewedIndexRef = useRef<number | null>(null);
  const segmentsRef = useRef<Segment[]>(segments);
  const handleViewSegmentRef = useRef<((segment: Segment, opts?: any) => void) | null>(null);
  
  // Update refs when they change
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    handleViewSegmentRef.current = playback.handleViewSegment;
  }, [playback.handleViewSegment]);

  // ========== CONTROLLED MODE: Sync segment from teacher ==========
  useEffect(() => {
    // Only for controlled mode (student view)
    if (!isControlledMode) return;
    
    if (
      controlledIndex !== undefined && 
      controlledIndex >= 0 && 
      segmentsRef.current.length > 0 &&
      segmentsRef.current[controlledIndex] && 
      isMapReady && 
      mapInstance &&
      handleViewSegmentRef.current &&
      lastViewedIndexRef.current !== controlledIndex
    ) {
      const currentIndex = controlledIndex;
      lastViewedIndexRef.current = currentIndex;
      
      // Small delay to ensure map is fully rendered
      const timer = setTimeout(() => {
        if (mapInstance && mapEl.current && segmentsRef.current[currentIndex] && handleViewSegmentRef.current) {
          console.log("[StoryMapViewer] Controlled mode: viewing segment", currentIndex);
          // Use smooth Fly animation matching EditMapPage behavior
          handleViewSegmentRef.current(segmentsRef.current[currentIndex], {
            cameraAnimationType: 'Fly',
            cameraAnimationDurationMs: 1500,
            transitionType: 'Ease',
            durationMs: 800,
          });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [controlledIndex, isMapReady, isControlledMode, mapInstance]);

  // ========== CONTROLLED MODE: Load route animations when segment changes ==========
  useEffect(() => {
    console.log("[StoryMapViewer] Route animations effect - isControlledMode:", isControlledMode, 
      "controlledIndex:", controlledIndex, 
      "segments:", segmentsRef.current.length);
    
    if (!isControlledMode) {
      console.log("[StoryMapViewer] Skipping - not in controlled mode");
      return;
    }
    if (controlledIndex === undefined || controlledIndex < 0) {
      console.log("[StoryMapViewer] Skipping - invalid controlledIndex");
      return;
    }
    if (!segmentsRef.current[controlledIndex]) {
      console.log("[StoryMapViewer] Skipping - segment not found at index", controlledIndex);
      return;
    }

    const currentSegment = segmentsRef.current[controlledIndex];
    console.log("[StoryMapViewer] Loading route animations for segment:", currentSegment.segmentId);
    
    // Reset loading state
    setIsRouteAnimationsLoaded(false);
    
    let cancelled = false;

    (async () => {
      try {
        console.log("[StoryMapViewer] Calling getRouteAnimationsBySegment API...");
        const animations = await getRouteAnimationsBySegment(mapId, currentSegment.segmentId);
        console.log("[StoryMapViewer] API returned:", animations?.length || 0, "route animations");
        
        if (!cancelled) {
          const sortedAnimations = (animations || []).sort((a, b) => {
            if (a.displayOrder !== b.displayOrder) {
              return a.displayOrder - b.displayOrder;
            }
            if (a.startTimeMs !== undefined && b.startTimeMs !== undefined) {
              return a.startTimeMs - b.startTimeMs;
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          console.log("[StoryMapViewer] Controlled mode: loaded", sortedAnimations.length, "route animations");
          setControlledRouteAnimations(sortedAnimations);
          setIsRouteAnimationsLoaded(true);
          
          // If we have a pending play request, start playing now
          if (pendingPlayRef.current) {
            console.log("[StoryMapViewer] Starting pending playback after animations loaded");
            pendingPlayRef.current = false;
            setIsControlledPlaying(true);
            setControlledSegmentStartTime(Date.now());
            playStartTimeRef.current = Date.now(); // Track start time
          }
        }
      } catch (e) {
        console.error("[StoryMapViewer] Failed to load route animations:", e);
        if (!cancelled) {
          setControlledRouteAnimations([]);
          setIsRouteAnimationsLoaded(true); // Mark as loaded even on error so playback can proceed
          
          if (pendingPlayRef.current) {
            pendingPlayRef.current = false;
            setIsControlledPlaying(true);
            setControlledSegmentStartTime(Date.now());
            playStartTimeRef.current = Date.now(); // Track start time
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mapId, controlledIndex, isControlledMode]);

  // Track previous segment index to detect changes
  const prevControlledIndexRef = useRef<number | undefined>(undefined);

  // Track previous play state to detect changes
  const prevControlledPlayingRef = useRef<boolean | undefined>(undefined);

  // ========== CONTROLLED MODE: Handle play/pause from teacher ==========
  useEffect(() => {
    if (!isControlledMode) return;

    // Check if segment changed
    const segmentChanged = prevControlledIndexRef.current !== undefined &&
                           prevControlledIndexRef.current !== controlledIndex;

    // Check if play state changed
    const playStateChanged = prevControlledPlayingRef.current !== undefined &&
                            prevControlledPlayingRef.current !== controlledPlaying;

    // Update refs
    prevControlledIndexRef.current = controlledIndex;
    prevControlledPlayingRef.current = controlledPlaying;

    // If segment changed, reset playback state first
    if (segmentChanged) {
      console.log("[StoryMapViewer] Controlled mode: segment changed from", prevControlledIndexRef.current, "to", controlledIndex);
      setIsControlledPlaying(false);
      setControlledSegmentStartTime(0);
      pendingPlayRef.current = false;
      playStartTimeRef.current = 0;
      return; // Don't process play/pause in same effect run
    }

    // Only process if play state actually changed
    if (!playStateChanged) {
      return;
    }

    // Handle play/pause from teacher
    if (controlledPlaying !== undefined) {
      console.log("[StoryMapViewer] Controlled mode: controlledPlaying changed to", controlledPlaying,
        "isRouteAnimationsLoaded =", isRouteAnimationsLoaded,
        "isControlledPlaying =", isControlledPlaying);

      if (controlledPlaying) {
        // Check if route animations are loaded
        if (isRouteAnimationsLoaded) {
          // Start playback immediately
          console.log("[StoryMapViewer] Starting playback (animations loaded)");
          setIsControlledPlaying(true);
          setControlledSegmentStartTime(Date.now());
          playStartTimeRef.current = Date.now();
        } else {
          // Set pending flag - will start when animations are loaded
          console.log("[StoryMapViewer] Animations not loaded yet, setting pending play");
          pendingPlayRef.current = true;
        }
      } else {
        // Teacher wants to stop
        // Only stop if we were actually playing
        if (isControlledPlaying) {
          console.log("[StoryMapViewer] Stopping playback");
          setIsControlledPlaying(false);
          pendingPlayRef.current = false;
          playStartTimeRef.current = 0;
        } else {
          console.log("[StoryMapViewer] Ignoring stop - not currently playing");
        }
        // Don't reset segmentStartTime on pause - allows resume from current position
      }
    }
  }, [controlledPlaying, controlledIndex, isControlledMode, isRouteAnimationsLoaded, isControlledPlaying]);

  // ========== AUTONOMOUS MODE: Sync with external control (for teacher preview) ==========
  useEffect(() => {
    // Only for autonomous mode (teacher/control page with controlsEnabled = true)
    if (isControlledMode) return;
    
    if (
      controlledIndex !== undefined && 
      controlledIndex >= 0 && 
      segmentsRef.current.length > 0 &&
      segmentsRef.current[controlledIndex] && 
      isMapReady && 
      mapInstance &&
      handleViewSegmentRef.current &&
      lastViewedIndexRef.current !== controlledIndex
    ) {
      const currentIndex = controlledIndex;
      lastViewedIndexRef.current = currentIndex;
      
      const timer = setTimeout(() => {
        if (mapInstance && mapEl.current && segmentsRef.current[currentIndex] && handleViewSegmentRef.current) {
          // Use smooth Fly animation matching EditMapPage behavior
          handleViewSegmentRef.current(segmentsRef.current[currentIndex], {
            cameraAnimationType: 'Fly',
            cameraAnimationDurationMs: 1500,
            transitionType: 'Ease',
            durationMs: 800,
          });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [controlledIndex, isMapReady, isControlledMode, mapInstance]);

  // ========== AUTONOMOUS MODE: Handle play/pause ==========
  useEffect(() => {
    // Only for autonomous mode
    if (isControlledMode) return;

    if (controlledPlaying !== undefined) {
      if (controlledPlaying && !playback.isPlaying) {
        playback.handlePlayPreview(controlledIndex);
      } else if (!controlledPlaying && playback.isPlaying) {
        playback.handleStopPreview();
      }
    }
  }, [controlledPlaying, controlledIndex, playback.isPlaying, isControlledMode]);

  // Notify parent when play/pause state changes (for teacher control page)
  useEffect(() => {
    if (controlsEnabled && onPlayingChange) {
      onPlayingChange(playback.isPlaying);
    }
  }, [playback.isPlaying, controlsEnabled, onPlayingChange]);

  // ========== Determine which route animations to use ==========
  const activeRouteAnimations = isControlledMode ? controlledRouteAnimations : playback.routeAnimations;
  const activeSegmentStartTime = isControlledMode ? controlledSegmentStartTime : playback.segmentStartTime;
  const activeIsPlaying = isControlledMode ? isControlledPlaying : playback.isPlaying;

  useEffect(() => {
    if (!playback.isPlaying || segments.length === 0) {
      setPlaybackTime(0);
      return;
    }

    let rafId: number;
    let baseTime = 0;
    for (let i = 0; i < playback.currentPlayIndex && i < segments.length; i++) {
      baseTime += (segments[i].durationMs ?? 0) / 1000;
    }

    const updateTime = () => {
      const elapsed = playback.segmentStartTime ? (Date.now() - playback.segmentStartTime) / 1000 : 0;
      setPlaybackTime(baseTime + Math.max(0, elapsed));
      rafId = requestAnimationFrame(updateTime);
    };

    updateTime();

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [playback.isPlaying, playback.currentPlayIndex, playback.segmentStartTime, segments]);

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapEl} className="w-full h-full" />

      {/* Continue Button Overlay (when requireUserAction = true) - Only for autonomous mode */}
      {!isControlledMode && playback.waitingForUserAction && playback.currentTransition && (
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

      {/* Route Animations with Sequential Playback */}
      {activeRouteAnimations && activeRouteAnimations.length > 0 && mapInstance && (
        <SequentialRoutePlaybackWrapper
          map={mapInstance}
          routeAnimations={activeRouteAnimations}
          isPlaying={activeIsPlaying}
          segmentStartTime={activeSegmentStartTime}
          onLocationClick={onLocationClick}
          // FIXED: Disable camera state changes after route completion in controlled mode
          // This prevents the map from jumping to a different location after routes complete
          disableCameraStateAfter={isControlledMode}
        />
      )}

      {/* Playback Controls (hidden when controlsEnabled = false) */}
      {controlsEnabled && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-6 py-3 flex items-center gap-4 shadow-xl">
          <button
            onClick={
              playback.isPlaying
                ? playback.handleStopPreview
                : () => playback.handlePlayPreview()
            }
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
          <button
            onClick={playback.handleStopPreview}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
            title="Stop"
          >
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
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