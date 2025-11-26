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
  // Camera follow options
  followCamera?: boolean; // Whether camera should follow the icon
  followCameraZoom?: number; // Zoom level when following (null = keep current)
  onPositionUpdate?: (position: { lat: number; lng: number }, progress: number) => void; // Callback when icon position updates
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
  followCamera = false,
  followCameraZoom,
  onPositionUpdate,
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

  // Validate coordinates
  const isValidCoordinate = (coord: number): boolean => {
    return typeof coord === 'number' && !isNaN(coord) && isFinite(coord);
  };

  const isValidPoint = (point: [number, number] | undefined): boolean => {
    if (!point || !Array.isArray(point) || point.length < 2) return false;
    return isValidCoordinate(point[0]) && isValidCoordinate(point[1]);
  };

  // Get position along route based on distance traveled
  const getPositionAlongRoute = (
    path: [number, number][],
    distance: number
  ): { lat: number; lng: number } | null => {
    if (!path || path.length === 0) return null;
    
    let accumulated = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const point1 = path[i];
      const point2 = path[i + 1];
      
      // Validate points
      if (!isValidPoint(point1) || !isValidPoint(point2)) {
        console.warn(`Invalid point at index ${i} or ${i + 1}`, { point1, point2 });
        continue;
      }
      
      const segmentDistance = haversineDistance(point1, point2);
      
      // Skip if segment distance is invalid
      if (!isValidCoordinate(segmentDistance) || segmentDistance === 0) {
        continue;
      }
      
      if (accumulated + segmentDistance >= distance) {
        const ratio = (distance - accumulated) / segmentDistance;
        const [lng1, lat1] = point1;
        const [lng2, lat2] = point2;
        
        const lat = lat1 + (lat2 - lat1) * ratio;
        const lng = lng1 + (lng2 - lng1) * ratio;
        
        // Validate calculated position
        if (isValidCoordinate(lat) && isValidCoordinate(lng)) {
          return { lat, lng };
        }
      }
      accumulated += segmentDistance;
    }
    
    // Return end position if distance exceeds route length
    const last = path[path.length - 1];
    if (isValidPoint(last)) {
      return { lat: last[1], lng: last[0] };
    }
    
    // Fallback to first valid point
    for (const point of path) {
      if (isValidPoint(point)) {
        return { lat: point[1], lng: point[0] };
      }
    }
    
    return null;
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

  // Check if map is ready and valid
  const isMapReady = (mapInstance: any): boolean => {
    if (!mapInstance || !L) return false;
    try {
      // Check if map has container method
      if (typeof mapInstance.getContainer !== 'function') return false;
      
      // Check if map has container and is initialized
      const container = mapInstance.getContainer();
      if (!container) return false;
      
      // Check if container is an actual DOM element
      if (!(container instanceof HTMLElement)) return false;
      
      // Check if container is in DOM (it might be detached during cleanup)
      // Use multiple methods to check DOM presence
      const isInDOM = 
        container.isConnected !== undefined 
          ? container.isConnected 
          : document.body.contains(container);
      
      if (!isInDOM) return false;
      
      // Check if map is still valid (not destroyed)
      // Some Leaflet maps might not have these properties, so we check safely
      if (mapInstance._destroyed === true) return false;
      
      return true;
    } catch (error) {
      // If any error occurs during validation, consider map not ready
      return false;
    }
  };

  // Initialize route lines and marker
  useEffect(() => {
    if (!map || routePath.length === 0 || !L) return;
    
    let fullRoute: any = null;
    let visitedRoute: any = null;
    let marker: any = null;
    
    // Use a small delay to ensure map is fully initialized
    // This is especially important when component mounts quickly
    const timeoutId = setTimeout(() => {
      // Validate map is ready before adding layers
      if (!isMapReady(map)) {
        console.warn('Map is not ready, skipping RouteAnimation initialization');
        return;
      }
    
      // Validate fromLocation and toLocation
      if (!isValidCoordinate(fromLocation?.lat) || !isValidCoordinate(fromLocation?.lng) ||
          !isValidCoordinate(toLocation?.lat) || !isValidCoordinate(toLocation?.lng)) {
        console.error('Invalid fromLocation or toLocation:', { fromLocation, toLocation });
        return;
      }
      
      // Validate routePath
      const validPath = routePath.filter(point => isValidPoint(point));
      if (validPath.length === 0) {
        console.error('No valid points in routePath:', routePath);
        return;
      }

      // Full route line (unvisited - gray) - filter invalid points
      const validRoutePath = routePath.filter(point => isValidPoint(point));
      if (validRoutePath.length === 0) return;
      
      try {
        // Double-check map is still ready before each addTo call
        if (!isMapReady(map)) {
          console.warn('Map became invalid during initialization');
          return;
        }
        
        fullRoute = L.polyline(
          validRoutePath.map(([lng, lat]) => [lat, lng] as [number, number]),
          {
            color: routeColor,
            weight: routeWidth,
            opacity: 0.6,
            dashArray: '5, 5', // Dashed line for unvisited
          }
        );
        
        if (isMapReady(map)) {
          fullRoute.addTo(map);
          routeLineRef.current = fullRoute;
        } else {
          console.warn('Map became invalid before adding route line');
          return;
        }

        // Visited route line (highlighted - colored)
        visitedRoute = L.polyline([], {
          color: visitedColor,
          weight: routeWidth + 2, // Slightly thicker
          opacity: 1,
        });
        
        if (isMapReady(map)) {
          visitedRoute.addTo(map);
          visitedLineRef.current = visitedRoute;
        } else {
          console.warn('Map became invalid before adding visited route line');
          if (fullRoute) {
            try { fullRoute.remove(); } catch (e) {}
          }
          return;
        }

        // Create marker at starting position
        const icon = createIcon();
        if (!icon) {
          console.warn('Failed to create icon');
          return;
        }
        
        marker = L.marker([fromLocation.lat, fromLocation.lng], {
          icon,
          zIndexOffset: 1000,
        });
        
        if (isMapReady(map)) {
          marker.addTo(map);
          markerRef.current = marker;
        } else {
          console.warn('Map became invalid before adding marker');
          if (fullRoute) {
            try { fullRoute.remove(); } catch (e) {}
          }
          if (visitedRoute) {
            try { visitedRoute.remove(); } catch (e) {}
          }
          return;
        }
      } catch (error) {
        console.error('Error initializing RouteAnimation:', error);
        // Cleanup on error
        if (fullRoute) {
          try { fullRoute.remove(); } catch (e) {}
        }
        if (visitedRoute) {
          try { visitedRoute.remove(); } catch (e) {}
        }
        if (marker) {
          try { marker.remove(); } catch (e) {}
        }
      }
    }, 100); // Small delay to ensure map container is ready

    return () => {
      // Clear timeout if component unmounts before timeout executes
      clearTimeout(timeoutId);
      
      // Cleanup refs that might have been set (this is the safe way since
      // local variables might not be set if timeout hasn't executed yet)
      try {
        if (routeLineRef.current) {
          routeLineRef.current.remove();
        }
      } catch (error) {
        console.warn('Error removing routeLineRef:', error);
      }
      
      try {
        if (visitedLineRef.current) {
          visitedLineRef.current.remove();
        }
      } catch (error) {
        console.warn('Error removing visitedLineRef:', error);
      }
      
      try {
        if (markerRef.current) {
          markerRef.current.remove();
        }
      } catch (error) {
        console.warn('Error removing markerRef:', error);
      }
      
      // Also cleanup local variables if they were set
      try {
        if (fullRoute) {
          fullRoute.remove();
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
      
      try {
        if (visitedRoute) {
          visitedRoute.remove();
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
      
      try {
        if (marker) {
          marker.remove();
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
      
      // Clear refs
      routeLineRef.current = null;
      visitedLineRef.current = null;
      markerRef.current = null;
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
      if (markerRef.current && isValidCoordinate(fromLocation?.lat) && isValidCoordinate(fromLocation?.lng)) {
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
        // Validate position before setting
        if (isValidCoordinate(currentPosition.lat) && isValidCoordinate(currentPosition.lng)) {
          markerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);
          
          // Emit position update for camera follow
          if (onPositionUpdate) {
            onPositionUpdate(currentPosition, progress);
          }
          
          // Camera follow: pan map to keep icon centered
          if (followCamera && map) {
            try {
              const currentZoom = map.getZoom();
              const targetZoom = followCameraZoom ?? currentZoom;
              
              // Use panTo for smooth following (no animation delay)
              map.panTo([currentPosition.lat, currentPosition.lng], {
                animate: true,
                duration: 0.1, // Very short duration for smooth following
                easeLinearity: 1,
              });
              
              // Adjust zoom if different from target
              if (followCameraZoom && Math.abs(currentZoom - targetZoom) > 0.5) {
                map.setZoom(targetZoom, { animate: true });
              }
            } catch (e) {
              // Ignore pan errors (map might be in transition)
            }
          }
        } else {
          console.warn('Invalid currentPosition, skipping update:', currentPosition);
        }
        
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
  }, [isPlaying, routePath, durationMs, fromLocation, onComplete, L, followCamera, followCameraZoom, map, onPositionUpdate]);

  return null; // This component doesn't render anything visible
}

