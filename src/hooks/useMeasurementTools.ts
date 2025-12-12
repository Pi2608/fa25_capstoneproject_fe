import { useState, useRef, useCallback, useEffect } from 'react';
import type L from 'leaflet';
import type { MapWithPM } from '@/types';
import {
  calculateDistance,
  calculateArea,
  formatDistance,
  formatArea,
} from '@/lib/measurement-utils';
import type { MeasurementState, MeasurementMode } from '@/types/measurement';

export function useMeasurementTools(
  mapRef: React.RefObject<MapWithPM | null>
) {
  const [state, setState] = useState<MeasurementState>({
    mode: null,
    isActive: false,
    points: [],
    currentValue: 0,
    layer: null,
    tooltip: null,
  });

  const pointsRef = useRef<L.LatLng[]>([]);
  const layerRef = useRef<L.Polyline | L.Polygon | null>(null);
  const clickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  const mapClickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);

  // Cancel measurement
  const cancelMeasurement = useCallback(() => {
    if (!mapRef.current) return;

    // Remove layer from map
    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    // Reset state
    setState({
      mode: null,
      isActive: false,
      points: [],
      currentValue: 0,
      layer: null,
      tooltip: null,
    });

    pointsRef.current = [];

    // Reset cursor
    if (mapRef.current) {
      mapRef.current.getContainer().style.cursor = '';
    }

    // Remove click handlers
    if (clickHandlerRef.current && mapRef.current) {
      mapRef.current.off('click', clickHandlerRef.current);
      clickHandlerRef.current = null;
    }
  }, [mapRef]);

  // Start measurement mode
  const startMeasurement = useCallback(
    (mode: 'distance' | 'area') => {
      if (!mapRef.current) return;

      // Cancel any existing measurement
      cancelMeasurement();

      // Update state
      setState({
        mode,
        isActive: true,
        points: [],
        currentValue: 0,
        layer: null,
        tooltip: null,
      });

      pointsRef.current = [];

      // Change cursor
      mapRef.current.getContainer().style.cursor = 'crosshair';

      // Disable other map interactions (Geoman)
      if (mapRef.current.pm) {
        mapRef.current.pm.disableDraw();
      }
    },
    [mapRef, cancelMeasurement]
  );

  // Handle map click when in measurement mode
  useEffect(() => {
    if (!mapRef.current || !state.isActive) {
      // Clean up if not active
      if (clickHandlerRef.current && mapRef.current) {
        mapRef.current.off('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
      return;
    }

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const L = (await import('leaflet')).default;

      // Add point
      pointsRef.current.push(e.latlng);

      // Update layer
      if (state.mode === 'distance') {
        // Create or update polyline
        if (!layerRef.current && mapRef.current) {
          layerRef.current = L.polyline(pointsRef.current, {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 10',
          }).addTo(mapRef.current);
        } else if (layerRef.current) {
          (layerRef.current as L.Polyline).setLatLngs(pointsRef.current);
        }

        // Calculate distance
        const distance = calculateDistance(pointsRef.current);
        setState((prev) => ({
          ...prev,
          points: [...pointsRef.current],
          currentValue: distance,
          layer: layerRef.current,
        }));

        // Update tooltip
        const formattedDistance = formatDistance(distance);
        if (layerRef.current) {
          layerRef.current
            .bindTooltip(formattedDistance, {
              permanent: true,
              direction: 'top',
              className: 'measurement-tooltip',
            })
            .openTooltip();
        }
      } else if (state.mode === 'area') {
        // Create or update polygon
        if (!layerRef.current && pointsRef.current.length >= 3 && mapRef.current) {
          layerRef.current = L.polygon(pointsRef.current, {
            color: '#10b981',
            weight: 2,
            fillColor: '#10b981',
            fillOpacity: 0.2,
            dashArray: '5, 10',
          }).addTo(mapRef.current);
        } else if (layerRef.current) {
          (layerRef.current as L.Polygon).setLatLngs(pointsRef.current);
        }

        // Calculate area
        if (pointsRef.current.length >= 3) {
          const area = calculateArea(pointsRef.current);
          setState((prev) => ({
            ...prev,
            points: [...pointsRef.current],
            currentValue: area,
            layer: layerRef.current,
          }));

          // Update tooltip
          const formattedArea = formatArea(area);
          if (layerRef.current && mapRef.current) {
            layerRef.current
              .bindTooltip(formattedArea, {
                permanent: true,
                direction: 'center',
                className: 'measurement-tooltip',
              })
              .openTooltip();
          }
        }
      }
    };

    clickHandlerRef.current = handleMapClick;
    mapRef.current.on('click', handleMapClick);

    return () => {
      if (mapRef.current && clickHandlerRef.current) {
        mapRef.current.off('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
    };
  }, [mapRef, state.isActive, state.mode]);

  // Handle clicking elsewhere to dismiss measurement (when not actively drawing)
  useEffect(() => {
    if (!mapRef.current || state.isActive) {
      // Don't dismiss if actively drawing
      if (mapClickHandlerRef.current && mapRef.current) {
        mapRef.current.off('click', mapClickHandlerRef.current);
        mapClickHandlerRef.current = null;
      }
      return;
    }

    // Only dismiss if we have a measurement but not actively drawing
    if (state.points.length > 0 && state.layer && mapRef.current) {
      const handleMapClick = (e: L.LeafletMouseEvent) => {
        // Only dismiss if clicking on empty map area (not on a feature)
        const target = e.originalEvent.target;
        if (
          target &&
          target instanceof HTMLElement &&
          !target.closest('.leaflet-interactive') &&
          !target.closest('.measurement-tooltip')
        ) {
          cancelMeasurement();
        }
      };

      mapClickHandlerRef.current = handleMapClick;
      mapRef.current.on('click', handleMapClick);

      return () => {
        if (mapRef.current && mapClickHandlerRef.current) {
          mapRef.current.off('click', mapClickHandlerRef.current);
          mapClickHandlerRef.current = null;
        }
      };
    }
  }, [mapRef, state.isActive, state.points.length, state.layer, cancelMeasurement]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Escape' && state.isActive) {
        e.preventDefault();
        cancelMeasurement();
      } else if (
        e.key === 'Enter' &&
        state.isActive &&
        state.points.length >= (state.mode === 'distance' ? 2 : 3)
      ) {
        // Finalize measurement (keep on map until dismissed)
        e.preventDefault();
        setState((prev) => ({ ...prev, isActive: false }));
        if (mapRef.current) {
          mapRef.current.getContainer().style.cursor = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isActive, state.points.length, state.mode, cancelMeasurement, mapRef]);

  return {
    state,
    startMeasurement,
    cancelMeasurement,
    isDistanceMode: state.mode === 'distance',
    isAreaMode: state.mode === 'area',
  };
}

