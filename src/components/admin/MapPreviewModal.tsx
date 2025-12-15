"use client";

import { useEffect, useRef, useState } from "react";
import { type MapDetail } from "@/lib/api-maps";
import type { Map as LeafletMap, TileLayer } from "leaflet";

interface MapPreviewModalProps {
  mapDetail: MapDetail;
  onClose: () => void;
  isDark: boolean;
}

export default function MapPreviewModal({ mapDetail, onClose, isDark }: MapPreviewModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [features, setFeatures] = useState<any[]>([]);
  const [layers, setLayers] = useState<any[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let mounted = true;

    (async () => {
      try {
  const L = (await import("leaflet")).default;

        if (!mounted || !mapContainerRef.current) return;

        // Get view state
        const viewState = mapDetail.viewState;
        const center = viewState?.center;
        const rawLat = center && Array.isArray(center) && center.length >= 2 ? Number(center[0]) : 14.058324;
        const rawLng = center && Array.isArray(center) && center.length >= 2 ? Number(center[1]) : 108.277199;
        const rawZoom = viewState?.zoom ? Number(viewState.zoom) : 6;

        const initialCenter: [number, number] = [rawLat, rawLng];
        const initialZoom = Math.min(Math.max(rawZoom, 3), 20);

        // Create map
        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
          dragging: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          tap: false,
          touchZoom: false,
        }).setView(initialCenter, initialZoom);

        mapRef.current = map;

        // Add base layer
        const baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        });
        baseLayer.addTo(map);
        baseLayerRef.current = baseLayer;

        // Load layers and features
        if (mapDetail.layers && mapDetail.layers.length > 0) {
          setLayers(mapDetail.layers);
        }

        setLoadingMap(false);
      } catch (error) {
        console.error("Failed to initialize map:", error);
        setLoadingMap(false);
      }
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapDetail]);

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 p-4">
      <div
        className={`relative rounded-xl shadow-2xl border w-full max-w-6xl max-h-[90vh] flex flex-col ${
          isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200"
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? "border-zinc-700" : "border-gray-200"}`}>
          <div>
            <h2 className="text-xl font-bold">{mapDetail.name || "Untitled Map"}</h2>
            <p className="text-sm opacity-60 mt-1">
              Map ID: {mapDetail.id} | Owner: {mapDetail.ownerName || mapDetail.ownerId}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-600"
            }`}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 grid gap-4">
          {/* Map Description */}
          {mapDetail.description && (
            <div className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
              <h3 className="font-bold mb-2">Mô tả:</h3>
              <p className="text-sm opacity-80">{mapDetail.description}</p>
            </div>
          )}

          {/* Map Preview */}
          <div className="grid gap-2">
            <h3 className="font-bold">Xem trước bản đồ:</h3>
            <div
              ref={mapContainerRef}
              className={`w-full h-[400px] rounded-lg border ${isDark ? "border-zinc-700" : "border-gray-300"}`}
            >
              {loadingMap && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm opacity-60">Đang tải bản đồ...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Layers Info */}
          {layers.length > 0 && (
            <div className="grid gap-2">
              <h3 className="font-bold">Layers ({layers.length}):</h3>
              <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-700" : "border-gray-300"}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={isDark ? "bg-zinc-800" : "bg-gray-100"}>
                      <th className="p-2 text-left font-semibold">Tên Layer</th>
                      <th className="p-2 text-left font-semibold">Loại</th>
                      <th className="p-2 text-center font-semibold">Hiển thị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layers.map((layer, idx) => (
                      <tr key={layer.id || idx} className={isDark ? "border-t border-zinc-800" : "border-t border-gray-200"}>
                        <td className="p-2">{layer.layerName || `Layer ${idx + 1}`}</td>
                        <td className="p-2">{layer.layerType || "Unknown"}</td>
                        <td className="p-2 text-center">
                          {layer.isVisible ? (
                            <span className="text-green-500">✓</span>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Map Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
              <h4 className="font-semibold mb-1 text-xs opacity-60">Trạng thái</h4>
              <p className="font-bold">{mapDetail.status || "Draft"}</p>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
              <h4 className="font-semibold mb-1 text-xs opacity-60">Base Layer</h4>
              <p className="font-bold">{mapDetail.baseLayer || "OSM"}</p>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
              <h4 className="font-semibold mb-1 text-xs opacity-60">Ngày tạo</h4>
              <p className="text-sm">{mapDetail.createdAt ? new Date(mapDetail.createdAt).toLocaleString("vi-VN") : "N/A"}</p>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
              <h4 className="font-semibold mb-1 text-xs opacity-60">Cập nhật cuối</h4>
              <p className="text-sm">{mapDetail.updatedAt ? new Date(mapDetail.updatedAt).toLocaleString("vi-VN") : "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end ${isDark ? "border-zinc-700" : "border-gray-200"}`}>
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isDark
                ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-900"
            }`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
