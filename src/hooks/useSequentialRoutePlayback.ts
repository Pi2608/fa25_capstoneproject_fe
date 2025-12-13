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

  // CRITICAL FIX: Store current values in refs to avoid stale closures
  const routeAnimationsRef = useRef(routeAnimations);
  const segmentStartTimeRef = useRef(segmentStartTime);
  const isPlayingRef = useRef(isPlaying);
  const mapRef = useRef(map);

  useEffect(() => {
    routeAnimationsRef.current = routeAnimations;
    segmentStartTimeRef.current = segmentStartTime;
    isPlayingRef.current = isPlaying;
    mapRef.current = map;
  }, [routeAnimations, segmentStartTime, isPlaying, map]);

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
    }
  }, [isPlaying, routeAnimations.length]);

  // Detect new segment and reset refs ONLY (no state updates to avoid re-render delays)
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
      // Reset refs immediately - sequential playback effect will handle state updates
      cameraStateBeforeAppliedRef.current = false;
      allRoutesCompletedRef.current = false;
      playbackStartedRef.current = false; // Reset playback started flag for new segment
      prevSegmentStartTimeRef.current = segmentStartTime;

      // IMPORTANT: Don't reset states here - let sequential playback effect handle it
      // This avoids extra re-renders before playNextRoute(0) can execute
    }
  }, [segmentStartTime]);

  // Time-based route scheduling logic
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
      // Skip if all routes completed
      if (allRoutesCompletedRef.current) return;
      
      const currentTime = Date.now() - segmentStartTime;
      let allCompleted = true;
      
      routeAnimations.forEach((route, index) => {
        const startTime = route.startTimeMs ?? 0;
        const animationEndTime = startTime + route.durationMs;
        const endTime = route.endTimeMs ?? animationEndTime;
        const currentState = routePlayStates.get(index);
        
        // Check if route should start
        if (currentTime >= startTime && currentTime < endTime) {
          allCompleted = false;
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
        
        // Check if animation should stop
        if (currentTime >= animationEndTime && currentState?.isPlaying) {
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
          // FIXED: Only apply cameraStateAfter if not disabled
          if (!disableCameraStateAfter && route.cameraStateAfter && map) {
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
        
        // Check if this route is not yet completed
        if (!currentState?.hasCompleted) {
          allCompleted = false;
        }
      });
      
      // Mark all routes as completed to stop further processing
      if (allCompleted && routeAnimations.length > 0) {
        console.log("[useSequentialRoutePlayback] All routes completed, stopping scheduler");
        allRoutesCompletedRef.current = true;
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
    };
  }, [isPlaying, routeAnimations, segmentStartTime, map, onLocationClick, disableCameraStateAfter]);

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
    if (routeAnimations.length === 0 || !segmentStartTime || segmentStartTime === 0) {
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

    // Skip sequential logic if time-based scheduling is active
    const hasStartTimeMs = routeAnimations.some(r => r.startTimeMs !== undefined && r.startTimeMs !== null);
    if (hasStartTimeMs) {
      startPlaybackImperativeRef.current = null; // Clear imperative API for time-based mode
      return;
    }

    // CRITICAL FIX: Prevent duplicate playback runs for same segment
    // If playback has already been started for this segment, don't start again
    if (playbackStartedRef.current) {
      return;
    }

    // Mark playback as started to prevent duplicate runs
    playbackStartedRef.current = true;

    // CRITICAL FIX: Reset allRoutesCompletedRef when starting new playback
    // This ensures we don't skip playback if effect re-runs
    allRoutesCompletedRef.current = false;
    let cancelled = false;

    // Recursive function to play routes sequentially
    const playNextRoute = async (routeIndex: number) => {
      if (cancelled || routeIndex >= routeAnimations.length || allRoutesCompletedRef.current) {
        return;
      }

      const currentRoute = routeAnimations[routeIndex];
      if (!currentRoute) {
        // Move to next if invalid
        if (routeIndex < routeAnimations.length - 1) {
          await playNextRoute(routeIndex + 1);
        } else {
          allRoutesCompletedRef.current = true;
        }
        return;
      }

      // Check if route has autoPlay enabled (default true if not specified)
      const shouldAutoPlay = currentRoute.autoPlay !== false;
      if (!shouldAutoPlay) {
        // If autoPlay is false, skip this route and move to next
        if (routeIndex < routeAnimations.length - 1) {
          await playNextRoute(routeIndex + 1);
        } else {
          allRoutesCompletedRef.current = true;
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
        (async () => {
          try {
            const cameraState = parseCameraState(currentRoute.cameraStateBefore);
            if (cameraState && map && !cancelled) {
              applyCameraState(map, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 1000 });
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
      if (!disableCameraStateAfter && currentRoute.cameraStateAfter && map) {
        // Fire camera animation but don't await it - let it run in parallel with next steps
        (async () => {
          try {
            const cameraState = parseCameraState(currentRoute.cameraStateAfter);
            if (cameraState && !cancelled) {
              applyCameraState(map, cameraState, { cameraAnimationType: "Fly", cameraAnimationDurationMs: 1000 });
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
        if (location && onLocationClick && !cancelled) {
          setCurrentLocationPopup(location);
          onLocationClick(location);

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
      } else {
        // All routes completed
        allRoutesCompletedRef.current = true;
      }
    };

    // CRITICAL: Expose imperative API that can be called externally to force immediate playback
    startPlaybackImperativeRef.current = () => {
      if (!cancelled && !allRoutesCompletedRef.current) {
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
  }, [routeAnimations, segmentStartTime, map, onLocationClick, disableCameraStateAfter]); // REMOVED isPlaying dependency

  // Determine which route should be playing
  const getRoutePlayState = useCallback(
    (routeIndex: number) => {
      if (!isPlaying || routeAnimations.length === 0 || routeIndex >= routeAnimations.length) {
        return false;
      }

      // Check if route has autoPlay enabled (default true if not specified)
      const route = routeAnimations[routeIndex];
      if (route && route.autoPlay === false) {
        return false;
      }

      // Check if using time-based scheduling
      const hasStartTimeMs = routeAnimations.some(r => r.startTimeMs !== undefined && r.startTimeMs !== null);

      if (hasStartTimeMs) {
        // Time-based: check routePlayStates map
        const state = routePlayStates.get(routeIndex);
        return state?.isPlaying ?? false;
      } else {
        // Sequential: legacy behavior
        // For the first route, start immediately when isPlaying is true
        if (routeIndex === 0 && isPlaying && !allRoutesCompletedRef.current) {
          return true;
        }
        // For other routes, check if it's the current route and playing
        return currentRouteIndex === routeIndex && currentRoutePlaying;
      }
    },
    [isPlaying, routeAnimations, currentRouteIndex, currentRoutePlaying, routePlayStates]
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
    allRoutesCompleted: allRoutesCompletedRef.current,
    // NEW: Imperative API to force immediate playback start
    startPlaybackImmediate: startPlaybackImperativeRef.current,
  };
}