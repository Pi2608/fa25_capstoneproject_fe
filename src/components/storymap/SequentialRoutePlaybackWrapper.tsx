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
}: SequentialRoutePlaybackWrapperProps) {
  const sequentialPlayback = useSequentialRoutePlayback({
    map,
    routeAnimations,
    isPlaying,
    segmentStartTime,
    onLocationClick,
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
