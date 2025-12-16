"use client";

import { useEffect } from "react";

export default function LeafletStylesClient() {
  useEffect(() => {
    // Inject Leaflet CSS via CDN link tags at runtime to avoid build-time url resolution
    const leafletLink = document.createElement("link");
    leafletLink.rel = "stylesheet";
    leafletLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    leafletLink.crossOrigin = "";

    const geomanLink = document.createElement("link");
    geomanLink.rel = "stylesheet";
    geomanLink.href = "https://unpkg.com/@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
    geomanLink.crossOrigin = "";

    document.head.appendChild(leafletLink);
    document.head.appendChild(geomanLink);

    return () => {
      try {
        document.head.removeChild(leafletLink);
      } catch (_) {}
      try {
        document.head.removeChild(geomanLink);
      } catch (_) {}
    };
  }, []);

  return null;
}
