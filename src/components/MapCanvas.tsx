"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap, LeafletEvent, Layer } from "leaflet";

type PMCreateEvent = LeafletEvent & { layer: Layer };

type MapWithPM = LMap & {
  pm: {
    addControls: (opts: {
      position?: string;
      drawMarker?: boolean;
      drawPolyline?: boolean;
      drawRectangle?: boolean;
      drawPolygon?: boolean;
      drawCircle?: boolean;
      drawCircleMarker?: boolean;
      drawText?: boolean;
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      removalMode?: boolean;
    }) => void;
  };
};

export default function MapCanvas({ isAllowed }: { isAllowed: (name: string) => boolean }) {
  const mapRef = useRef<LMap | null>(null);

  useEffect(() => {
    (async () => {
      const L = await import("leaflet");
      await import("@geoman-io/leaflet-geoman-free");

      if (mapRef.current) return;

      const map = (L.map("map-canvas", { zoomControl: true }).setView([10.775, 106.69], 12)) as MapWithPM;
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      map.pm.addControls({
        position: "topleft",
        drawMarker: isAllowed("Pin") || isAllowed("Marker") || isAllowed("CircleMarker"),
        drawPolyline: isAllowed("Line"),
        drawPolygon: isAllowed("Polygon"),
        drawCircle: isAllowed("Circle"),
        drawCircleMarker: isAllowed("CircleMarker"),
        drawText: isAllowed("Text") || isAllowed("Label"),
        editMode: true,
        dragMode: true,
        cutPolygon: isAllowed("Clip") || isAllowed("Cut"),
        removalMode: true,
      });

      map.on("pm:create", (e: PMCreateEvent) => {
        console.log("New layer created", e.layer);
      });
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isAllowed]);

  return <div id="map-canvas" className="h-[60vh] w-full rounded-xl border border-white/10" aria-label="Interactive map" />;
}
