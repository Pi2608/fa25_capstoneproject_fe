"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type {
  TeacherFocusChangedEvent,
  MapStateSyncEvent,
} from "@/lib/signalr-session";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

interface StudentMapViewProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  teacherFocus?: TeacherFocusChangedEvent | MapStateSyncEvent | null;
  className?: string;
}

export function StudentMapView({
  initialCenter = [10.762622, 106.660172],
  initialZoom = 13,
  teacherFocus,
  className = "",
}: StudentMapViewProps) {
  const [isClient, setIsClient] = useState(false);
  const [showFocusIndicator, setShowFocusIndicator] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle teacher focus changes
  useEffect(() => {
    if (!teacherFocus || !mapRef.current) return;

    // Extract coordinates and zoom (handle both event types)
    const lat = teacherFocus.latitude;
    const lng = teacherFocus.longitude;
    const zoom =
      "zoom" in teacherFocus
        ? teacherFocus.zoom
        : "zoomLevel" in teacherFocus
          ? teacherFocus.zoomLevel
          : initialZoom;

    // Fly to teacher's view
    const map = mapRef.current;
    if (map && map.flyTo) {
      map.flyTo([lat, lng], zoom, {
        duration: 1.5, // Smooth animation
        easeLinearity: 0.25,
      });

      // Show indicator
      setShowFocusIndicator(true);
      setTimeout(() => setShowFocusIndicator(false), 3000);
    }
  }, [teacherFocus, initialZoom]);

  if (!isClient) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full h-96 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={true}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        </MapContainer>

        {/* Teacher Focus Indicator */}
        {showFocusIndicator && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-[1000] animate-bounce">
            <span className="text-lg">👁️</span>
            <span className="font-semibold">Teacher is focusing here</span>
          </div>
        )}
      </div>
    </div>
  );
}

