"use client";

import { useEffect, useRef, useCallback } from "react";
import type { TileLayer } from "leaflet";
import type { MapWithPM, BaseKey } from "../types/mapTypes";

export function useBaseLayer(mapRef: React.RefObject<MapWithPM | null>) {
  const baseRef = useRef<TileLayer | null>(null);

  const applyBaseLayer = useCallback((kind: BaseKey) => {
    const map = mapRef.current;
    if (!map) return;

    if (baseRef.current) {
      map.removeLayer(baseRef.current);
      baseRef.current = null;
    }

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!key) {
      console.error("Missing NEXT_PUBLIC_MAPTILER_KEY");
    }

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      const attribution =
        '© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> ' +
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

      const commonOpts: L.TileLayerOptions = {
        minZoom: 0,
        maxZoom: 20,
        attribution,
        crossOrigin: true,
        errorTileUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      };

      let url = "";
      if (kind === "sat") {
        url = `https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=${key}`;
      } else if (kind === "dark") {
        url = `https://api.maptiler.com/maps/dark-v2/256/{z}/{x}/{y}.png?key=${key}`;
      } else {
        url = `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${key}`;
      }

      if (cancelled) return;
      const layer = L.tileLayer(url, commonOpts);

      if ((map as unknown as { _loaded?: boolean })._loaded === false) {
        map.whenReady(() => {
          if (!cancelled) {
            layer.addTo(map);
            baseRef.current = layer;
          }
        });
      } else {
        layer.addTo(map);
        baseRef.current = layer;
      }
    })();

    return () => { cancelled = true; };
  }, [mapRef]);

  return { applyBaseLayer };
}
