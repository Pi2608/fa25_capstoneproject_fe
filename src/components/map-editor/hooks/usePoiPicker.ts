"use client";

import { useEffect } from "react";
import type { LeafletMouseEvent } from "leaflet";
import type { MapWithPM } from "../types/mapTypes";

export function usePoiPicker(mapRef: React.RefObject<MapWithPM | null>) {
  useEffect(() => {
    let isPickingPoi = false;
    let clickHandler: ((e: LeafletMouseEvent) => void) | null = null;

    const handleStartPickLocation = () => {
      const map = mapRef.current;
      if (!map) {
        console.warn('⚠️ Map not ready yet');
        return;
      }

      isPickingPoi = true;
      
      // Thay đổi cursor khi đang pick location
      const mapContainer = map.getContainer();
      mapContainer.style.cursor = 'crosshair';

      // Xử lý click trên map
      clickHandler = (e: LeafletMouseEvent) => {
        if (!isPickingPoi) return;

        const { lat, lng } = e.latlng;
        
        // Dispatch event với tọa độ đã chọn
        window.dispatchEvent(
          new CustomEvent("poi:locationPicked", {
            detail: {
              lngLat: [lng, lat],
            },
          })
        );

        // Reset cursor và tắt picking mode
        mapContainer.style.cursor = '';
        isPickingPoi = false;
        
        if (clickHandler) {
          map.off('click', clickHandler);
          clickHandler = null;
        }
      };

      map.on('click', clickHandler);
    };

    window.addEventListener('poi:startPickLocation', handleStartPickLocation);

    return () => {
      window.removeEventListener('poi:startPickLocation', handleStartPickLocation);
      if (clickHandler && mapRef.current) {
        mapRef.current.off('click', clickHandler);
      }
    };
  }, [mapRef]);
}
