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
      
      // Thay đổi cursor khi đang pick location (dấu cộng/crosshair)
      const mapContainer = map.getContainer();
      // Sử dụng crosshair cho dấu cộng, hoặc có thể tạo custom cursor
      mapContainer.style.cursor = 'crosshair';
      // Đảm bảo cursor được apply ngay
      mapContainer.style.setProperty('cursor', 'crosshair', 'important');

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

    const handleStopPickLocation = () => {
      const map = mapRef.current;
      if (!map) return;

      isPickingPoi = false;
      
      // Reset cursor
      const mapContainer = map.getContainer();
      mapContainer.style.cursor = '';

      // Remove click handler nếu có
      if (clickHandler) {
        map.off('click', clickHandler);
        clickHandler = null;
      }
    };

    window.addEventListener('poi:startPickLocation', handleStartPickLocation);
    window.addEventListener('poi:stopPickLocation', handleStopPickLocation);

    return () => {
      window.removeEventListener('poi:startPickLocation', handleStartPickLocation);
      window.removeEventListener('poi:stopPickLocation', handleStopPickLocation);
      if (clickHandler && mapRef.current) {
        mapRef.current.off('click', clickHandler);
      }
      // Reset cursor khi cleanup
      if (mapRef.current) {
        mapRef.current.getContainer().style.cursor = '';
      }
    };
  }, [mapRef]);
}
