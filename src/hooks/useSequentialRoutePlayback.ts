import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { RouteAnimation, Location, applyCameraState, parseCameraState, getMapLocations } from "@/lib/api-storymap";

interface UseSequentialRoutePlaybackProps {
  map: any; // L.Map instance
  routeAnimations: RouteAnimation[];
  isPlaying: boolean;
  segmentStartTime: number;
  onLocationClick?: (location: Location, event?: any) => void;
  enableCameraFollow?: boolean;
  cameraFollowZoom?: number;
  // NEW: Option to disable camera state changes after route completion
  disableCameraStateAfter?: boolean;
}

interface RoutePlayState {
  isPlaying: boolean;
  hasStarted: boolean;
  hasCompleted: boolean;
}

/**
 * Hook for sequential route playback
 * FIXED: Added option to disable camera state changes after route completion
 */
export function useSequentialRoutePlayback({
  map,
  routeAnimations,
  isPlaying,
  segmentStartTime,
  onLocationClick,
  enableCameraFollow = true,
  cameraFollowZoom,
  disableCameraStateAfter = false, // NEW: Default false for backward compatibility
}: UseSequentialRoutePlaybackProps) {
  // Track play state for each route (supports parallel routes)
  const [routePlayStates, setRoutePlayStates] = useState<Map<number, RoutePlayState>>(new Map());
  // CRITICAL FIX: Track version to help wrapper component know when to re-render
  const [stateVersion, setStateVersion] = useState(0);
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [currentRoutePlaying, setCurrentRoutePlaying] = useState(false);
  const [locationPopupTimeout, setLocationPopupTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentLocationPopup, setCurrentLocationPopup] = useState<Location | null>(null);
  const locationsCacheRef = useRef<Map<string, Location>>(new Map());
  const routeStartTimeRef = useRef<number>(0);
  const cameraStateBeforeAppliedRef = useRef<boolean>(false);
  const schedulerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track if all routes have completed to prevent further state changes
  const allRoutesCompletedRef = useRef<boolean>(false);

  // CRITICAL FIX: Track if playback has been started for current segment to prevent duplicate runs
  const playbackStartedRef = useRef<boolean>(false);

  // CRITICAL FIX: Store current values in refs to avoid stale closures and prevent effect re-runs
  const routeAnimationsRef = useRef(routeAnimations);
  const segmentStartTimeRef = useRef(segmentStartTime);
  const isPlayingRef = useRef(isPlaying);
  const mapRef = useRef(map);
  const onLocationClickRef = useRef(onLocationClick);
  const disableCameraStateAfterRef = useRef(disableCameraStateAfter);

  useEffect(() => {
    routeAnimationsRef.current = routeAnimations;
    segmentStartTimeRef.current = segmentStartTime;
    isPlayingRef.current = isPlaying;
    mapRef.current = map;
    onLocationClickRef.current = onLocationClick;
    disableCameraStateAfterRef.current = disableCameraStateAfter;
  }, [routeAnimations, segmentStartTime, isPlaying, map, onLocationClick, disableCameraStateAfter]);

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

  // CRITICAL FIX: Split reset logic to avoid unnecessary re-renders
  // Track previous segment start time to detect new segments
  const prevSegmentStartTimeRef = useRef(segmentStartTime);

  // Track last sequential effect run segmentStartTime to prevent re-runs for same segment
  const lastEffectSegmentStartTimeRef = useRef(0);

  // Reset ONLY when playback stops (not on segment change)
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
      allRoutesCompletedRef.current = false;
      playbackStartedRef.current = false;
      lastEffectSegmentStartTimeRef.current = 0;
      lastSchedulerSegmentTimeRef.current = 0; // Reset scheduler guard
    }
  }, [isPlaying, routeAnimations.length]);

  // Detect new segment and reset refs AND states for clean start
  useEffect(() => {
    if (segmentStartTime !== prevSegmentStartTimeRef.current && segmentStartTime !== 0) {
      const timeDiff = Math.abs(segmentStartTime - prevSegmentStartTimeRef.current);

      // CRITICAL FIX: Ignore small time changes (<500ms) - these are likely React batching issues
      // Only reset on significant time changes (new segment)
      if (timeDiff < 500) {
        // Update ref to prevent re-triggering
        prevSegmentStartTimeRef.current = segmentStartTime;
        return;
      }

      // CRITICAL FIX: Reset ALL states for new segment
      // Reset refs
      cameraStateBeforeAppliedRef.current = false;
      allRoutesCompletedRef.current = false;
      playbackStartedRef.current = false;
      lastEffectSegmentStartTimeRef.current = 0;
      // DON'T reset lastSchedulerSegmentTimeRef - let time-based effect handle it
      prevSegmentStartTimeRef.current = segmentStartTime;

      // CRITICAL: Reset route play states to clear old segment data
      setRoutePlayStates(new Map());
      setCurrentRouteIndex(0);
      setCurrentRoutePlaying(false);

      // Clear scheduler if running
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
        schedulerIntervalRef.current = null;
      }
    }
  }, [segmentStartTime]);

  // Track last scheduler start time to prevent duplicate schedulers
  const lastSchedulerSegmentTimeRef = useRef<number>(0);

  // Time-based route scheduling logic
  // CRITICAL FIX: Only depend on isPlaying and segmentStartTime to prevent cleanup on every re-render
  useEffect(() => {
    if (!isPlaying || !segmentStartTime) {
      return;
    }

    // Use ref values to avoid stale closures
    const routes = routeAnimationsRef.current;
    if (routes.length === 0) {
      return;
    }

    // Check if any route uses startTimeMs (time-based scheduling)
    // CRITICAL: startTimeMs = 0 means "start at t=0" (time-based), NOT sequential!
    // Only null/undefined means sequential mode
    const hasStartTimeMs = routes.some(r => r.startTimeMs != null);

    if (!hasStartTimeMs) {
      // Fallback to sequential playback (legacy behavior)
      return;
    }

    // CRITICAL FIX: Prevent duplicate scheduler for same segment
    // Check timestamp first - if we already processed this segment, skip
    if (lastSchedulerSegmentTimeRef.current === segmentStartTime) {
      return;
    }

    lastSchedulerSegmentTimeRef.current = segmentStartTime;

    const checkAndStartRoutes = () => {
      const currentTime = Date.now() - segmentStartTime;
      const routes = routeAnimationsRef.current; // Always get latest routes
      const currentMap = mapRef.current; // Always get latest map
      const currentOnLocationClick = onLocationClickRef.current; // Always get latest callback
      const currentDisableCameraState = disableCameraStateAfterRef.current; // Always get latest flag

      // CRITICAL FIX: Only track completion for time-based routes
      let timeBasedRouteCount = 0;
      let timeBasedCompletedCount = 0;

      routes.forEach((route, index) => {
        // CRITICAL FIX: ONLY process routes with explicit startTimeMs (including 0)
        // Routes with startTimeMs = null/undefined are handled by sequential logic
        if (route.startTimeMs == null) {
          return; // Skip sequential routes (only null/undefined)
        }

        timeBasedRouteCount++;

        const startTime = route.startTimeMs; // Can be 0, which means "start at t=0"
        const animationEndTime = startTime + route.durationMs;
        const endTime = route.endTimeMs ?? animationEndTime;

        // Check if route should start
        if (currentTime >= startTime && currentTime < endTime) {
          // CRITICAL FIX: Use functional update to check latest state
          setRoutePlayStates(prev => {
            const currentState = prev.get(index);
            if (currentState?.hasStarted) {
              // Already started, don't restart
              return prev;
            }

            // Apply cameraStateBefore if exists (side effect in setState is not ideal but needed here)
            if (route.cameraStateBefore && currentMap) {
              try {
                const cameraState = parseCameraState(route.cameraStateBefore);
                if (cameraState) {
                  applyCameraState(currentMap, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 800 });
                }
              } catch (e) {
                console.error("Failed to apply cameraStateBefore:", e);
              }
            }

            const newMap = new Map(prev);
            newMap.set(index, { isPlaying: true, hasStarted: true, hasCompleted: false });
            setStateVersion(v => v + 1); // Increment version when state changes
            return newMap;
          });
        }

        // Check if animation should stop
        if (currentTime >= animationEndTime) {
          setRoutePlayStates(prev => {
            const state = prev.get(index);
            // Check latest state, not closure
            if (state?.isPlaying && !state.hasCompleted) {
              const newMap = new Map(prev);
              newMap.set(index, { ...state, isPlaying: false });
              setStateVersion(v => v + 1); // Increment version when state changes
              return newMap;
            }
            return prev; // No change needed
          });
        }

        // Check if route should end (trigger completion events)
        if (currentTime >= endTime) {
          setRoutePlayStates(prev => {
            const state = prev.get(index);
            // Check latest state, not closure
            if (state?.hasStarted && !state.hasCompleted) {
              // FIXED: Only apply cameraStateAfter if not disabled
              if (!currentDisableCameraState && route.cameraStateAfter && currentMap) {
                try {
                  const cameraState = parseCameraState(route.cameraStateAfter);
                  if (cameraState) {
                    applyCameraState(currentMap, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 800 });
                  }
                } catch (e) {
                  console.error("Failed to apply cameraStateAfter:", e);
                }
              }

              // Show location popup if enabled
              if (route.showLocationInfoOnArrival && route.toLocationId) {
                const location = locationsCacheRef.current.get(route.toLocationId);
                if (location && currentOnLocationClick) {
                  setCurrentLocationPopup(location);
                  currentOnLocationClick(location);

                  if (route.locationInfoDisplayDurationMs) {
                    const timeout = setTimeout(() => {
                      setCurrentLocationPopup(null);
                    }, route.locationInfoDisplayDurationMs);
                    setLocationPopupTimeout(timeout);
                  }
                }
              }

              // Update state to mark as completed
              const newMap = new Map(prev);
              newMap.set(index, { isPlaying: false, hasStarted: true, hasCompleted: true });
              setStateVersion(v => v + 1); // Increment version when state changes
              return newMap;
            }
            return prev; // No change needed
          });
        }

        // Count completed time-based routes (read latest state)
        const state = routePlayStates.get(index);
        if (state?.hasCompleted) {
          timeBasedCompletedCount++;
        }
      });

      // CRITICAL FIX: Only stop scheduler when ALL time-based routes are completed
      // Don't consider sequential routes in this check
      if (timeBasedRouteCount > 0 && timeBasedCompletedCount >= timeBasedRouteCount) {
        if (schedulerIntervalRef.current) {
          clearInterval(schedulerIntervalRef.current);
          schedulerIntervalRef.current = null;
        }
      }
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
      // Don't reset lastSchedulerSegmentTimeRef here - let segment change or stop handle it
    };
  }, [isPlaying, segmentStartTime]); // CRITICAL: Removed other deps, using refs instead to prevent cleanup on every render

  // CRITICAL FIX: Use ref for current route index to avoid effect re-run delays
  const currentRouteIndexRef = useRef(0);

  // Sync ref with state for external access
  useEffect(() => {
    currentRouteIndexRef.current = currentRouteIndex;
  }, [currentRouteIndex]);

  // Sequential route playback logic (fallback when no startTimeMs is used)
  // CRITICAL: Removed currentRouteIndex from dependencies to avoid re-render delays
  // CRITICAL: Using useLayoutEffect instead of useEffect to run synchronously after state updates
  // CRITICAL: Don't check isPlaying - it may be false by the time effect runs due to delays
  useLayoutEffect(() => {
    // CRITICAL: Only check segmentStartTime, not isPlaying
    // isPlaying may be false by the time effect runs if there are rendering delays
    const routes = routeAnimationsRef.current;
    if (routes.length === 0 || !segmentStartTime || segmentStartTime === 0) {
      setCurrentRoutePlaying(false);
      startPlaybackImperativeRef.current = null; // Clear imperative API when not playing
      return;
    }

    // CRITICAL FIX: Skip effect re-run if segmentStartTime change is too small (<500ms)
    // This prevents route restarts due to React batching issues
    const timeDiff = Math.abs(segmentStartTime - lastEffectSegmentStartTimeRef.current);
    if (lastEffectSegmentStartTimeRef.current !== 0 && timeDiff < 500) {
      return;
    }
    lastEffectSegmentStartTimeRef.current = segmentStartTime;

    // CRITICAL FIX: Allow sequential logic to run alongside time-based scheduling
    // Sequential logic will only handle routes with startTimeMs <= 0 or undefined
    // Time-based logic handles routes with startTimeMs > 0
    // Both can run in parallel within the same segment

    // CRITICAL FIX: Prevent duplicate playback runs for same segment
    // If playback has already been started for this segment, don't start again
    if (playbackStartedRef.current) {
      return;
    }

    // Mark playback as started to prevent duplicate runs
    playbackStartedRef.current = true;

    // CRITICAL FIX: Don't use allRoutesCompletedRef for sequential routes
    // Each mode (sequential/time-based) manages its own completion independently
    let cancelled = false;

    // Recursive function to play routes sequentially
    const playNextRoute = async (routeIndex: number) => {
      const routes = routeAnimationsRef.current;
      if (cancelled || routeIndex >= routes.length) {
        return;
      }

      const currentRoute = routes[routeIndex];
      if (!currentRoute) {
        // Move to next if invalid
        if (routeIndex < routes.length - 1) {
          await playNextRoute(routeIndex + 1);
        }
        return;
      }

      // CRITICAL FIX: Skip time-based routes (they are handled by time-based effect)
      // Only process routes with startTimeMs = null/undefined (sequential mode)
      if (currentRoute.startTimeMs != null) {
        // Skip time-based routes (including startTimeMs = 0)
        if (routeIndex < routes.length - 1) {
          await playNextRoute(routeIndex + 1);
        }
        return;
      }

      // Check if route has autoPlay enabled (default true if not specified)
      const shouldAutoPlay = currentRoute.autoPlay !== false;
      if (!shouldAutoPlay) {
        // If autoPlay is false, skip this route and move to next
        if (routeIndex < routeAnimations.length - 1) {
          await playNextRoute(routeIndex + 1);
        }
        return;
      }

      // Update state to show we're on this route (non-blocking for route execution)
      setCurrentRouteIndex(routeIndex);

      // CRITICAL FIX: Start route animation IMMEDIATELY, don't wait for camera
      // Camera animations will run in PARALLEL with route animation
      if (!cancelled) {
        setCurrentRoutePlaying(true);
        routeStartTimeRef.current = Date.now();
      }

      // Step 1: Apply cameraStateBefore in PARALLEL (non-blocking)
      if (currentRoute.cameraStateBefore && !cameraStateBeforeAppliedRef.current) {
        // Fire camera animation but don't await it - let it run in parallel
        const cameraStateStr = currentRoute.cameraStateBefore;
        (async () => {
          try {
            const cameraState = parseCameraState(cameraStateStr);
            const currentMap = mapRef.current;
            if (cameraState && currentMap && !cancelled) {
              applyCameraState(currentMap, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 1000 });
            }
          } catch (e) {
            console.error("Failed to apply cameraStateBefore:", e);
          }
        })();
        cameraStateBeforeAppliedRef.current = true;
      }

      if (cancelled) return;

      // Step 2: Apply start delay if exists
      if (currentRoute.startDelayMs && currentRoute.startDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, currentRoute.startDelayMs));
      }

      if (cancelled) return;

      // Step 4: Wait for route animation to complete
      const routeDuration = currentRoute.durationMs;
      await new Promise((resolve) => setTimeout(resolve, routeDuration));

      if (cancelled) return;

      // CRITICAL FIX: Stop route animation IMMEDIATELY after completion to prevent restart
      setCurrentRoutePlaying(false);

      // Step 5: Apply cameraStateAfter in PARALLEL (non-blocking) - FIXED: Check disableCameraStateAfter
      const currentDisableCameraState = disableCameraStateAfterRef.current;
      if (!currentDisableCameraState && currentRoute.cameraStateAfter) {
        // Fire camera animation but don't await it - let it run in parallel with next steps
        const cameraStateStr = currentRoute.cameraStateAfter;
        (async () => {
          try {
            const cameraState = parseCameraState(cameraStateStr);
            const currentMap = mapRef.current;
            if (cameraState && currentMap && !cancelled) {
              applyCameraState(currentMap, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 1000 });
            }
          } catch (e) {
            console.error("Failed to apply cameraStateAfter:", e);
          }
        })();
      }

      if (cancelled) return;

      // Step 6: Show location popup if enabled
      if (currentRoute.showLocationInfoOnArrival && currentRoute.toLocationId) {
        const location = locationsCacheRef.current.get(currentRoute.toLocationId);
        const currentOnLocationClick = onLocationClickRef.current;
        if (location && currentOnLocationClick && !cancelled) {
          setCurrentLocationPopup(location);
          currentOnLocationClick(location);

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

      // Step 7: Prepare for next route
      cameraStateBeforeAppliedRef.current = false;

      // Wait a bit before starting next route
      const delayBeforeNext = currentRoute.showLocationInfoOnArrival && currentRoute.locationInfoDisplayDurationMs
        ? currentRoute.locationInfoDisplayDurationMs
        : 500;

      await new Promise((resolve) => setTimeout(resolve, delayBeforeNext));

      if (cancelled) return;

      // Move to next route
      if (routeIndex < routeAnimations.length - 1) {
        await playNextRoute(routeIndex + 1);
      }
      // CRITICAL: Don't set allRoutesCompletedRef here
      // Sequential routes and time-based routes manage completion independently
    };

    // CRITICAL: Expose imperative API that can be called externally to force immediate playback
    startPlaybackImperativeRef.current = () => {
      if (!cancelled) {
        playNextRoute(0);
      }
    };

    // Start playing from route 0 immediately (also triggered by effect)
    playNextRoute(0);

    return () => {
      cancelled = true;
      if (locationPopupTimeout) {
        clearTimeout(locationPopupTimeout);
      }
      startPlaybackImperativeRef.current = null;
    };
  }, [segmentStartTime]); // CRITICAL: Only depend on segmentStartTime, use refs for other values to prevent cleanup on every render

  // Determine which route should be playing
  const getRoutePlayState = useCallback(
    (routeIndex: number) => {
      const isCurrentlyPlaying = isPlayingRef.current;
      const routes = routeAnimationsRef.current;

      if (!isCurrentlyPlaying || routes.length === 0 || routeIndex >= routes.length) {
        return false;
      }

      // Check if route has autoPlay enabled (default true if not specified)
      const route = routes[routeIndex];
      if (route && route.autoPlay === false) {
        return false;
      }

      // CRITICAL FIX: Check THIS route's scheduling mode, not all routes
      // This allows mixed sequential and time-based routes in same segment
      if (route.startTimeMs != null) {
        // Time-based (including startTimeMs = 0): check routePlayStates map
        const state = routePlayStates.get(routeIndex);
        const isPlaying = state?.isPlaying ?? false;
        return isPlaying;
      } else {
        // Sequential (startTimeMs = null/undefined): check if it's the current route and playing
        return currentRouteIndex === routeIndex && currentRoutePlaying;
      }
    },
    [currentRouteIndex, currentRoutePlaying, routePlayStates]
  );

  // CRITICAL: Expose imperative API to start playback immediately without waiting for effects
  const startPlaybackImperativeRef = useRef<(() => void) | null>(null);

  return {
    currentRouteIndex,
    currentRoutePlaying,
    routePlayStates,
    getRoutePlayState,
    currentLocationPopup,
    enableCameraFollow,
    cameraFollowZoom,
    stateVersion, // NEW: Version counter for memo optimization
    // DEPRECATED: allRoutesCompleted is no longer accurate with mixed sequential/time-based routes
    allRoutesCompleted: false,
    // NEW: Imperative API to force immediate playback start
    startPlaybackImmediate: startPlaybackImperativeRef.current,
  };
}