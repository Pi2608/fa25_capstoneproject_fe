import { useState, useEffect, useCallback, useRef } from "react";
import { Segment, TimelineTransition, RouteAnimation, getRouteAnimationsBySegment } from "@/lib/api-storymap";
import { getTimelineTransitions } from "@/lib/api-storymap";
import {
  renderSegmentZones,
  renderSegmentLocations,
  renderSegmentLayers,
  applyCameraState,
  autoFitBounds,
  applyLayerCrossFade,
  type RenderSegmentOptions,
} from "@/utils/segmentRenderer";

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
    transitionType?: "Jump" | "Ease" | "Linear";
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

  // Load route animations for current segment (always load, not just when playing)
  // This ensures route lines are visible even when not playing
  useEffect(() => {
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
          // Reset start time when segment changes (only if playing)
          if (isPlaying) {
          setSegmentStartTime(Date.now());
          }
        }
      } catch (e) {
        console.warn("Failed to load route animations:", e);
        if (!cancelled) {
          setRouteAnimations([]);
          if (isPlaying) {
          setSegmentStartTime(0);
          }
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
      };

      // Render zones using shared function
      const zoneResult = await renderSegmentZones(segment, currentMap, L, renderOptions);
      const newLayers = [...zoneResult.layers];
      const allBounds = [...zoneResult.bounds];

      // Render layers and map features using shared function
      const layerResult = await renderSegmentLayers(segment, currentMap, L, renderOptions);
      newLayers.push(...layerResult.layers);
      allBounds.push(...layerResult.bounds);

      // Render locations using shared function
      const locationResult = await renderSegmentLocations(segment, currentMap, L, {
        ...renderOptions,
        onLocationClick,
      });
      newLayers.push(...locationResult.layers);
      allBounds.push(...locationResult.bounds);

      // Apply camera state or auto-fit bounds using shared functions
      if (segment.cameraState && !opts?.skipCameraState) {
        applyCameraState(segment, currentMap, { ...renderOptions, oldLayersCount: oldLayers.length });
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
      routeAnimationsCount: currentSegment.routeAnimations?.length || 0,
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
  }, [segments, currentMap, currentPlayIndex, isPlaying, handleViewSegment]); // Re-render when segments change

  // ==================== AUTO-PLAY EFFECT ====================
  useEffect(() => {
    // Skip playback loop if only playing route animation
    if (isRouteAnimationOnly) return;
    
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
      
      // Normalize case from backend (linear/ease/jump → Linear/Ease/Jump)
      const normalizeTransitionType = (str: string): "Jump" | "Ease" | "Linear" => {
        const lower = str.toLowerCase();
        if (lower === 'jump') return 'Jump';
        if (lower === 'ease') return 'Ease';
        return 'Linear';
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
      
      if (!currentMap) {
        console.warn("⚠️ Map not ready yet, retrying segment playback...");
        timeoutId = setTimeout(playNextSegment, 200);
        return;
      }

      setActiveSegmentId(segment.segmentId);
      await handleViewSegment(segment, options);
      onSegmentSelect?.(segment);
      
      // Check if this transition requires user action
      if (t && t.requireUserAction) {
        setCurrentTransition(t);
        setWaitingForUserAction(true);
        setIsPlaying(false); // Pause playback
        return; // Don't schedule next segment
      }
      
      const duration = segment.durationMs || 5000;
      timeoutId = setTimeout(() => {
        setCurrentPlayIndex(prev => prev + 1);
      }, duration);
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
    
    const nextIndex =
      typeof startIndex === "number" && startIndex >= 0 && startIndex < segments.length
        ? startIndex
        : 0;
    
    setCurrentPlayIndex(nextIndex);
    setIsPlaying(true);
    // Set segment start time immediately when starting playback
    // This ensures route animations can start right away
    setSegmentStartTime(Date.now());
  };

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

  return {
    isPlaying,
    currentPlayIndex,
    waitingForUserAction,
    currentTransition,
    routeAnimations,
    segmentStartTime,
    handleViewSegment,
    handlePlayPreview,
    handlePlayRouteAnimation,
    handleStopPreview,
    handleClearMap,
    handleContinueAfterUserAction,
  };
}