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
  pinAnswerMode?: boolean;
  pinAnswerLocation?: { latitude: number; longitude: number } | null;
  onPinAnswerLocation?: (lat: number, lng: number) => void;
};

// FIX: Định nghĩa hằng số cho timing
const SEGMENT_FLY_ANIMATION_MS = 1500; // Thời gian fly animation trong handleViewSegment
const SEGMENT_TRANSITION_DELAY_MS = 100; // Delay trước khi gọi handleViewSegment
const ROUTE_ANIMATION_DELAY_MS = 2000; // Tổng delay = 100 + 1500 + buffer 400ms

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
  pinAnswerMode = false,
  pinAnswerLocation: _pinAnswerLocation = null,
  onPinAnswerLocation,
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
  const [isSegmentTransitioning, setIsSegmentTransitioning] = useState(false); // Track if segment is transitioning
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

  // Enable pin-on-map selection when requested.
  useEffect(() => {
    if (!mapInstance) return;
    if (!pinAnswerMode || !onPinAnswerLocation) return;

    const handler = (e: any) => {
      const lat = e?.latlng?.lat;
      const lng = e?.latlng?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        onPinAnswerLocation(lat, lng);
      }
    };

    mapInstance.on("click", handler);
    return () => {
      mapInstance.off("click", handler);
    };
  }, [mapInstance, pinAnswerMode, onPinAnswerLocation]);

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
        // Support lowercase keys directly
        "osm": "osm",
        "sat": "sat",
        "dark": "dark",
        "positron": "positron",
        "dark-matter": "dark-matter",
        "terrain": "terrain",
        "toner": "toner",
        "watercolor": "watercolor",
        "topo": "topo",
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

      console.log("[StoryMapViewer] Controlled mode: Flying to segment", currentIndex);

      // Small delay to ensure map is fully rendered
      const timer = setTimeout(() => {
        if (mapInstance && mapEl.current && segmentsRef.current[currentIndex] && handleViewSegmentRef.current) {
          // Use smooth Fly animation matching EditMapPage behavior
          handleViewSegmentRef.current(segmentsRef.current[currentIndex], {
            cameraAnimationType: 'Fly',
            cameraAnimationDurationMs: SEGMENT_FLY_ANIMATION_MS,
            transitionType: 'Ease',
            durationMs: 800,
          });
        }
      }, SEGMENT_TRANSITION_DELAY_MS);

      return () => clearTimeout(timer);
    }
  }, [controlledIndex, isMapReady, isControlledMode, mapInstance]);

  // Track last segments data to detect changes (without causing re-renders)
  const lastSegmentsDataRef = useRef<string>('');

  // Update segments data hash when segments change
  useEffect(() => {
    if (!isControlledMode) return;

    const currentSegment = segmentsRef.current[controlledIndex ?? -1];
    const segmentsDataHash = currentSegment
      ? JSON.stringify({
        segmentId: currentSegment.segmentId,
        zonesCount: currentSegment.zones?.length || 0,
        layersCount: currentSegment.layers?.length || 0,
        locationsCount: currentSegment.locations?.length || 0,
      })
      : '';

    const segmentsChanged = segmentsDataHash !== lastSegmentsDataRef.current;

    if (segmentsChanged && controlledIndex !== undefined && controlledIndex >= 0 &&
      segmentsRef.current[controlledIndex] && isMapReady && mapInstance && handleViewSegmentRef.current) {
      lastSegmentsDataRef.current = segmentsDataHash;

      // Re-render segment with updated data (skip camera to avoid jumping)
      const timer = setTimeout(() => {
        if (mapInstance && mapEl.current && segmentsRef.current[controlledIndex] && handleViewSegmentRef.current) {
          handleViewSegmentRef.current(segmentsRef.current[controlledIndex], {
            skipCameraState: true,
            transitionType: 'Ease',
            durationMs: 300,
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [segments, controlledIndex, isMapReady, isControlledMode, mapInstance]);

  // ========== CONTROLLED MODE: Load route animations when segment changes ==========
  useEffect(() => {
    if (!isControlledMode) {
      return;
    }
    if (controlledIndex === undefined || controlledIndex < 0) {
      setControlledRouteAnimations([]); // Clear khi invalid
      return;
    }
    if (!segmentsRef.current[controlledIndex]) {
      setControlledRouteAnimations([]); // Clear khi không tìm thấy
      return;
    }

    const currentSegment = segmentsRef.current[controlledIndex];

    console.log("[StoryMapViewer] Loading route animations for segment:", currentSegment.segmentId);

    // ============================================================
    // CRITICAL FIX: Clear route animations NGAY LẬP TỨC khi segment thay đổi
    // Điều này ngăn RouteAnimation cũ apply followCameraZoom
    // ============================================================
    setControlledRouteAnimations([]); // Clear ngay!
    setIsRouteAnimationsLoaded(false);
    setIsSegmentTransitioning(true); // Đánh dấu đang transition

    let cancelled = false;

    (async () => {
      try {
        const animations = await getRouteAnimationsBySegment(mapId, currentSegment.segmentId);

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

          console.log("[StoryMapViewer] Loaded", sortedAnimations.length, "route animations, waiting for segment fly animation...");

          // ============================================================
          // FIX: Tăng delay lên 2000ms để đảm bảo fly animation của segment
          // đã hoàn thành trước khi render route animations
          // Timing: 100ms (delay) + 1500ms (fly) + 400ms (buffer) = 2000ms
          // ============================================================
          setTimeout(() => {
            if (cancelled) return;

            console.log("[StoryMapViewer] Segment fly animation complete, setting route animations");
            setControlledRouteAnimations(sortedAnimations);
            setIsRouteAnimationsLoaded(true);
            setIsSegmentTransitioning(false); // Kết thúc transition

            // Check pending play
            if (pendingPlayRef.current) {
              console.log("[StoryMapViewer] Starting pending playback");
              pendingPlayRef.current = false;
              setIsControlledPlaying(true);
              setControlledSegmentStartTime(Date.now());
              playStartTimeRef.current = Date.now();
            }
          }, ROUTE_ANIMATION_DELAY_MS); // 2000ms delay để fly animation hoàn thành
        }
      } catch (e) {
        console.error("[StoryMapViewer] Failed to load route animations:", e);
        if (!cancelled) {
          setControlledRouteAnimations([]);
          setIsRouteAnimationsLoaded(true);
          setIsSegmentTransitioning(false);

          // Still try pending play
          if (pendingPlayRef.current) {
            pendingPlayRef.current = false;
            setIsControlledPlaying(true);
            setControlledSegmentStartTime(Date.now());
            playStartTimeRef.current = Date.now();
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
      console.log("[StoryMapViewer] Segment changed, resetting playback state");
      setIsControlledPlaying(false);
      setControlledSegmentStartTime(0);

      // THÊM: Nếu teacher đang play, set pending để chờ animations load
      if (controlledPlaying) {
        pendingPlayRef.current = true;
      } else {
        pendingPlayRef.current = false;
      }

      playStartTimeRef.current = 0;
      return; // Don't process play/pause in same effect run
    }

    // Only process if play state actually changed
    if (!playStateChanged) {
      return;
    }

    // Handle play/pause from teacher
    if (controlledPlaying !== undefined) {
      console.log("[StoryMapViewer] Play state changed:", controlledPlaying, "isRouteAnimationsLoaded:", isRouteAnimationsLoaded);

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
          console.log("[StoryMapViewer] Setting pending play (animations not loaded yet)");
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
        }
        // Don't reset segmentStartTime on pause - allows resume from current position
      }
    }
  }, [controlledPlaying, controlledIndex, isControlledMode, isRouteAnimationsLoaded, isControlledPlaying]);

  // Track last segments data for autonomous mode
  const lastSegmentsDataAutonomousRef = useRef<string>('');

  // ========== AUTONOMOUS MODE: Sync with external control (for teacher preview) ==========
  useEffect(() => {
    // Only for autonomous mode (teacher/control page with controlsEnabled = true)
    if (isControlledMode) return;

    // Create a hash of current segment data to detect changes
    const currentSegment = segmentsRef.current[controlledIndex ?? playback.currentPlayIndex ?? -1];
    const segmentsDataHash = currentSegment
      ? JSON.stringify({
        segmentId: currentSegment.segmentId,
        zonesCount: currentSegment.zones?.length || 0,
        layersCount: currentSegment.layers?.length || 0,
        locationsCount: currentSegment.locations?.length || 0,
      })
      : '';

    const currentIndex = controlledIndex ?? playback.currentPlayIndex;
    const segmentsChanged = segmentsDataHash !== lastSegmentsDataAutonomousRef.current;
    const indexChanged = lastViewedIndexRef.current !== currentIndex;

    if (
      currentIndex !== undefined &&
      currentIndex >= 0 &&
      segmentsRef.current.length > 0 &&
      segmentsRef.current[currentIndex] &&
      isMapReady &&
      mapInstance &&
      handleViewSegmentRef.current &&
      (indexChanged || segmentsChanged) // Re-render if index changed OR segments data changed
    ) {
      lastViewedIndexRef.current = currentIndex;
      lastSegmentsDataAutonomousRef.current = segmentsDataHash;

      const timer = setTimeout(() => {
        if (mapInstance && mapEl.current && segmentsRef.current[currentIndex] && handleViewSegmentRef.current) {
          // Use smooth Fly animation only if index changed, otherwise quick update
          handleViewSegmentRef.current(segmentsRef.current[currentIndex], {
            cameraAnimationType: indexChanged ? 'Fly' : 'Jump',
            cameraAnimationDurationMs: indexChanged ? 1500 : 0,
            transitionType: 'Ease',
            durationMs: indexChanged ? 800 : 300,
            skipCameraState: segmentsChanged && !indexChanged, // Don't change camera if only data updated
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [controlledIndex, playback.currentPlayIndex, isMapReady, isControlledMode, mapInstance, segments, playback]); // Add segments to dependencies

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
  // In controlled mode (student view), drive route playback directly from teacher's play state
  const activeIsPlaying = isControlledMode ? !!controlledPlaying : playback.isPlaying;

  // DEBUG (student): log teacher play state vs actual isPlaying for routes
  if (isControlledMode) {
    console.log("[Student Playback] controlledPlaying vs activeIsPlaying:", {
      controlledPlaying,
      activeIsPlaying,
    });
  }

  // Get current segment for camera state
  const currentSegment = isControlledMode
    ? (controlledIndex !== undefined ? segments[controlledIndex] : null)
    : (playback.currentPlayIndex !== undefined ? segments[playback.currentPlayIndex] : null);

  // DEBUG: on student side, log followCamera & followCameraZoom from active routes
  if (isControlledMode && activeRouteAnimations && activeRouteAnimations.length > 0) {
    const debugRoutes = activeRouteAnimations.map((r) => ({
      routeAnimationId: r.routeAnimationId,
      followCamera: r.followCamera,
      followCameraZoom: r.followCameraZoom,
    }));
    console.log("[Student Route] followCamera config:", debugRoutes);
  }

  // Parse segment camera state
  const segmentCameraState = currentSegment?.cameraState
    ? (typeof currentSegment.cameraState === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(currentSegment.cameraState);
          if (parsed?.center && Array.isArray(parsed.center) && parsed.center.length >= 2) {
            // Use zoom from parsed camera state, or fallback to 10 if not provided
            const zoom = parsed.zoom != null ? parsed.zoom : 10;
            return {
              center: [parsed.center[0], parsed.center[1]] as [number, number],
              zoom
            };
          }
          return null;
        } catch (e) {
          return null;
        }
      })()
      : (currentSegment.cameraState?.center && Array.isArray(currentSegment.cameraState.center) && currentSegment.cameraState.center.length >= 2
        ? (() => {
          const zoom = currentSegment.cameraState.zoom != null ? currentSegment.cameraState.zoom : 10;
          return {
            center: [currentSegment.cameraState.center[0], currentSegment.cameraState.center[1]] as [number, number],
            zoom
          };
        })()
        : null))
    : null;

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
      {activeRouteAnimations && activeRouteAnimations.length > 0 && mapInstance && !isSegmentTransitioning && (
        <SequentialRoutePlaybackWrapper
          map={mapInstance}
          routeAnimations={activeRouteAnimations}
          isPlaying={activeIsPlaying}
          segmentStartTime={activeSegmentStartTime}
          onLocationClick={onLocationClick}
          // FIXED: Disable camera state changes after route completion in controlled mode
          // This prevents the map from jumping to a different location after routes complete
          disableCameraStateAfter={isControlledMode}
          segmentCameraState={segmentCameraState}
          // NEW: In controlled mode, skip initial camera state since handleViewSegment already handles it
          skipInitialCameraState={isControlledMode}
        />
      )}

      {/* Playback Controls (hidden when controlsEnabled = false) */}
      {controlsEnabled && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-6 py-3 flex items-center gap-4 shadow-xl">
          <button
            onClick={
              playback.isPlaying
                ? playback.handlePausePreview
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