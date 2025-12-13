"use client";

import { useEffect, useRef, useMemo, memo } from "react";
import { useSequentialRoutePlayback } from "@/hooks/useSequentialRoutePlayback";
import RouteAnimation from "@/components/storymap/RouteAnimation";
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
  const parsedRoutes = useMemo(() => {
    return routeAnimations.map((anim) => {
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
        };
      } catch (e) {
        console.error("Failed to parse route path:", e);
        return null;
      }
    }).filter((item): item is { anim: RouteAnimationType; routePath: [number, number][] } => item !== null);
  }, [routeAnimations]);

  // Debug logging - track isPlaying changes
  const lastIsPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    if (isPlaying !== lastIsPlayingRef.current) {
      console.log(`🎮 [WRAPPER] isPlaying changed: ${lastIsPlayingRef.current} → ${isPlaying} | Routes: ${routeAnimations.length}`);
      lastIsPlayingRef.current = isPlaying;
    }
  }, [isPlaying, routeAnimations.length]);

  return (
    <>
      {parsedRoutes.map(({ anim, routePath }, index) => {
          const isRoutePlaying = sequentialPlayback.getRoutePlayState(index);

          // Use per-route settings if available, otherwise fallback to global settings
          const routeFollowCamera = anim.followCamera ?? enableCameraFollow;
          const routeFollowZoom = anim.followCameraZoom ?? cameraFollowZoom;

          return (
            <RouteAnimation
              key={anim.routeAnimationId}
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
            />
          );
      })}
    </>
  );
}

// Memoize component to prevent unnecessary re-renders
export default memo(SequentialRoutePlaybackWrapper, (prevProps, nextProps) => {
  // Custom comparison function to prevent re-renders when props haven't meaningfully changed
  return (
    prevProps.map === nextProps.map &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.segmentStartTime === nextProps.segmentStartTime &&
    prevProps.enableCameraFollow === nextProps.enableCameraFollow &&
    prevProps.cameraFollowZoom === nextProps.cameraFollowZoom &&
    prevProps.disableCameraStateAfter === nextProps.disableCameraStateAfter &&
    prevProps.skipInitialCameraState === nextProps.skipInitialCameraState &&
    prevProps.routeAnimations.length === nextProps.routeAnimations.length &&
    prevProps.routeAnimations.every((anim, i) => {
      const nextAnim = nextProps.routeAnimations[i];
      return (
        anim.routeAnimationId === nextAnim?.routeAnimationId &&
        anim.routePath === nextAnim?.routePath &&
        anim.fromLat === nextAnim?.fromLat &&
        anim.fromLng === nextAnim?.fromLng &&
        anim.toLat === nextAnim?.toLat &&
        anim.toLng === nextAnim?.toLng &&
        anim.durationMs === nextAnim?.durationMs &&
        anim.followCamera === nextAnim?.followCamera &&
        anim.followCameraZoom === nextAnim?.followCameraZoom
      );
    }) &&
    JSON.stringify(prevProps.segmentCameraState) === JSON.stringify(nextProps.segmentCameraState)
  );
});