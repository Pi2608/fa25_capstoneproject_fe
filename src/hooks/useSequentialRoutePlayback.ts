import { useState, useEffect, useCallback, useRef } from "react";
import { RouteAnimation, Location, applyCameraState, parseCameraState, getMapLocations } from "@/lib/api-storymap";

interface UseSequentialRoutePlaybackProps {
  map: any; // L.Map instance
  routeAnimations: RouteAnimation[];
  isPlaying: boolean;
  segmentStartTime: number;
  onLocationClick?: (location: Location, event?: any) => void;
}

/**
 * Hook to manage sequential route playback with camera transitions and location popups
 */
export function useSequentialRoutePlayback({
  map,
  routeAnimations,
  isPlaying,
  segmentStartTime,
  onLocationClick,
}: UseSequentialRoutePlaybackProps) {
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [currentRoutePlaying, setCurrentRoutePlaying] = useState(false);
  const [locationPopupTimeout, setLocationPopupTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentLocationPopup, setCurrentLocationPopup] = useState<Location | null>(null);
  const locationsCacheRef = useRef<Map<string, Location>>(new Map());
  const routeStartTimeRef = useRef<number>(0);
  const cameraStateBeforeAppliedRef = useRef<boolean>(false);

  // Load locations cache
  useEffect(() => {
    if (routeAnimations.length === 0 || !map) return;

    const mapId = routeAnimations[0]?.mapId;
    if (!mapId) return;

    let cancelled = false;
    (async () => {
      try {
        const locations = await getMapLocations(mapId);
        if (!cancelled && locations) {
          const cache = new Map<string, Location>();
          locations.forEach((loc) => {
            const id = loc.locationId || loc.poiId;
            if (id) cache.set(id, loc);
          });
          locationsCacheRef.current = cache;
        }
      } catch (e) {
        console.warn("Failed to load locations for route playback:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeAnimations, map]);

  // Reset when playback stops or segment changes
  useEffect(() => {
    if (!isPlaying || routeAnimations.length === 0) {
      setCurrentRouteIndex(0);
      setCurrentRoutePlaying(false);
      setCurrentLocationPopup(null);
      if (locationPopupTimeout) {
        clearTimeout(locationPopupTimeout);
        setLocationPopupTimeout(null);
      }
      cameraStateBeforeAppliedRef.current = false;
      return;
    }

    // Reset when segment start time changes (new segment)
    setCurrentRouteIndex(0);
    setCurrentRoutePlaying(false);
    cameraStateBeforeAppliedRef.current = false;
  }, [isPlaying, segmentStartTime, routeAnimations.length]);

  // Sequential route playback logic
  useEffect(() => {
    if (!isPlaying || routeAnimations.length === 0 || currentRouteIndex >= routeAnimations.length) {
      setCurrentRoutePlaying(false);
      return;
    }

    const currentRoute = routeAnimations[currentRouteIndex];
    if (!currentRoute) return;

    let cancelled = false;

    const playRoute = async () => {
      // Step 1: Apply cameraStateBefore if exists (only once per route)
      if (currentRoute.cameraStateBefore && !cameraStateBeforeAppliedRef.current) {
        try {
          const cameraState = parseCameraState(currentRoute.cameraStateBefore);
          if (cameraState && map && !cancelled) {
            console.log(`📹 Applying cameraStateBefore for route ${currentRouteIndex + 1}`);
            applyCameraState(map, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 1000 });
            // Wait for camera animation to complete
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (e) {
          console.error("Failed to apply cameraStateBefore:", e);
        }
        if (!cancelled) {
          cameraStateBeforeAppliedRef.current = true;
        }
      }

      if (cancelled) return;

      // Step 2: Apply start delay if exists
      if (currentRoute.startDelayMs && currentRoute.startDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, currentRoute.startDelayMs));
      }

      if (cancelled) return;

      // Step 3: Start route animation
      console.log(`🎬 Starting route ${currentRouteIndex + 1}/${routeAnimations.length}`);
      if (!cancelled) {
        setCurrentRoutePlaying(true);
        routeStartTimeRef.current = Date.now();
      }

      // Step 4: Wait for route animation to complete
      const routeDuration = currentRoute.durationMs;
      await new Promise((resolve) => setTimeout(resolve, routeDuration));

      if (cancelled) return;

      // Step 5: Apply cameraStateAfter if exists
      if (currentRoute.cameraStateAfter && map) {
        try {
          const cameraState = parseCameraState(currentRoute.cameraStateAfter);
          if (cameraState && !cancelled) {
            console.log(`📹 Applying cameraStateAfter for route ${currentRouteIndex + 1}`);
            applyCameraState(map, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 1000 });
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (e) {
          console.error("Failed to apply cameraStateAfter:", e);
        }
      }

      if (cancelled) return;

      // Step 6: Show location popup if enabled
      if (currentRoute.showLocationInfoOnArrival && currentRoute.toLocationId) {
        const location = locationsCacheRef.current.get(currentRoute.toLocationId);
        if (location && onLocationClick && !cancelled) {
          console.log(`📍 Showing location popup for route ${currentRouteIndex + 1}`);
          setCurrentLocationPopup(location);
          onLocationClick(location);

          // Auto-close popup after duration if specified
          if (currentRoute.locationInfoDisplayDurationMs) {
            const timeout = setTimeout(() => {
              if (!cancelled) {
                setCurrentLocationPopup(null);
              }
            }, currentRoute.locationInfoDisplayDurationMs);
            setLocationPopupTimeout(timeout);
          }
        }
      }

      if (cancelled) return;

      // Step 7: Move to next route
      setCurrentRoutePlaying(false);
      cameraStateBeforeAppliedRef.current = false;

      // Wait a bit before starting next route (for location popup display)
      const delayBeforeNext = currentRoute.showLocationInfoOnArrival && currentRoute.locationInfoDisplayDurationMs
        ? currentRoute.locationInfoDisplayDurationMs
        : 500; // Default 500ms delay

      await new Promise((resolve) => setTimeout(resolve, delayBeforeNext));

      if (cancelled) return;

      if (currentRouteIndex < routeAnimations.length - 1) {
        setCurrentRouteIndex((prev) => prev + 1);
      } else {
        console.log("✅ All routes completed");
        setCurrentRoutePlaying(false);
      }
    };

    playRoute();

    return () => {
      cancelled = true;
      if (locationPopupTimeout) {
        clearTimeout(locationPopupTimeout);
      }
    };
  }, [isPlaying, routeAnimations, currentRouteIndex, map, onLocationClick]);

  // Determine which route should be playing
  const getRoutePlayState = useCallback(
    (routeIndex: number) => {
      if (!isPlaying || routeAnimations.length === 0) return false;
      return currentRouteIndex === routeIndex && currentRoutePlaying;
    },
    [isPlaying, routeAnimations.length, currentRouteIndex, currentRoutePlaying]
  );

  return {
    currentRouteIndex,
    currentRoutePlaying,
    getRoutePlayState,
    currentLocationPopup,
  };
}

