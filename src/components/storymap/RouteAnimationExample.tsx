"use client";

/**
 * Example: Cách sử dụng RouteAnimation component
 * 
 * Component này minh họa cách tích hợp RouteAnimation vào Segment playback
 */

import { useState, useEffect } from 'react';
import RouteAnimation from './RouteAnimation';

interface RouteAnimationExampleProps {
  map: any; // L.Map instance
  isSegmentPlaying: boolean;
  segmentStartTime: number; // Timestamp when segment started playing
}

export function RouteAnimationExample({
  map,
  isSegmentPlaying,
  segmentStartTime,
}: RouteAnimationExampleProps) {
  const [routeAnimations, setRouteAnimations] = useState<any[]>([]);

  // Example: Load route animations for current segment
  useEffect(() => {
    // TODO: Load from API
    // const loadRouteAnimations = async () => {
    //   const animations = await getRouteAnimations(segmentId);
    //   setRouteAnimations(animations);
    // };
    // loadRouteAnimations();

    // Example data
    setRouteAnimations([
      {
        id: '1',
        fromLocation: { lat: 10.762622, lng: 106.660172 }, // Ho Chi Minh City
        toLocation: { lat: 11.5564, lng: 108.4420 }, // Mui Ne
        routePath: [
          [106.660172, 10.762622],
          [106.7, 10.8],
          [106.8, 10.9],
          [108.0, 11.2],
          [108.4420, 11.5564],
        ],
        iconType: 'car',
        routeColor: '#666666',
        visitedColor: '#3b82f6',
        routeWidth: 4,
        durationMs: 5000,
        startTimeMs: 0,
      },
    ]);
  }, []);

  // Determine which animations should be playing
  const getActiveAnimations = () => {
    if (!isSegmentPlaying) return [];
    
    const currentTime = Date.now() - segmentStartTime;
    return routeAnimations.filter((anim) => {
      const startTime = anim.startTimeMs || 0;
      const endTime = anim.endTimeMs || anim.durationMs + startTime;
      return currentTime >= startTime && currentTime < endTime;
    });
  };

  const activeAnimations = getActiveAnimations();

  return (
    <>
      {activeAnimations.map((anim) => (
        <RouteAnimation
          key={anim.id}
          map={map}
          routePath={anim.routePath}
          fromLocation={anim.fromLocation}
          toLocation={anim.toLocation}
          iconType={anim.iconType}
          iconUrl={anim.iconUrl}
          routeColor={anim.routeColor}
          visitedColor={anim.visitedColor}
          routeWidth={anim.routeWidth}
          durationMs={anim.durationMs}
          isPlaying={isSegmentPlaying}
          onComplete={() => {
            console.log(`Route animation ${anim.id} completed`);
          }}
        />
      ))}
    </>
  );
}

/**
 * Helper function: Convert route search result to route path
 * 
 * Khi bạn có route từ API search routes, bạn cần convert nó thành
 * array of coordinates để sử dụng với RouteAnimation
 */
export function convertRouteToPath(route: any): [number, number][] {
  // Nếu route có geometry (GeoJSON LineString)
  if (route.geometry) {
    try {
      const geoJson = typeof route.geometry === 'string' 
        ? JSON.parse(route.geometry) 
        : route.geometry;
      
      if (geoJson.type === 'LineString' && geoJson.coordinates) {
        // GeoJSON coordinates are [lng, lat]
        return geoJson.coordinates as [number, number][];
      }
    } catch (e) {
      console.error('Failed to parse route geometry:', e);
    }
  }

  // Fallback: Create simple path from from/to locations
  // (This is a straight line, not a real route)
  if (route.fromLocation && route.toLocation) {
    return [
      [route.fromLocation.lng, route.fromLocation.lat],
      [route.toLocation.lng, route.toLocation.lat],
    ];
  }

  return [];
}

/**
 * Helper function: Get route path from OSM route service
 * 
 * Sử dụng API search routes đã có để lấy route path thực tế
 */
export async function getRoutePathFromOSM(
  from: string,
  to: string
): Promise<[number, number][]> {
  try {
    // Gọi API search routes đã có
    const response = await fetch(
      `/api/v1/storymaps/routes/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    const routes = await response.json();
    
    if (routes && routes.length > 0) {
      const route = routes[0];
      return convertRouteToPath(route);
    }
  } catch (error) {
    console.error('Failed to get route from OSM:', error);
  }

  return [];
}

