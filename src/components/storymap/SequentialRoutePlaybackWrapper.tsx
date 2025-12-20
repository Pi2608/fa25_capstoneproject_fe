"use client";

import { useEffect, useRef, useMemo, memo } from "react";
import { useSequentialRoutePlayback } from "@/hooks/useSequentialRoutePlayback";
import RouteAnimation from "@/components/storymap/RouteAnimation"; // Use original working version
import type { RouteAnimation as RouteAnimationType, Location } from "@/lib/api-storymap";

interface SequentialRoutePlaybackWrapperProps {
  map: any; // L.Map instance
  routeAnimations: RouteAnimationType[];
  isPlaying: boolean;
  segmentStartTime: number;
  onLocationClick?: (location: Location) => void;
  // Camera follow options
  enableCameraFollow?: boolean;
  cameraFollowZoom?: number;
  // NEW: Option to disable camera state changes after route completion
  // Useful for controlled mode (student view) to prevent map from jumping after routes complete
  disableCameraStateAfter?: boolean;
  // Segment camera state for initial zoom
  segmentCameraState?: { center: [number, number]; zoom: number } | null;
  // NEW: Skip initial camera state application (for controlled mode)
  skipInitialCameraState?: boolean;
}

/**
 * Shared component for rendering sequential route animations
 * Used in both edit page and storymap viewer
 * 
 * FIXED: Added disableCameraStateAfter prop to prevent camera jumping after route completion
 * OPTIMIZED: Memoized to prevent unnecessary re-renders
 */
function SequentialRoutePlaybackWrapper({
  map,
  routeAnimations,
  isPlaying,
  segmentStartTime,
  onLocationClick,
  enableCameraFollow = true,
  cameraFollowZoom,
  disableCameraStateAfter = false,
  segmentCameraState,
  skipInitialCameraState = false,
}: SequentialRoutePlaybackWrapperProps) {
  const sequentialPlayback = useSequentialRoutePlayback({
    map,
    routeAnimations,
    isPlaying,
    segmentStartTime,
    onLocationClick,
    enableCameraFollow,
    cameraFollowZoom,
    disableCameraStateAfter,
  });

  // Memoize parsed route paths to avoid re-parsing on every render
  // CRITICAL FIX: Store original index to match with hook's routePlayStates
  const parsedRoutes = useMemo(() => {
    return routeAnimations.map((anim, originalIndex) => {
        try {
          const geoJson = typeof anim.routePath === "string"
            ? JSON.parse(anim.routePath)
            : anim.routePath;

          if (geoJson.type !== "LineString" || !geoJson.coordinates) {
            return null;
          }

        return {
          anim,
          routePath: geoJson.coordinates as [number, number][],
          originalIndex, // Store original index before filtering
        };
      } catch (e) {
        console.error("Failed to parse route path:", e);
        return null;
      }
    }).filter((item): item is { anim: RouteAnimationType; routePath: [number, number][]; originalIndex: number } => item !== null);
  }, [routeAnimations]);


  return (
    <>
      {parsedRoutes.map(({ anim, routePath, originalIndex }) => {
          // CRITICAL FIX: Use originalIndex to match with hook's routePlayStates
          const isRoutePlaying = sequentialPlayback.getRoutePlayState(originalIndex);

          // Use per-route settings if available, otherwise fallback to global settings
          const routeFollowCamera = anim.followCamera ?? enableCameraFollow;
          const routeFollowZoom = anim.followCameraZoom ?? cameraFollowZoom;

          return (
            <RouteAnimation
              key={`${segmentStartTime}-${anim.routeAnimationId}`}
              map={map}
              routePath={routePath}
              fromLocation={{ lat: anim.fromLat, lng: anim.fromLng }}
              toLocation={{ lat: anim.toLat, lng: anim.toLng }}
              iconType={anim.iconType}
              iconUrl={anim.iconUrl}
              routeColor={anim.routeColor}
              visitedColor={anim.visitedColor}
              routeWidth={anim.routeWidth}
              durationMs={anim.durationMs}
              isPlaying={isRoutePlaying}
              followCamera={routeFollowCamera}
              followCameraZoom={routeFollowZoom}
              segmentCameraState={segmentCameraState}
              skipInitialCameraState={skipInitialCameraState}
              routeId={anim.routeAnimationId}
            />
          );
      })}
    </>
  );
}

// CRITICAL FIX: Memoize with stateVersion to prevent excessive re-renders
// Only re-render when meaningful state changes (tracked by stateVersion)
export default memo(SequentialRoutePlaybackWrapper, (prevProps, nextProps) => {
  // Re-render if any meaningful prop changes
  return (
    prevProps.map === nextProps.map &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.segmentStartTime === nextProps.segmentStartTime &&
    prevProps.enableCameraFollow === nextProps.enableCameraFollow &&
    prevProps.cameraFollowZoom === nextProps.cameraFollowZoom &&
    prevProps.disableCameraStateAfter === nextProps.disableCameraStateAfter &&
    prevProps.skipInitialCameraState === nextProps.skipInitialCameraState &&
    prevProps.routeAnimations === nextProps.routeAnimations && // Reference equality check
    JSON.stringify(prevProps.segmentCameraState) === JSON.stringify(nextProps.segmentCameraState)
  );
});