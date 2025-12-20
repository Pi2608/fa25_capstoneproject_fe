import { useState, useEffect, useCallback, useRef } from "react";
import { Segment, TimelineTransition, RouteAnimation, getRouteAnimationsBySegment, FrontendTransitionType } from "@/lib/api-storymap";
import { getTimelineTransitions } from "@/lib/api-storymap";
import {
  renderSegmentZones,
  // renderSegmentLocations, // Now handled by usePoiMarkers globally
  renderSegmentLayers,
  applyCameraState,
  autoFitBounds,
  applyLayerCrossFade,
  type RenderSegmentOptions,
} from "@/utils/segmentRenderer";
import { calculateEffectiveSegmentDuration } from "@/utils/segmentTiming";

type UseSegmentPlaybackProps = {
  mapId: string;
  segments: Segment[];
  currentMap: any;
  currentSegmentLayers: any[];
  setCurrentSegmentLayers: (layers: any[]) => void;
  setActiveSegmentId: (id: string | null) => void;
  onSegmentSelect?: (segment: Segment) => void;
  onLocationClick?: (location: any, event?: any) => void;
};

export function useSegmentPlayback({
  mapId,
  segments,
  currentMap,
  currentSegmentLayers,
  setCurrentSegmentLayers,
  setActiveSegmentId,
  onSegmentSelect,
  onLocationClick,
}: UseSegmentPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [waitingForUserAction, setWaitingForUserAction] = useState(false);
  const [currentTransition, setCurrentTransition] = useState<TimelineTransition | null>(null);
  const [routeAnimations, setRouteAnimations] = useState<RouteAnimation[]>([]);
  const [segmentStartTime, setSegmentStartTime] = useState<number>(0);
  const [isRouteAnimationOnly, setIsRouteAnimationOnly] = useState(false); // Flag to skip playback loop
  const isSingleSegmentPlayRef = useRef(false); // Ref to track single segment play (doesn't trigger re-render)

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTimelineTransitions(mapId);
        if (!cancelled) setTransitions(data || []);
      } catch (e) {
        console.warn("Failed to load timeline transitions:", e);
        if (!cancelled) setTransitions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [mapId]);

  type TransitionOptions = {
    transitionType?: FrontendTransitionType;
    durationMs?: number;
    cameraAnimationType?: "Jump" | "Ease" | "Fly";
    cameraAnimationDurationMs?: number;
    skipCameraState?: boolean; // Skip applying camera state
    disableTwoPhaseFly?: boolean; // Disable two-phase fly animation for smoother transitions
  };

  const findTransition = useCallback((fromId?: string | null, toId?: string | null) => {
    if (!fromId || !toId) return undefined as TimelineTransition | undefined;
    return transitions.find(t => t.fromSegmentId === fromId && t.toSegmentId === toId);
  }, [transitions]);

  // Load route animations for current segment (when NOT playing)
  // This ensures route lines are visible even when not playing
  // When playing, routes are loaded in auto-play effect for accurate timing
  useEffect(() => {
    // Skip if playing - routes are loaded in auto-play effect
    if (isPlaying) return;

    if (segments.length === 0 || currentPlayIndex >= segments.length) {
      setRouteAnimations([]);
      setSegmentStartTime(0);
      return;
    }

    const currentSegment = segments[currentPlayIndex];
    if (!currentSegment?.segmentId) {
      setRouteAnimations([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const animations = await getRouteAnimationsBySegment(mapId, currentSegment.segmentId);
        if (!cancelled) {
          // Sort routes by displayOrder for sequential playback
          const sortedAnimations = (animations || []).sort((a, b) => {
            // First sort by displayOrder
            if (a.displayOrder !== b.displayOrder) {
              return a.displayOrder - b.displayOrder;
            }
            // Then by startTimeMs if available
            if (a.startTimeMs !== undefined && b.startTimeMs !== undefined) {
              return a.startTimeMs - b.startTimeMs;
            }
            // Finally by creation time
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          setRouteAnimations(sortedAnimations);
        }
      } catch (e) {
        console.warn("Failed to load route animations:", e);
        if (!cancelled) {
          setRouteAnimations([]);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mapId, currentPlayIndex, segments, isPlaying]);

  // ==================== VIEW SEGMENT ON MAP ====================
  // Now using shared render functions from segmentRenderer to avoid code duplication
  const handleViewSegment = useCallback(async (segment: Segment, opts?: TransitionOptions) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available");
      return;
    }

    try {
      const L = (await import("leaflet")).default;
      const oldLayers = [...currentSegmentLayers];

      // Convert TransitionOptions to RenderSegmentOptions
      const renderOptions: RenderSegmentOptions = {
        transitionType: opts?.transitionType,
        durationMs: opts?.durationMs,
        cameraAnimationType: opts?.cameraAnimationType,
        cameraAnimationDurationMs: opts?.cameraAnimationDurationMs,
        skipCameraState: opts?.skipCameraState,
        disableTwoPhaseFly: opts?.disableTwoPhaseFly,
        // Enable highlight effects for zones and layers during playback
        highlightZones: {
          enabled: true,
          color: undefined, // Use zone's own color
          intensity: "medium",
          pulseSpeed: 2000,
        },
        highlightLayers: {
          enabled: true,
          color: undefined, // Use layer feature's own color
          intensity: "medium",
          pulseSpeed: 2000,
        },
      };

      // Render zones using shared function
      const zoneResult = await renderSegmentZones(segment, currentMap, L, renderOptions);
      const newLayers = [...zoneResult.layers];
      const allBounds = [...zoneResult.bounds];

      // Render layers and map features using shared function
      const layerResult = await renderSegmentLayers(segment, currentMap, L, renderOptions);
      newLayers.push(...layerResult.layers);
      allBounds.push(...layerResult.bounds);

      // NOTE: Locations are now rendered globally by usePoiMarkers hook
      // This prevents duplicate rendering of POIs
      // renderSegmentLocations is only used in viewer mode (StoryMapViewer)
      // const locationResult = await renderSegmentLocations(segment, currentMap, L, {
      //   ...renderOptions,
      //   onLocationClick,
      // });
      // newLayers.push(...locationResult.layers);
      // allBounds.push(...locationResult.bounds);

      // Apply camera state or auto-fit bounds using shared functions
      // FIXED: Always apply camera state when segment has one, even if route animations were playing
      // This ensures proper transition to next segment's camera state after route animations complete
      if (segment.cameraState && !opts?.skipCameraState) {
        // Add a small delay to ensure any route animations have released camera control
        // This prevents route animation zoom from persisting after animations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        applyCameraState(segment, currentMap, {
          ...renderOptions,
          oldLayersCount: oldLayers.length,
          // Force camera state application even if map is already at a zoom level
          cameraAnimationType: renderOptions.cameraAnimationType || 'Fly',
          cameraAnimationDurationMs: renderOptions.cameraAnimationDurationMs || 1500,
        });
      } else if (allBounds.length > 0) {
        autoFitBounds(allBounds, currentMap, renderOptions);
      } else {
        console.warn("⚠️ Empty segment: no camera state and no zones/locations");
      }

      // Apply layer cross-fade transition using shared function
      applyLayerCrossFade(
        oldLayers,
        newLayers,
        currentMap,
        renderOptions,
        (finalLayers) => {
          setCurrentSegmentLayers(finalLayers);
        }
      );
    } catch (error) {
      console.error("❌ Failed to view segment on map:", error);
    }
  }, [currentMap, currentSegmentLayers, setCurrentSegmentLayers, onLocationClick]);

  // Track last segments data hash to detect changes
  const lastSegmentsDataRef = useRef<string>('');
  const lastPlayIndexRef = useRef<number>(-1);

  // Re-render current segment when segments data changes (e.g., after create/delete/update)
  // BUT NOT when segment index changes (that's handled by auto-play effect)
  useEffect(() => {
    // Only re-render if we have a current segment and map is ready, and not playing
    if (!currentMap || segments.length === 0 || currentPlayIndex >= segments.length || isPlaying) {
      // Update lastPlayIndexRef even when not re-rendering
      if (currentPlayIndex !== lastPlayIndexRef.current) {
        lastPlayIndexRef.current = currentPlayIndex;
        // Reset segments data hash when index changes (to allow camera state on new segment)
        lastSegmentsDataRef.current = '';
      }
      return;
    }

    const currentSegment = segments[currentPlayIndex];
    if (!currentSegment) {
      return;
    }

    // Check if index changed - if so, don't skip camera state (let auto-play handle it)
    const indexChanged = currentPlayIndex !== lastPlayIndexRef.current;
    if (indexChanged) {
      lastPlayIndexRef.current = currentPlayIndex;
      // Reset segments data hash when index changes
      lastSegmentsDataRef.current = '';
      // Don't re-render here - let auto-play effect handle segment change with camera state
      return;
    }

    // Create a hash of current segment data to detect changes
    const segmentsDataHash = JSON.stringify({
      segmentId: currentSegment.segmentId,
      zonesCount: currentSegment.zones?.length || 0,
      layersCount: currentSegment.layers?.length || 0,
      locationsCount: currentSegment.locations?.length || 0,
      routeAnimationsCount: routeAnimations.length || 0,
    });

    // Only re-render if data actually changed (and index didn't change)
    if (segmentsDataHash !== lastSegmentsDataRef.current) {
      lastSegmentsDataRef.current = segmentsDataHash;

      // Re-render current segment with updated data (skip camera state to avoid jumping)
      handleViewSegment(currentSegment, {
        skipCameraState: true, // Don't change camera, just update layers
        transitionType: 'Ease',
        durationMs: 300, // Quick update
      });
    }
  }, [segments, currentMap, currentPlayIndex, isPlaying, handleViewSegment, routeAnimations]); // Re-render when segments change

  // ==================== AUTO-PLAY EFFECT ====================
  useEffect(() => {
    // Skip playback loop if only playing route animation or single segment
    if (isRouteAnimationOnly || isSingleSegmentPlayRef.current) return;

    if (!isPlaying || segments.length === 0) return;
    if (!currentMap) return;

    let timeoutId: NodeJS.Timeout;

    const playNextSegment = async () => {
      if (currentPlayIndex >= segments.length) {
        setIsPlaying(false);
        setCurrentPlayIndex(0);
        return;
      }

      const segment = segments[currentPlayIndex];
      const prevSegment = currentPlayIndex > 0 ? segments[currentPlayIndex - 1] : undefined;
      const t = findTransition(prevSegment?.segmentId ?? null, segment.segmentId);

      // Normalize case from backend (linear/ease/easein/easeout/easeinout → Linear/Ease/EaseIn/EaseOut/EaseInOut)
      const normalizeTransitionType = (str: string): FrontendTransitionType => {
        const lower = str.toLowerCase();
        if (lower === 'jump') return 'Jump';
        if (lower === 'ease') return 'Ease';
        if (lower === 'linear') return 'Linear';
        if (lower === 'easein') return 'EaseIn';
        if (lower === 'easeout') return 'EaseOut';
        if (lower === 'easeinout') return 'EaseInOut';
        return 'Ease'; // default fallback
      };

      const normalizeCameraType = (str: string): "Jump" | "Ease" | "Fly" => {
        const lower = str.toLowerCase();
        if (lower === 'jump') return 'Jump';
        if (lower === 'ease') return 'Ease';
        return 'Fly';
      };

      const options: TransitionOptions | undefined = t ? {
        transitionType: normalizeTransitionType(t.transitionType),
        durationMs: t.durationMs,
        cameraAnimationType: t.animateCamera ? normalizeCameraType(t.cameraAnimationType) : 'Jump',
        cameraAnimationDurationMs: t.animateCamera ? t.cameraAnimationDurationMs : undefined,
      } : undefined;

      // Debug: Log transition info
      if (t) {
        console.log(`🔄 [TRANSITION] From "${prevSegment?.name || 'START'}" → "${segment.name}"`, {
          transitionDuration: t.durationMs,
          cameraAnimation: t.animateCamera,
          cameraDuration: t.cameraAnimationDurationMs,
        });
      }

      if (!currentMap) {
        console.warn("⚠️ Map not ready yet, retrying segment playback...");
        timeoutId = setTimeout(playNextSegment, 200);
        return;
      }

      setActiveSegmentId(segment.segmentId);

      // CRITICAL FIX: Load routes and set start time BEFORE rendering
      // This ensures segmentStartTime reflects the ACTUAL segment start, not when rendering completes
      let currentSegmentRoutes: RouteAnimation[] = [];
      try {
        const animations = await getRouteAnimationsBySegment(mapId, segment.segmentId);
        // Sort routes by displayOrder for sequential playback
        currentSegmentRoutes = (animations || []).sort((a, b) => {
          // First sort by displayOrder
          if (a.displayOrder !== b.displayOrder) {
            return a.displayOrder - b.displayOrder;
          }
          // Then by startTimeMs if available
          if (a.startTimeMs !== undefined && b.startTimeMs !== undefined) {
            return a.startTimeMs - b.startTimeMs;
          }
          // Finally by creation time
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        console.log(`[AUTO-PLAY] Loaded ${currentSegmentRoutes.length} routes for segment "${segment.name}"`);
      } catch (e) {
        console.warn("Failed to load routes for segment:", segment.segmentId, e);
      }

      // CRITICAL: Set segmentStartTime BEFORE handleViewSegment to capture TRUE start time
      // handleViewSegment may take several seconds to render, we don't want routes delayed by that
      const actualSegmentStartTime = Date.now();
      setRouteAnimations(currentSegmentRoutes);
      setSegmentStartTime(actualSegmentStartTime);

      console.log(`⏰ [TIMING] Segment "${segment.name}" start time set to: ${actualSegmentStartTime}`);

      // Now render segment (this may take time, but routes will start based on actualSegmentStartTime)
      await handleViewSegment(segment, {
        ...options,
        skipCameraState: false, // Force camera state application
      });

      onSegmentSelect?.(segment);

      // Check if this transition requires user action
      if (t && t.requireUserAction) {
        setCurrentTransition(t);
        setWaitingForUserAction(true);
        setIsPlaying(false); // Pause playback
        return; // Don't schedule next segment
      }

      // FIXED: Use effective duration that accounts for route animations
      // This ensures routes have enough time to complete before advancing to next segment
      const effectiveDuration = calculateEffectiveSegmentDuration(segment, currentSegmentRoutes);

      // Debug logging - CRITICAL INFO ONLY
      console.log(`\n🎬 [SEGMENT "${segment.name}"] PLAYBACK START`);
      console.log(`   Base: ${segment.durationMs}ms | Routes: ${currentSegmentRoutes.length} | Effective: ${effectiveDuration}ms`);
      if (currentSegmentRoutes.length > 0) {
        console.log(`   Route data:`, currentSegmentRoutes.map((r, i) => ({
          index: i + 1,
          startTimeMs: r.startTimeMs ?? 'null',
          durationMs: r.durationMs,
          autoPlay: r.autoPlay,
        })));
      }

      timeoutId = setTimeout(() => {
        setCurrentPlayIndex(prev => prev + 1);
      }, effectiveDuration);
    };

    playNextSegment();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentPlayIndex, segments.length, currentMap]);

  // ==================== PLAYBACK CONTROLS ====================
  const handlePlayPreview = (startIndex?: number) => {
    if (segments.length === 0) return;

    // Reset single segment play flag when starting full timeline playback
    isSingleSegmentPlayRef.current = false;
    setIsRouteAnimationOnly(false);

    if (
      typeof startIndex !== "number" &&
      !isPlaying &&
      currentPlayIndex > 0 &&
      currentPlayIndex < segments.length
    ) {
      setIsPlaying(true);
      setSegmentStartTime(Date.now());
      return;
    }

    const nextIndex =
      typeof startIndex === "number" &&
        startIndex >= 0 &&
        startIndex < segments.length
        ? startIndex
        : 0;

    setCurrentPlayIndex(nextIndex);
    setIsPlaying(true);
    setSegmentStartTime(Date.now());
  };

  const handlePausePreview = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Play route animation only (without camera state)
  const handlePlayRouteAnimation = useCallback(async (segmentId?: string) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available");
      return;
    }

    const targetSegmentId = segmentId || segments[currentPlayIndex]?.segmentId;
    if (!targetSegmentId) {
      console.warn("⚠️ No segment selected");
      return;
    }

    try {
      // Load route animations for the segment
      const animations = await getRouteAnimationsBySegment(mapId, targetSegmentId);
      if (animations && animations.length > 0) {
        setRouteAnimations(animations);
        setSegmentStartTime(Date.now());
        setIsRouteAnimationOnly(true); // Set flag to skip playback loop
        setIsPlaying(true);
      } else {
        console.warn("⚠️ No route animations found for this segment");
      }
    } catch (e) {
      console.error("Failed to play route animation:", e);
    }
  }, [currentMap, mapId, segments, currentPlayIndex]);

  const handleStopPreview = () => {
    const wasRouteAnimationOnly = isRouteAnimationOnly;
    setIsPlaying(false);
    setCurrentPlayIndex(0);
    setWaitingForUserAction(false);
    setCurrentTransition(null);
    setRouteAnimations([]);
    setSegmentStartTime(0);
    setIsRouteAnimationOnly(false); // Reset flag
    isSingleSegmentPlayRef.current = false; // Reset ref

    // Dispatch event to notify UI components
    if (typeof window !== 'undefined' && wasRouteAnimationOnly) {
      window.dispatchEvent(new CustomEvent('routeAnimationStopped'));
    }
  };

  const handleClearMap = () => {
    if (!currentMap) return;

    currentSegmentLayers.forEach(layer => {
      try {
        currentMap.removeLayer(layer);
      } catch (e) {
        console.warn("Failed to remove layer:", e);
      }
    });

    setCurrentSegmentLayers([]);
    setActiveSegmentId(null);
  };

  const handleContinueAfterUserAction = () => {
    setWaitingForUserAction(false);
    setCurrentTransition(null);
    setCurrentPlayIndex(prev => prev + 1); // Move to next segment
    setIsPlaying(true); // Resume playback
  };

  // Play a single segment's animations without transitions
  const handlePlaySingleSegment = useCallback(async (segmentId: string) => {
    if (!currentMap) {
      console.warn("⚠️ No map instance available");
      return;
    }

    // Find the segment by ID
    const segmentIndex = segments.findIndex(s => s.segmentId === segmentId);
    if (segmentIndex === -1) {
      console.warn("⚠️ Segment not found:", segmentId);
      return;
    }

    const segment = segments[segmentIndex];

    // IMPORTANT: Set flags FIRST to prevent auto-play effect from running
    isSingleSegmentPlayRef.current = true;
    setIsRouteAnimationOnly(true);

    // Set the segment as active
    setActiveSegmentId(segmentId);
    setCurrentPlayIndex(segmentIndex);

    // Render the segment on map WITHOUT camera state and transitions
    await handleViewSegment(segment, {
      skipCameraState: true,
      transitionType: 'Jump',
      durationMs: 0,
    });

    // Load and play route animations
    try {
      const animations = await getRouteAnimationsBySegment(mapId, segmentId);
      if (animations && animations.length > 0) {
        setRouteAnimations(animations);
        setSegmentStartTime(Date.now());
        // Flags already set above
        setIsPlaying(true);

        // FIXED: Use effective duration that accounts for route animations
        const effectiveDuration = calculateEffectiveSegmentDuration(segment, animations);
        setTimeout(() => {
          handleStopPreview();
          isSingleSegmentPlayRef.current = false;
        }, effectiveDuration);
      } else {
        // No route animations, just show the segment for its duration
        setSegmentStartTime(Date.now());
        // Flags already set above
        setIsPlaying(true);

        const duration = segment.durationMs || 5000;
        setTimeout(() => {
          setIsPlaying(false);
          setSegmentStartTime(0);
          setIsRouteAnimationOnly(false);
          isSingleSegmentPlayRef.current = false;
        }, duration);
      }
    } catch (e) {
      console.error("Failed to play single segment:", e);
      setIsRouteAnimationOnly(false);
      isSingleSegmentPlayRef.current = false;
    }
  }, [currentMap, segments, mapId, handleViewSegment, handleStopPreview, setActiveSegmentId]);

  return {
    isPlaying,
    currentPlayIndex,
    waitingForUserAction,
    currentTransition,
    routeAnimations,
    segmentStartTime,
    handleViewSegment,
    handlePlayPreview,
    handlePausePreview,
    handlePlayRouteAnimation,
    handlePlaySingleSegment,
    handleStopPreview,
    handleClearMap,
    handleContinueAfterUserAction,
  };
}