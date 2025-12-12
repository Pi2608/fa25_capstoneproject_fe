"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { toast } from "react-toastify";
import * as signalR from "@microsoft/signalr";
import { sendTeacherFocusViaSignalR } from "@/lib/hubs/session";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

// MapEventHandler component - import useMapEvents directly since this is a client component
const MapEventHandler = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { useMapEvents } = mod;
      return function MapEventHandler({
        onViewChange,
      }: {
        onViewChange: (lat: number, lng: number, zoom: number) => void;
      }) {
        const map = useMapEvents({
          moveend: () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            onViewChange(center.lat, center.lng, zoom);
          },
          zoomend: () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            onViewChange(center.lat, center.lng, zoom);
          },
        });

        return null;
      };
    }),
  { ssr: false }
);

interface TeacherMapControlProps {
  sessionId: string;
  connection?: signalR.HubConnection | null;
  initialCenter?: [number, number];
  initialZoom?: number;
  onFocusChange?: (lat: number, lng: number, zoom: number) => void;
  className?: string;
}

export function TeacherMapControl({
  sessionId,
  connection,
  initialCenter = [10.762622, 106.660172],
  initialZoom = 13,
  onFocusChange,
  className = "",
}: TeacherMapControlProps) {
  const [isClient, setIsClient] = useState(false);
  const [currentView, setCurrentView] = useState({
    lat: initialCenter[0],
    lng: initialCenter[1],
    zoom: initialZoom,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleViewChange = useCallback(
    (lat: number, lng: number, zoom: number) => {
      setCurrentView({ lat, lng, zoom });

      if (onFocusChange) {
        onFocusChange(lat, lng, zoom);
      }

      if (autoSync) {
        if (autoSyncTimeoutRef.current) {
          clearTimeout(autoSyncTimeoutRef.current);
        }

        autoSyncTimeoutRef.current = setTimeout(() => {
          handleSyncView(lat, lng, zoom);
        }, 1000);
      }
    },
    [autoSync, onFocusChange]
  );

  const handleSyncView = async (
    lat?: number,
    lng?: number,
    zoom?: number
  ) => {
    if (!connection) {
      toast.error("SignalR connection not available");
      return;
    }

    setIsSyncing(true);

    try {
      const success = await sendTeacherFocusViaSignalR(
        connection,
        sessionId,
        {
          latitude: lat ?? currentView.lat,
          longitude: lng ?? currentView.lng,
          zoomLevel: zoom ?? currentView.zoom,
        }
      );

      if (success) {
        toast.success("Map view synced to all students!");
      } else {
        toast.error("Failed to sync map view");
      }
    } catch (error: any) {
      console.error("Failed to sync map view:", error);
      toast.error(error?.message || "Failed to sync map view");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = () => {
    handleSyncView();
  };

  const toggleAutoSync = () => {
    setAutoSync((prev) => !prev);
    if (!autoSync) {
      toast.info("Auto-sync enabled - students will follow your view");
    } else {
      toast.info("Auto-sync disabled");
    }
  };

  useEffect(() => {
    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
    };
  }, []);

  if (!isClient) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span>🗺️</span>
              <span>Teacher Map Control</span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pan and zoom to show students where to look
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={toggleAutoSync}
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">
                Auto-sync
                {autoSync && (
                  <span className="ml-1 text-green-600 dark:text-green-400">
                    (Active)
                  </span>
                )}
              </span>
            </label>

            {!autoSync && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <span>📍</span>
                    <span>Focus Here</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
            
        <div className="mt-3 flex gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-semibold">Latitude:</span>{" "}
            {currentView.lat.toFixed(6)}
          </div>
          <div>
            <span className="font-semibold">Longitude:</span>{" "}
            {currentView.lng.toFixed(6)}
          </div>
          <div>
            <span className="font-semibold">Zoom:</span> {currentView.zoom}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative w-full h-96 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <MapEventHandler onViewChange={handleViewChange} />
        </MapContainer>

        {/* Sync Indicator Overlay */}
        {autoSync && (
          <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 z-[1000]">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold">Auto-syncing</span>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-400">💡</span>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Tip:</strong> Enable auto-sync to automatically update all
            students&apos; map views as you navigate. Or use the &quot;Focus Here&quot;
            button to manually sync your current view.
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact version for smaller spaces
export function CompactTeacherMapControl({
  sessionId,
  connection,
  onGetCurrentView,
  className = "",
}: {
  sessionId: string;
  connection?: signalR.HubConnection | null;
  onGetCurrentView?: () => { lat: number; lng: number; zoom: number } | null;
  className?: string;
}) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleQuickSync = async () => {
    if (!connection) {
      toast.error("SignalR connection not available");
      return;
    }

    setIsSyncing(true);
    try {
      // Get current camera state from map
      let cameraState: { lat: number; lng: number; zoom: number } | null = null;
      
      if (onGetCurrentView) {
        cameraState = onGetCurrentView();
      } else {
        // Try to get camera state via event system
        const viewPromise = new Promise<{ lat: number; lng: number; zoom: number } | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 500);
          
          const handler = (event: Event) => {
            const customEvent = event as CustomEvent<{ lat: number; lng: number; zoom: number }>;
            clearTimeout(timeout);
            window.removeEventListener("currentMapViewResponse", handler);
            resolve(customEvent.detail);
          };
          
          window.addEventListener("currentMapViewResponse", handler);
          
          // Request current map view
          window.dispatchEvent(new CustomEvent("requestCurrentMapView"));
        });
        
        cameraState = await viewPromise;
      }

      if (!cameraState) {
        toast.error("Unable to get current map view. Please ensure map is loaded.");
        return;
      }

      const success = await sendTeacherFocusViaSignalR(
        connection,
        sessionId,
        {
          latitude: cameraState.lat,
          longitude: cameraState.lng,
          zoomLevel: cameraState.zoom,
        }
      );

      if (success) {
        toast.success("Map view synced to all students!");
      } else {
        toast.error("Failed to sync map view");
      }
    } catch (error: any) {
      console.error("Failed to sync map view:", error);
      toast.error(error?.message || "Failed to sync map view");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleQuickSync}
      disabled={isSyncing}
      className={`px-4 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${className}`}
    >
      <span>📍</span>
      <span>{isSyncing ? "Syncing..." : "Focus Students"}</span>
    </button>
  );
}

