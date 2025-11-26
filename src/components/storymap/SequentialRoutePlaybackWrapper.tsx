"use client";

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
  enableCameraFollow?: boolean; // Whether camera should follow the moving icon
  cameraFollowZoom?: number; // Zoom level when following
}

/**
 * Shared component for rendering sequential route animations
 * Used in both edit page and storymap viewer
 */
export default function SequentialRoutePlaybackWrapper({
  map,
  routeAnimations,
  isPlaying,
  segmentStartTime,
  onLocationClick,
  enableCameraFollow = true,
  cameraFollowZoom,
}: SequentialRoutePlaybackWrapperProps) {
  const sequentialPlayback = useSequentialRoutePlayback({
    map,
    routeAnimations,
    isPlaying,
    segmentStartTime,
    onLocationClick,
    enableCameraFollow,
    cameraFollowZoom,
  });

  return (
    <>
      {routeAnimations.map((anim, index) => {
        try {
          const geoJson = typeof anim.routePath === "string" 
            ? JSON.parse(anim.routePath) 
            : anim.routePath;
          
          if (geoJson.type !== "LineString" || !geoJson.coordinates) {
            return null;
          }

          const routePath = geoJson.coordinates as [number, number][];
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
            />
          );
        } catch (e) {
          console.error("Failed to render route animation:", e);
          return null;
        }
      })}
    </>
  );
}
