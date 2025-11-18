"use client";

import { useEffect, useRef, useState } from 'react';

export interface RouteAnimationProps {
  map: any; // L.Map instance (using any to avoid SSR issues)
  routePath: [number, number][]; // Array of [lng, lat] coordinates
  fromLocation: { lat: number; lng: number };
  toLocation: { lat: number; lng: number };
  iconType?: 'car' | 'walking' | 'bike' | 'plane' | 'custom';
  iconUrl?: string;
  routeColor?: string; // Color for unvisited route
  visitedColor?: string; // Color for visited route
  routeWidth?: number;
  durationMs: number;
  isPlaying: boolean;
  onComplete?: () => void;
}

/**
 * RouteAnimation component - Hiển thị icon di chuyển dọc theo route
 * và highlight phần đường đã đi qua
 */
export default function RouteAnimation({
  map,
  routePath,
  fromLocation,
  toLocation,
  iconType = 'car',
  iconUrl,
  routeColor = '#666666',
  visitedColor = '#3b82f6',
  routeWidth = 4,
  durationMs,
  isPlaying,
  onComplete,
}: RouteAnimationProps) {
  const markerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const visitedLineRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [L, setL] = useState<any>(null);

  // Dynamic import Leaflet only on client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default);
      });
    }
  }, []);

  // Create icon based on type
  const createIcon = (): any => {
    if (!L) return null;
    const iconSize: [number, number] = [32, 32];
    
    if (iconUrl) {
      return L.icon({
        iconUrl,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
      });
    }
    
    // Default icons based on type
    const iconMap: Record<string, string> = {
      car: '🚗',
      walking: '🚶',
      bike: '🚴',
      plane: '✈️',
    };
    
    return L.divIcon({
      html: `<div style="font-size: 24px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${iconMap[iconType] || '📍'}</div>`,
      className: 'route-animation-icon',
      iconSize,
      iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
    });
  };

  // Calculate distance between two points using Haversine formula
  const haversineDistance = (
    [lng1, lat1]: [number, number],
    [lng2, lat2]: [number, number]
  ): number => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate total route distance
  const calculateRouteDistance = (path: [number, number][]): number => {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      total += haversineDistance(path[i], path[i + 1]);
    }
    return total;
  };

  // Get position along route based on distance traveled
  const getPositionAlongRoute = (
    path: [number, number][],
    distance: number
  ): { lat: number; lng: number } | null => {
    let accumulated = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const segmentDistance = haversineDistance(path[i], path[i + 1]);
      if (accumulated + segmentDistance >= distance) {
        const ratio = (distance - accumulated) / segmentDistance;
        const [lng1, lat1] = path[i];
        const [lng2, lat2] = path[i + 1];
        return {
          lat: lat1 + (lat2 - lat1) * ratio,
          lng: lng1 + (lng2 - lng1) * ratio,
        };
      }
      accumulated += segmentDistance;
    }
    // Return end position if distance exceeds route length
    const last = path[path.length - 1];
    return { lat: last[1], lng: last[0] };
  };

  // Get visited path coordinates
  const getVisitedPath = (
    path: [number, number][],
    progress: number
  ): [number, number][] => {
    const totalDistance = calculateRouteDistance(path);
    const visitedDistance = totalDistance * progress;
    
    const visitedPath: [number, number][] = [];
    let accumulated = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const segmentDistance = haversineDistance(path[i], path[i + 1]);
      
      if (accumulated + segmentDistance <= visitedDistance) {
        // Entire segment is visited
        if (visitedPath.length === 0 || 
            visitedPath[visitedPath.length - 1][0] !== path[i][0] ||
            visitedPath[visitedPath.length - 1][1] !== path[i][1]) {
          visitedPath.push(path[i]);
        }
        visitedPath.push(path[i + 1]);
      } else if (accumulated < visitedDistance) {
        // Partial segment
        if (visitedPath.length === 0 || 
            visitedPath[visitedPath.length - 1][0] !== path[i][0] ||
            visitedPath[visitedPath.length - 1][1] !== path[i][1]) {
          visitedPath.push(path[i]);
        }
        const ratio = (visitedDistance - accumulated) / segmentDistance;
        const [lng1, lat1] = path[i];
        const [lng2, lat2] = path[i + 1];
        visitedPath.push([
          lng1 + (lng2 - lng1) * ratio,
          lat1 + (lat2 - lat1) * ratio,
        ]);
        break;
      }
      accumulated += segmentDistance;
    }
    
    return visitedPath;
  };

  // Calculate direction angle for icon rotation
  const calculateDirection = (
    path: [number, number][],
    progress: number
  ): number | null => {
    const totalDistance = calculateRouteDistance(path);
    const currentDistance = totalDistance * progress;
    
    let accumulated = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const segmentDistance = haversineDistance(path[i], path[i + 1]);
      if (accumulated + segmentDistance >= currentDistance) {
        const [lng1, lat1] = path[i];
        const [lng2, lat2] = path[i + 1];
        const angle = (Math.atan2(lat2 - lat1, lng2 - lng1) * 180) / Math.PI;
        return angle;
      }
      accumulated += segmentDistance;
    }
    return null;
  };

  // Initialize route lines and marker
  useEffect(() => {
    if (!map || routePath.length === 0 || !L) return;

    // Full route line (unvisited - gray)
    const fullRoute = L.polyline(
      routePath.map(([lng, lat]) => [lat, lng] as [number, number]),
      {
        color: routeColor,
        weight: routeWidth,
        opacity: 0.6,
        dashArray: '5, 5', // Dashed line for unvisited
      }
    ).addTo(map);

    routeLineRef.current = fullRoute;

    // Visited route line (highlighted - colored)
    const visitedRoute = L.polyline([], {
      color: visitedColor,
      weight: routeWidth + 2, // Slightly thicker
      opacity: 1,
    }).addTo(map);

    visitedLineRef.current = visitedRoute;

    // Create marker at starting position
    const icon = createIcon();
    const marker = L.marker([fromLocation.lat, fromLocation.lng], {
      icon,
      zIndexOffset: 1000,
    }).addTo(map);

    markerRef.current = marker;

    return () => {
      fullRoute.remove();
      visitedRoute.remove();
      marker.remove();
    };
  }, [map, routePath, fromLocation, routeColor, visitedColor, routeWidth, iconType, iconUrl, L]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || routePath.length === 0 || !L) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Reset to start position when not playing
      if (markerRef.current) {
        markerRef.current.setLatLng([fromLocation.lat, fromLocation.lng]);
      }
      if (visitedLineRef.current) {
        visitedLineRef.current.setLatLngs([]);
      }
      setProgress(0);
      startTimeRef.current = null;
      return;
    }

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / durationMs, 1);

      setProgress(progress);

      // Calculate position along route
      const totalDistance = calculateRouteDistance(routePath);
      const traveledDistance = totalDistance * progress;
      
      const currentPosition = getPositionAlongRoute(
        routePath,
        traveledDistance
      );

      // Update marker position
      if (markerRef.current && currentPosition) {
        markerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);
        
        // Calculate rotation based on direction
        const direction = calculateDirection(routePath, progress);
        if (direction !== null && markerRef.current.options.icon && L) {
          // Note: Leaflet doesn't support rotation natively, 
          // you may need leaflet-rotatedmarker plugin
          const icon = markerRef.current.options.icon as any;
          if (icon.options && icon.options.html) {
            const html = icon.options.html as string;
            const rotatedHtml = html.replace(
              /style="([^"]*)"/,
              `style="$1 transform: rotate(${direction}deg);"`
            );
            markerRef.current.setIcon(
              L.divIcon({
                ...icon.options,
                html: rotatedHtml,
              })
            );
          }
        }
      }

      // Update visited route line
      if (visitedLineRef.current) {
        const visitedPath = getVisitedPath(routePath, progress);
        if (visitedPath.length > 0) {
          visitedLineRef.current.setLatLngs(
            visitedPath.map(([lng, lat]) => [lat, lng] as [number, number])
          );
        }
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
        startTimeRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, routePath, durationMs, fromLocation, onComplete, L]);

  return null; // This component doesn't render anything visible
}

