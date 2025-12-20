"use client";

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import type { Segment, RouteAnimation } from '@/lib/api-storymap';
import {
  useSharedMarkerManager,
  detectRouteChains,
  type RouteChainInfo,
  type MarkerConfig
} from '@/hooks/useSharedMarkerManager';
import type L from 'leaflet';

interface SharedMarkerContextValue {
  // Get chain ID for a route
  getChainId: (routeId: string) => string | undefined;

  // Check if route is part of a chain
  isPartOfChain: (routeId: string) => boolean;

  // Get or create marker for a chain
  createOrGetMarker: (
    chainId: string,
    L: typeof import('leaflet'),
    config: MarkerConfig,
    initialPosition: { lat: number; lng: number }
  ) => L.Marker | null;

  // Update marker position
  updateMarkerPosition: (chainId: string, position: { lat: number; lng: number }) => void;

  // Mark marker as animating
  setMarkerAnimating: (chainId: string, routeId: string, isAnimating: boolean) => void;

  // Check if marker is animating
  isMarkerAnimating: (chainId: string) => boolean;

  // Remove marker
  removeMarker: (chainId: string) => void;

  // Cleanup all markers
  cleanup: () => void;
}

const SharedMarkerContext = createContext<SharedMarkerContextValue | null>(null);

export function useSharedMarkers() {
  const context = useContext(SharedMarkerContext);
  if (!context) {
    throw new Error('useSharedMarkers must be used within SharedMarkerProvider');
  }
  return context;
}

/**
 * Optional hook that returns context only if provider exists
 */
export function useOptionalSharedMarkers() {
  return useContext(SharedMarkerContext);
}

interface SharedMarkerProviderProps {
  children: React.ReactNode;
  map: L.Map | null;
  segments: Segment[];
}

export function SharedMarkerProvider({
  children,
  map,
  segments
}: SharedMarkerProviderProps) {
  const markerManager = useSharedMarkerManager(map);

  // Detect route chains from all segments
  const routeToChainMap = useMemo(() => {
    const allRoutes: RouteChainInfo[] = [];

    segments.forEach((segment) => {
      if (!segment.routeAnimations) return;

      segment.routeAnimations.forEach((route) => {
        allRoutes.push({
          routeId: route.routeAnimationId,
          segmentId: segment.segmentId,
          fromLat: route.fromLat,
          fromLng: route.fromLng,
          toLat: route.toLat,
          toLng: route.toLng,
          iconType: route.iconType || 'car',
          startTimeMs: route.startTimeMs,
          durationMs: route.durationMs,
        });
      });
    });

    return detectRouteChains(allRoutes);
  }, [segments]);

  const getChainId = useCallback((routeId: string) => {
    return routeToChainMap.get(routeId);
  }, [routeToChainMap]);

  const isPartOfChain = useCallback((routeId: string) => {
    const chainId = routeToChainMap.get(routeId);
    if (!chainId) return false;

    // Check if there are other routes in this chain
    let count = 0;
    routeToChainMap.forEach((cId) => {
      if (cId === chainId) count++;
    });

    return count > 1;
  }, [routeToChainMap]);

  const value: SharedMarkerContextValue = {
    getChainId,
    isPartOfChain,
    createOrGetMarker: markerManager.createOrGetMarker,
    updateMarkerPosition: markerManager.updateMarkerPosition,
    setMarkerAnimating: markerManager.setMarkerAnimating,
    isMarkerAnimating: markerManager.isMarkerAnimating,
    removeMarker: markerManager.removeMarker,
    cleanup: markerManager.cleanup,
  };

  return (
    <SharedMarkerContext.Provider value={value}>
      {children}
    </SharedMarkerContext.Provider>
  );
}
