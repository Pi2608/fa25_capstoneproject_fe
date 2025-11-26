import { useState, useEffect, useCallback, useRef } from "react";
import { RouteAnimation, Location, applyCameraState, parseCameraState, getMapLocations } from "@/lib/api-storymap";

interface UseSequentialRoutePlaybackProps {
  map: any; // L.Map instance
  routeAnimations: RouteAnimation[];
  isPlaying: boolean;
  segmentStartTime: number;
  onLocationClick?: (location: Location, event?: any) => void;
  enableCameraFollow?: boolean;
  cameraFollowZoom?: number;
}

interface RoutePlayState {
  isPlaying: boolean;
  hasStarted: boolean;
  hasCompleted: boolean;
}

/**
 */
export function useSequentialRoutePlayback({
  map,
  routeAnimations,
  isPlaying,
  segmentStartTime,
  onLocationClick,
  enableCameraFollow = true, // Default: camera follows icon
  cameraFollowZoom,
}: UseSequentialRoutePlaybackProps) {
  // Track play state for each route (supports parallel routes)
  const [routePlayStates, setRoutePlayStates] = useState<Map<number, RoutePlayState>>(new Map());
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [currentRoutePlaying, setCurrentRoutePlaying] = useState(false);
  const [locationPopupTimeout, setLocationPopupTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentLocationPopup, setCurrentLocationPopup] = useState<Location | null>(null);
  const locationsCacheRef = useRef<Map<string, Location>>(new Map());
  const routeStartTimeRef = useRef<number>(0);
  const cameraStateBeforeAppliedRef = useRef<boolean>(false);
  const schedulerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
            const id = loc.locationId;
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
      setRoutePlayStates(new Map());
      setCurrentLocationPopup(null);
      if (locationPopupTimeout) {
        clearTimeout(locationPopupTimeout);
        setLocationPopupTimeout(null);
      }
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
        schedulerIntervalRef.current = null;
      }
      cameraStateBeforeAppliedRef.current = false;
      return;
    }

    // Reset when segment start time changes (new segment)
    setCurrentRouteIndex(0);
    setCurrentRoutePlaying(false);
    setRoutePlayStates(new Map());
    cameraStateBeforeAppliedRef.current = false;
  }, [isPlaying, segmentStartTime, routeAnimations.length]);

  // Time-based route scheduling logic
  // This scheduler checks every 100ms which routes should be playing based on startTimeMs
  useEffect(() => {
    if (!isPlaying || routeAnimations.length === 0 || !segmentStartTime) {
      return;
    }

    // Check if any route uses startTimeMs (time-based scheduling)
    const hasStartTimeMs = routeAnimations.some(r => r.startTimeMs !== undefined && r.startTimeMs !== null);
    
    if (!hasStartTimeMs) {
      // Fallback to sequential playback (legacy behavior)
      return;
    }

    const checkAndStartRoutes = () => {
      const currentTime = Date.now() - segmentStartTime;
      
      routeAnimations.forEach((route, index) => {
        const startTime = route.startTimeMs ?? 0;
        // endTimeMs can be set manually, otherwise calculate from duration
        const animationEndTime = startTime + route.durationMs;
        const endTime = route.endTimeMs ?? animationEndTime;
        const currentState = routePlayStates.get(index);
        
        // Check if route should start
        if (currentTime >= startTime && currentTime < endTime) {
          if (!currentState?.hasStarted) {
            // Apply cameraStateBefore if exists
            if (route.cameraStateBefore && map) {
              try {
                const cameraState = parseCameraState(route.cameraStateBefore);
                if (cameraState) {
                  applyCameraState(map, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 800 });
                }
              } catch (e) {
                console.error("Failed to apply cameraStateBefore:", e);
              }
            }
            
            setRoutePlayStates(prev => {
              const newMap = new Map(prev);
              newMap.set(index, { isPlaying: true, hasStarted: true, hasCompleted: false });
              return newMap;
            });
          }
        }
        
        // Check if animation should stop (but route time window still active)
        // This handles case where endTimeMs > startTimeMs + durationMs
        if (currentTime >= animationEndTime && currentState?.isPlaying) {
          // Animation finished, but we may still be in the route's time window
          // Stop the animation but don't mark as completed yet
          setRoutePlayStates(prev => {
            const newMap = new Map(prev);
            const state = newMap.get(index);
            if (state && !state.hasCompleted) {
              newMap.set(index, { ...state, isPlaying: false });
            }
            return newMap;
          });
        }
        
        // Check if route should end (trigger completion events)
        if (currentTime >= endTime && currentState?.hasStarted && !currentState?.hasCompleted) {
          // Apply cameraStateAfter if exists
          if (route.cameraStateAfter && map) {
            try {
              const cameraState = parseCameraState(route.cameraStateAfter);
              if (cameraState) {
                applyCameraState(map, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 800 });
              }
            } catch (e) {
              console.error("Failed to apply cameraStateAfter:", e);
            }
          }
          
          // Show location popup if enabled
          if (route.showLocationInfoOnArrival && route.toLocationId) {
            const location = locationsCacheRef.current.get(route.toLocationId);
            if (location && onLocationClick) {
              setCurrentLocationPopup(location);
              onLocationClick(location);
              
              if (route.locationInfoDisplayDurationMs) {
                const timeout = setTimeout(() => {
                  setCurrentLocationPopup(null);
                }, route.locationInfoDisplayDurationMs);
                setLocationPopupTimeout(timeout);
              }
            }
          }
          
          setRoutePlayStates(prev => {
            const newMap = new Map(prev);
            newMap.set(index, { isPlaying: false, hasStarted: true, hasCompleted: true });
            return newMap;
          });
        }
      });
    };

    // Initial check
    checkAndStartRoutes();
    
    // Set up interval to check every 100ms
    schedulerIntervalRef.current = setInterval(checkAndStartRoutes, 100);

    return () => {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
        schedulerIntervalRef.current = null;
      }
    };
  }, [isPlaying, routeAnimations, segmentStartTime, map, onLocationClick]);

  // Sequential route playback logic (fallback when no startTimeMs is used)
  useEffect(() => {
    if (!isPlaying || routeAnimations.length === 0 || currentRouteIndex >= routeAnimations.length) {
      setCurrentRoutePlaying(false);
      return;
    }

    // Skip sequential logic if time-based scheduling is active
    const hasStartTimeMs = routeAnimations.some(r => r.startTimeMs !== undefined && r.startTimeMs !== null);
    if (hasStartTimeMs) {
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
      
      // Check if using time-based scheduling
      const hasStartTimeMs = routeAnimations.some(r => r.startTimeMs !== undefined && r.startTimeMs !== null);
      
      if (hasStartTimeMs) {
        // Time-based: check routePlayStates map
        const state = routePlayStates.get(routeIndex);
        return state?.isPlaying ?? false;
      } else {
        // Sequential: legacy behavior
        return currentRouteIndex === routeIndex && currentRoutePlaying;
      }
    },
    [isPlaying, routeAnimations, currentRouteIndex, currentRoutePlaying, routePlayStates]
  );

  return {
    currentRouteIndex,
    currentRoutePlaying,
    routePlayStates, // Expose for debugging
    getRoutePlayState,
    currentLocationPopup,
    // Camera follow options
    enableCameraFollow,
    cameraFollowZoom,
  };
}

