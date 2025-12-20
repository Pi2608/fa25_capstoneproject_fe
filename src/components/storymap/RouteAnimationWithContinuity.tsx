"use client";

import { useRef, useEffect, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useOptionalSharedMarkers } from "@/contexts/SharedMarkerContext";
import { generateIconHtml } from "@/utils/iconHelpers";

export interface RouteAnimationWithContinuityProps {
  map: LeafletMap | null;
  routePath: [number, number][];
  fromLocation: { lat: number; lng: number };
  toLocation: { lat: number; lng: number };
  iconType?: string;
  iconUrl?: string;
  routeColor?: string;
  visitedColor?: string;
  routeWidth?: number;
  durationMs: number;
  isPlaying: boolean;
  onComplete?: () => void;
  followCamera?: boolean;
  followCameraZoom?: number;
  onPositionUpdate?: (position: { lat: number; lng: number }, progress: number) => void;
  segmentCameraState?: { center: [number, number]; zoom: number } | null;
  skipInitialCameraState?: boolean;
  routeId?: string; // NEW: For icon continuity
}

/**
 * RouteAnimation with Icon Continuity
 * Full-featured route animation with shared marker pooling support
 * Includes Haversine distance calculation, validation, and safety checks
 */
export default function RouteAnimationWithContinuity({
  map,
  routePath,
  fromLocation,
  toLocation,
  iconType = "car",
  iconUrl,
  routeColor = "#666666",
  visitedColor = "#3b82f6",
  routeWidth = 4,
  durationMs,
  isPlaying,
  onComplete,
  followCamera = false,
  followCameraZoom,
  onPositionUpdate,
  segmentCameraState,
  skipInitialCameraState = false,
  routeId,
}: RouteAnimationWithContinuityProps) {
  const markerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const visitedLineRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  // CRITICAL: Track if animation has completed to prevent restart
  const hasCompletedRef = useRef<boolean>(false);

  // Get shared marker context
  const sharedMarkers = useOptionalSharedMarkers();
  const chainId = sharedMarkers?.getChainId(routeId || "");
  const useSharedMarker = !!(chainId && sharedMarkers?.isPartOfChain(routeId || ""));

  // Camera follow optimization
  const lastCameraUpdateRef = useRef<number>(0);
  const cameraUpdateThrottleMs = 16;
  const isMapAnimatingRef = useRef<boolean>(false);
  const [L, setL] = useState<any>(null);

  // Dynamic import Leaflet only on client-side
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet").then((leaflet) => {
        setL(leaflet.default);
      });
    }
  }, []);

  // Reset completion flag when route changes
  useEffect(() => {
    hasCompletedRef.current = false;
  }, [routePath, fromLocation, toLocation]);

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

    // Generate Iconify SVG icon HTML
    const iconHtml = generateIconHtml(iconType, {
      size: 32,
      color: "#3b82f6",
      dropShadow: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    });

    return L.divIcon({
      html: iconHtml,
      className: "route-animation-icon",
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
    return typeof coord === "number" && !isNaN(coord) && isFinite(coord);
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
      if (typeof mapInstance.getContainer !== "function") return false;

      // Check if map has container and is initialized
      const container = mapInstance.getContainer();
      if (!container) return false;

      // Check if container is an actual DOM element
      if (!(container instanceof HTMLElement)) return false;

      // Check if container is in DOM
      const isInDOM =
        container.isConnected !== undefined
          ? container.isConnected
          : document.body.contains(container);

      if (!isInDOM) return false;

      // Check if map is still valid (not destroyed)
      if (mapInstance._destroyed === true) return false;

      return true;
    } catch (error) {
      return false;
    }
  };

  // Initialize route lines and marker (only once)
  useEffect(() => {
    if (!map || routePath.length === 0 || !L) return;

    // Skip if already initialized
    if (routeLineRef.current && visitedLineRef.current && markerRef.current) {
      try {
        const validRoutePath = routePath.filter((point) => isValidPoint(point));
        if (validRoutePath.length > 0 && routeLineRef.current) {
          routeLineRef.current.setLatLngs(
            validRoutePath.map(([lng, lat]) => [lat, lng] as [number, number])
          );
        }
      } catch (e) {
        console.warn("Failed to update route line:", e);
      }
      return;
    }

    let fullRoute: any = null;
    let visitedRoute: any = null;
    let marker: any = null;

    // Use a small delay to ensure map is fully initialized
    const timeoutId = setTimeout(() => {
      // Validate map is ready before adding layers
      if (!isMapReady(map)) {
        console.warn("Map is not ready, skipping RouteAnimation initialization");
        return;
      }

      // Validate fromLocation and toLocation
      if (
        !isValidCoordinate(fromLocation?.lat) ||
        !isValidCoordinate(fromLocation?.lng) ||
        !isValidCoordinate(toLocation?.lat) ||
        !isValidCoordinate(toLocation?.lng)
      ) {
        console.error("Invalid fromLocation or toLocation:", { fromLocation, toLocation });
        return;
      }

      // Validate routePath
      const validPath = routePath.filter((point) => isValidPoint(point));
      if (validPath.length === 0) {
        console.error("No valid points in routePath:", routePath);
        return;
      }

      // Full route line (unvisited - gray)
      const validRoutePath = routePath.filter((point) => isValidPoint(point));
      if (validRoutePath.length === 0) return;

      try {
        if (!isMapReady(map)) {
          console.warn("Map became invalid during initialization");
          return;
        }

        // Only create if not already exists
        if (!routeLineRef.current) {
          fullRoute = L.polyline(
            validRoutePath.map(([lng, lat]) => [lat, lng] as [number, number]),
            {
              color: routeColor,
              weight: routeWidth,
              opacity: 0.6,
              dashArray: "5, 5",
            }
          );

          if (isMapReady(map)) {
            fullRoute.addTo(map);
            routeLineRef.current = fullRoute;
          } else {
            console.warn("Map became invalid before adding route line");
            return;
          }
        }

        // Visited route line
        if (!visitedLineRef.current) {
          visitedRoute = L.polyline([], {
            color: visitedColor,
            weight: routeWidth + 2,
            opacity: 1,
          });

          if (isMapReady(map)) {
            visitedRoute.addTo(map);
            visitedLineRef.current = visitedRoute;
          } else {
            console.warn("Map became invalid before adding visited route line");
            if (fullRoute) {
              try {
                fullRoute.remove();
              } catch (e) {}
            }
            return;
          }
        }

        // BRANCH: Create marker - shared OR standalone
        if (!markerRef.current) {
          if (useSharedMarker && chainId && sharedMarkers) {
            console.log(`[Icon Continuity] Using shared marker for chain: ${chainId}`);

            // Get or create shared marker
            marker = sharedMarkers.createOrGetMarker(
              chainId,
              L,
              {
                iconType: iconType as any,
                iconUrl,
                iconSize: [32, 32],
              },
              fromLocation
            );

            markerRef.current = marker;
          } else {
            console.log(`[Icon Continuity] Creating standalone marker for route: ${routeId}`);

            // Create standalone marker
            const icon = createIcon();
            if (!icon) {
              console.warn("Failed to create icon");
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
              console.warn("Map became invalid before adding marker");
              if (fullRoute) {
                try {
                  fullRoute.remove();
                } catch (e) {}
              }
              if (visitedRoute) {
                try {
                  visitedRoute.remove();
                } catch (e) {}
              }
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error initializing RouteAnimation:", error);
        // Cleanup on error
        if (fullRoute) {
          try {
            fullRoute.remove();
          } catch (e) {}
        }
        if (visitedRoute) {
          try {
            visitedRoute.remove();
          } catch (e) {}
        }
        if (marker && !useSharedMarker) {
          try {
            marker.remove();
          } catch (e) {}
        }
      }
    }, 100); // Small delay to ensure map container is ready

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    map,
    routePath,
    fromLocation,
    toLocation,
    routeColor,
    visitedColor,
    routeWidth,
    iconType,
    iconUrl,
    L,
    useSharedMarker,
    chainId,
  ]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      try {
        if (routeLineRef.current) {
          routeLineRef.current.remove();
          routeLineRef.current = null;
        }
      } catch (error) {
        console.warn("Error removing routeLineRef:", error);
      }

      try {
        if (visitedLineRef.current) {
          visitedLineRef.current.remove();
          visitedLineRef.current = null;
        }
      } catch (error) {
        console.warn("Error removing visitedLineRef:", error);
      }

      try {
        // Only remove standalone markers
        if (!useSharedMarker && markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
      } catch (error) {
        console.warn("Error removing markerRef:", error);
      }
    };
  }, []); // Empty dependency array - only cleanup on unmount

  // Apply segment camera state when animation starts
  const segmentCameraAppliedRef = useRef(false);
  const cameraAnimationCompleteRef = useRef(false);

  useEffect(() => {
    // Skip applying camera state if skipInitialCameraState is true
    if (skipInitialCameraState) {
      if (isPlaying && !segmentCameraAppliedRef.current) {
        segmentCameraAppliedRef.current = true;
        cameraAnimationCompleteRef.current = true;
        isMapAnimatingRef.current = false;
      }
      if (!isPlaying) {
        segmentCameraAppliedRef.current = false;
        cameraAnimationCompleteRef.current = false;
        isMapAnimatingRef.current = false;
      }
      return;
    }

    // Original logic - apply camera state in PARALLEL with route animation
    if (isPlaying && segmentCameraState && map && !segmentCameraAppliedRef.current) {
      segmentCameraAppliedRef.current = true;
      cameraAnimationCompleteRef.current = true;

      isMapAnimatingRef.current = true;

      (async () => {
        try {
          const [lng, lat] = segmentCameraState.center;
          const targetCenter: [number, number] = [lat, lng];
          const targetZoom = segmentCameraState.zoom;

          map.setView(targetCenter, targetZoom, {
            animate: true,
            duration: 0.8,
            easeLinearity: 0.25,
          });

          await new Promise((resolve) => setTimeout(resolve, 900));

          isMapAnimatingRef.current = false;
        } catch (e) {
          console.warn("Failed to apply segment camera state:", e);
          isMapAnimatingRef.current = false;
        }
      })();
    }

    if (!isPlaying) {
      segmentCameraAppliedRef.current = false;
      cameraAnimationCompleteRef.current = false;
      isMapAnimatingRef.current = false;
    }
  }, [isPlaying, segmentCameraState, map, followCamera, followCameraZoom, skipInitialCameraState]);

  // Animation loop
  useEffect(() => {
    // Always ensure marker and route lines exist
    if (routePath.length === 0 || !L) {
      return;
    }

    // Wait for marker to be initialized
    if (!markerRef.current) {
      return;
    }

    if (!isPlaying) {
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
      hasCompletedRef.current = false;

      // Mark shared marker as stopped
      if (useSharedMarker && chainId && routeId && sharedMarkers) {
        sharedMarkers.setMarkerAnimating(chainId, routeId, false);
      }
      return;
    }

    // CRITICAL: Prevent animation restart if already completed
    if (hasCompletedRef.current) {
      return;
    }

    // Mark shared marker as animating
    if (useSharedMarker && chainId && routeId && sharedMarkers) {
      console.log(`[Icon Continuity] Starting animation for route: ${routeId}`);
      sharedMarkers.setMarkerAnimating(chainId, routeId, true);
    }

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / durationMs, 1);

      setProgress(progress);

      // Calculate position along route using Haversine distance
      const totalDistance = calculateRouteDistance(routePath);
      const traveledDistance = totalDistance * progress;

      const currentPosition = getPositionAlongRoute(routePath, traveledDistance);

      // Update marker position
      if (markerRef.current && currentPosition) {
        // Validate position before setting
        if (isValidCoordinate(currentPosition.lat) && isValidCoordinate(currentPosition.lng)) {
          markerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);

          // Update shared marker position
          if (useSharedMarker && chainId && sharedMarkers) {
            sharedMarkers.updateMarkerPosition(chainId, currentPosition);
          }

          // Emit position update for camera follow
          if (onPositionUpdate) {
            onPositionUpdate(currentPosition, progress);
          }

          // Camera follow: gimbal lock - always keep icon centered smoothly
          if (followCamera && map && !isMapAnimatingRef.current) {
            const now = Date.now();
            const timeSinceLastUpdate = now - lastCameraUpdateRef.current;

            if (timeSinceLastUpdate >= cameraUpdateThrottleMs) {
              try {
                const currentZoom = map.getZoom();

                lastCameraUpdateRef.current = now;

                // Use panTo for smooth continuous following
                map.panTo([currentPosition.lat, currentPosition.lng], {
                  animate: true,
                  duration: 0.15,
                  easeLinearity: 0.05,
                  noMoveStart: true,
                });

                // Update zoom if followCameraZoom is provided
                if (followCameraZoom != null && Math.abs(currentZoom - followCameraZoom) > 0.5) {
                  map.setZoom(followCameraZoom, {
                    animate: true,
                    duration: 0.15,
                  });
                }
              } catch (e) {
                // Ignore pan errors
              }
            }
          }
        } else {
          console.warn("Invalid currentPosition, skipping update:", currentPosition);
        }

        // Calculate rotation based on direction
        const direction = calculateDirection(routePath, progress);
        if (direction !== null && markerRef.current.options.icon && L) {
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
        // Mark animation as completed
        hasCompletedRef.current = true;
        console.log(`[Icon Continuity] Animation complete for route: ${routeId}`);

        // Mark shared marker as stopped
        if (useSharedMarker && chainId && routeId && sharedMarkers) {
          sharedMarkers.setMarkerAnimating(chainId, routeId, false);
        }

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
  }, [
    isPlaying,
    routePath,
    durationMs,
    fromLocation,
    onComplete,
    L,
    followCamera,
    followCameraZoom,
    map,
    onPositionUpdate,
    useSharedMarker,
    chainId,
    routeId,
  ]);

  return null;
}
