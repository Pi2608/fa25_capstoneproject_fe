/**
 * Shared Marker Manager
 * Manages icon continuity across segments and route animations
 * Prevents marker recreation and enables smooth icon transitions
 */

import { useRef, useCallback, useEffect } from 'react';
import type L from 'leaflet';
import { generateIconHtml } from '@/utils/iconHelpers';

export interface MarkerConfig {
  iconType: 'car' | 'walking' | 'bike' | 'plane' | 'bus' | 'train' | 'motorcycle' | 'boat' | 'truck' | 'helicopter' | 'custom';
  iconUrl?: string;
  iconSize?: [number, number];
}

export interface RouteChainInfo {
  routeId: string;
  segmentId: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  iconType: string;
  startTimeMs?: number | null;
  durationMs: number;
}

/**
 * Detect if two locations are the same (with small tolerance for floating point)
 */
function locationsMatch(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  tolerance: number = 0.0001
): boolean {
  return (
    Math.abs(lat1 - lat2) < tolerance &&
    Math.abs(lng1 - lng2) < tolerance
  );
}

/**
 * Find route chains: routes that connect end-to-end with same icon type
 */
export function detectRouteChains(routes: RouteChainInfo[]): Map<string, string> {
  const routeToChainId = new Map<string, string>();
  const chains: RouteChainInfo[][] = [];

  // Sort routes by segment order and start time
  const sortedRoutes = [...routes].sort((a, b) => {
    if (a.segmentId !== b.segmentId) {
      return a.segmentId.localeCompare(b.segmentId);
    }
    const aStart = a.startTimeMs ?? 0;
    const bStart = b.startTimeMs ?? 0;
    return aStart - bStart;
  });

  // Build chains
  sortedRoutes.forEach((route) => {
    let addedToChain = false;

    // Try to add to existing chain
    for (const chain of chains) {
      const lastInChain = chain[chain.length - 1];

      // Check if this route continues from the last route in chain
      const connects = locationsMatch(
        lastInChain.toLat,
        lastInChain.toLng,
        route.fromLat,
        route.fromLng
      );

      const sameIconType = lastInChain.iconType === route.iconType;

      if (connects && sameIconType) {
        chain.push(route);
        addedToChain = true;
        break;
      }
    }

    // Create new chain if not added
    if (!addedToChain) {
      chains.push([route]);
    }
  });

  // Assign chain IDs
  chains.forEach((chain, chainIndex) => {
    const chainId = `chain-${chainIndex}-${chain[0].iconType}`;
    chain.forEach((route) => {
      routeToChainId.set(route.routeId, chainId);
    });
  });

  return routeToChainId;
}

/**
 * Hook to manage shared markers across route animations
 */
export function useSharedMarkerManager(map: L.Map | null) {
  // Store markers by chain ID
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Store marker animation states
  const markerStatesRef = useRef<Map<string, {
    isAnimating: boolean;
    currentRoute: string | null;
    position: { lat: number; lng: number };
  }>>(new Map());

  /**
   * Create or get existing marker for a chain
   */
  const createOrGetMarker = useCallback((
    chainId: string,
    L: typeof import('leaflet'),
    config: MarkerConfig,
    initialPosition: { lat: number; lng: number }
  ): L.Marker | null => {
    if (!map) return null;

    // Return existing marker if available
    if (markersRef.current.has(chainId)) {
      const marker = markersRef.current.get(chainId)!;
      // Update position if marker exists
      marker.setLatLng([initialPosition.lat, initialPosition.lng]);
      return marker;
    }

    // Create new marker
    const iconSize = config.iconSize || [32, 32];

    let icon: L.Icon | L.DivIcon;
    if (config.iconUrl) {
      icon = L.icon({
        iconUrl: config.iconUrl,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
      });
    } else {
      // Generate Iconify SVG icon HTML
      const iconHtml = generateIconHtml(config.iconType, {
        size: iconSize[0],
        color: '#3b82f6',
        dropShadow: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
      });

      icon = L.divIcon({
        html: iconHtml,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
        className: 'route-animation-marker',
      });
    }

    const marker = L.marker([initialPosition.lat, initialPosition.lng], {
      icon,
      zIndexOffset: 1000,
    });

    marker.addTo(map);
    markersRef.current.set(chainId, marker);

    // Initialize state
    markerStatesRef.current.set(chainId, {
      isAnimating: false,
      currentRoute: null,
      position: initialPosition,
    });

    return marker;
  }, [map]);

  /**
   * Update marker position
   */
  const updateMarkerPosition = useCallback((
    chainId: string,
    position: { lat: number; lng: number }
  ) => {
    const marker = markersRef.current.get(chainId);
    if (marker) {
      marker.setLatLng([position.lat, position.lng]);

      const state = markerStatesRef.current.get(chainId);
      if (state) {
        state.position = position;
      }
    }
  }, []);

  /**
   * Mark marker as animating
   */
  const setMarkerAnimating = useCallback((
    chainId: string,
    routeId: string,
    isAnimating: boolean
  ) => {
    const state = markerStatesRef.current.get(chainId);
    if (state) {
      state.isAnimating = isAnimating;
      state.currentRoute = isAnimating ? routeId : null;
    }
  }, []);

  /**
   * Check if marker is currently animating
   */
  const isMarkerAnimating = useCallback((chainId: string): boolean => {
    const state = markerStatesRef.current.get(chainId);
    return state?.isAnimating ?? false;
  }, []);

  /**
   * Remove marker from map
   */
  const removeMarker = useCallback((chainId: string) => {
    const marker = markersRef.current.get(chainId);
    if (marker && map) {
      map.removeLayer(marker);
      markersRef.current.delete(chainId);
      markerStatesRef.current.delete(chainId);
    }
  }, [map]);

  /**
   * Cleanup all markers
   */
  const cleanup = useCallback(() => {
    if (!map) return;

    markersRef.current.forEach((marker) => {
      try {
        map.removeLayer(marker);
      } catch (e) {
        console.warn('Failed to remove marker:', e);
      }
    });

    markersRef.current.clear();
    markerStatesRef.current.clear();
  }, [map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    createOrGetMarker,
    updateMarkerPosition,
    setMarkerAnimating,
    isMarkerAnimating,
    removeMarker,
    cleanup,
    markers: markersRef.current,
  };
}
