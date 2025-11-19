"use client";

import { useState, useEffect } from "react";
import {
  RouteAnimation,
  CreateRouteAnimationRequest,
  createRouteAnimation,
  updateRouteAnimation,
  deleteRouteAnimation,
  searchRouteBetweenLocations,
  getSegmentLocations,
  Location,
} from "@/lib/api-storymap";
import { Icon } from "@/components/map-editor-ui/Icon";

// Helper function to parse coordinates from location markerGeometry
function parseLocationCoords(location: Location): { lat: number; lng: number } | null {
  if (!location.markerGeometry) return null;
  
  try {
    const geoJson = typeof location.markerGeometry === "string"
      ? JSON.parse(location.markerGeometry)
      : location.markerGeometry;
    
    if (geoJson.type === "Point" && geoJson.coordinates && geoJson.coordinates.length >= 2) {
      return {
        lng: geoJson.coordinates[0],
        lat: geoJson.coordinates[1],
      };
    }
  } catch (e) {
    console.error("Failed to parse location geometry:", e);
  }
  
  return null;
}

interface RouteAnimationDialogProps {
  mapId: string;
  segmentId: string;
  currentMap?: any;
  routeAnimation?: RouteAnimation | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function RouteAnimationDialog({
  mapId,
  segmentId,
  currentMap,
  routeAnimation,
  isOpen,
  onClose,
  onSave,
}: RouteAnimationDialogProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [fromLocationId, setFromLocationId] = useState<string>("");
  const [toLocationId, setToLocationId] = useState<string>("");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [routeType, setRouteType] = useState<"road" | "straight">("road");
  const [iconType, setIconType] = useState<"car" | "walking" | "bike" | "plane" | "custom">("car");
  const [iconUrl, setIconUrl] = useState("");
  const [routeColor, setRouteColor] = useState("#666666");
  const [visitedColor, setVisitedColor] = useState("#3b82f6");
  const [routeWidth, setRouteWidth] = useState(4);
  const [durationMs, setDurationMs] = useState(5000);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingRoute, setIsSearchingRoute] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Load locations from segment
  useEffect(() => {
    if (isOpen && segmentId) {
      setIsLoadingLocations(true);
      getSegmentLocations(mapId, segmentId)
        .then((locs) => {
          setLocations(locs || []);
        })
        .catch((e) => {
          console.error("Failed to load locations:", e);
          setLocations([]);
        })
        .finally(() => {
          setIsLoadingLocations(false);
        });
    }
  }, [isOpen, segmentId, mapId]);

  useEffect(() => {
    if (routeAnimation) {
      // Try to find location IDs from existing route animation
      // For now, we'll keep the coordinates and names
      setFromCoords({ lat: routeAnimation.fromLat, lng: routeAnimation.fromLng });
      setToCoords({ lat: routeAnimation.toLat, lng: routeAnimation.toLng });
      setIconType(routeAnimation.iconType);
      setIconUrl(routeAnimation.iconUrl || "");
      setRouteColor(routeAnimation.routeColor);
      setVisitedColor(routeAnimation.visitedColor);
      setRouteWidth(routeAnimation.routeWidth);
      setDurationMs(routeAnimation.durationMs);
      
      // Parse route path from GeoJSON
      try {
        const geoJson = JSON.parse(routeAnimation.routePath);
        if (geoJson.type === "LineString" && geoJson.coordinates) {
          setRoutePath(geoJson.coordinates as [number, number][]);
          // Detect route type: if coordinates length is 2, it's likely a straight line
          if (geoJson.coordinates.length === 2) {
            setRouteType("straight");
          } else {
            setRouteType("road");
          }
        }
      } catch (e) {
        console.error("Failed to parse route path:", e);
      }
    } else {
      // Reset form
      setFromLocationId("");
      setToLocationId("");
      setFromCoords(null);
      setToCoords(null);
      setRoutePath([]);
      setRouteType("road");
      setIconType("car");
      setIconUrl("");
      setRouteColor("#666666");
      setVisitedColor("#3b82f6");
      setRouteWidth(4);
      setDurationMs(5000);
    }
  }, [routeAnimation, isOpen]);

  // Update coordinates when location selection changes
  useEffect(() => {
    if (fromLocationId) {
      const location = locations.find(l => (l.locationId || l.poiId) === fromLocationId);
      if (location) {
        const coords = parseLocationCoords(location);
        if (coords) {
          setFromCoords(coords);
        }
      }
    } else {
      setFromCoords(null);
    }
  }, [fromLocationId, locations]);

  useEffect(() => {
    if (toLocationId) {
      const location = locations.find(l => (l.locationId || l.poiId) === toLocationId);
      if (location) {
        const coords = parseLocationCoords(location);
        if (coords) {
          setToCoords(coords);
        }
      }
    } else {
      setToCoords(null);
    }
  }, [toLocationId, locations]);

  const handleSearchRoute = async () => {
    if (!fromLocationId || !toLocationId) {
      alert("Vui lòng chọn điểm xuất phát và điểm đến");
      return;
    }

    if (fromLocationId === toLocationId) {
      alert("Điểm xuất phát và điểm đến phải khác nhau");
      return;
    }

    setIsSearchingRoute(true);
    try {
      const result = await searchRouteBetweenLocations(fromLocationId, toLocationId, routeType);
      if (result?.routePath) {
        try {
          const geoJson = typeof result.routePath === "string"
            ? JSON.parse(result.routePath)
            : result.routePath;
          
          if (geoJson.type === "LineString" && geoJson.coordinates) {
            setRoutePath(geoJson.coordinates as [number, number][]);
          } else {
            throw new Error("Invalid GeoJSON format");
          }
        } catch (e) {
          console.error("Failed to parse route path:", e);
          alert("Lỗi khi parse đường đi");
        }
      } else {
        alert("Không tìm thấy đường đi giữa hai điểm này");
      }
    } catch (error: any) {
      console.error("Failed to search route:", error);
      alert(error?.message || "Lỗi khi tìm đường đi");
    } finally {
      setIsSearchingRoute(false);
    }
  };

  const handleSave = async () => {
    if (!fromCoords || !toCoords || routePath.length === 0) {
      alert("Vui lòng tìm đường đi trước khi lưu");
      return;
    }

    setIsLoading(true);
    try {
      const geoJson = {
        type: "LineString",
        coordinates: routePath,
      };

      const fromLocation = locations.find(l => (l.locationId || l.poiId) === fromLocationId);
      const toLocation = locations.find(l => (l.locationId || l.poiId) === toLocationId);

      const data: CreateRouteAnimationRequest = {
        segmentId,
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        fromName: fromLocation?.title || undefined,
        toLat: toCoords.lat,
        toLng: toCoords.lng,
        toName: toLocation?.title || undefined,
        routePath: JSON.stringify(geoJson),
        iconType,
        iconUrl: iconUrl || undefined,
        iconWidth: 32,
        iconHeight: 32,
        routeColor,
        visitedColor,
        routeWidth,
        durationMs,
        autoPlay: true,
        loop: false,
        isVisible: true,
        zIndex: 1000,
        displayOrder: 0,
      };

      if (routeAnimation) {
        await updateRouteAnimation(mapId, segmentId, routeAnimation.routeAnimationId, data);
      } else {
        await createRouteAnimation(mapId, segmentId, data);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Failed to save route animation:", error);
      alert("Lỗi khi lưu route animation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!routeAnimation) return;
    
    if (!confirm("Bạn có chắc muốn xóa route animation này?")) return;

    try {
      await deleteRouteAnimation(mapId, segmentId, routeAnimation.routeAnimationId);
      onSave();
      onClose();
    } catch (error) {
      console.error("Failed to delete route animation:", error);
      alert("Lỗi khi xóa route animation");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {routeAnimation ? "Chỉnh sửa Route Animation" : "Thêm Route Animation"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* From/To Locations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Điểm xuất phát</label>
              {isLoadingLocations ? (
                <div className="w-full bg-zinc-800 text-zinc-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                  <span>Đang tải...</span>
                </div>
              ) : (
                <select
                  value={fromLocationId}
                  onChange={(e) => setFromLocationId(e.target.value)}
                  className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                >
                  <option value="">-- Chọn location --</option>
                  {locations.map((loc) => (
                    <option key={loc.locationId || loc.poiId} value={loc.locationId || loc.poiId}>
                      {loc.title || loc.subtitle || "Unnamed Location"}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Điểm đến</label>
              {isLoadingLocations ? (
                <div className="w-full bg-zinc-800 text-zinc-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                  <span>Đang tải...</span>
                </div>
              ) : (
                <select
                  value={toLocationId}
                  onChange={(e) => setToLocationId(e.target.value)}
                  className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                >
                  <option value="">-- Chọn location --</option>
                  {locations.map((loc) => (
                    <option key={loc.locationId || loc.poiId} value={loc.locationId || loc.poiId}>
                      {loc.title || loc.subtitle || "Unnamed Location"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Route Type Selection */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Loại đường đi</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRouteType("road");
                  // Suggest icon type for road
                  if (iconType === "plane") {
                    setIconType("car");
                  }
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  routeType === "road"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                🛣️ Đường bộ
              </button>
              <button
                type="button"
                onClick={() => {
                  setRouteType("straight");
                  // Suggest icon type for straight line
                  if (iconType !== "plane" && iconType !== "custom") {
                    setIconType("plane");
                  }
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  routeType === "straight"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                ✈️ Đường thẳng
              </button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              {routeType === "road" 
                ? "Đường đi theo đường bộ thực tế trên bản đồ"
                : "Đường thẳng giữa 2 điểm (phù hợp cho máy bay)"}
            </p>
          </div>

          <button
            onClick={handleSearchRoute}
            disabled={isSearchingRoute || !fromLocationId || !toLocationId || fromLocationId === toLocationId}
            className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
          >
            {isSearchingRoute ? "Đang tìm đường..." : "🔍 Tìm đường đi"}
          </button>

          {routePath.length > 0 && (
            <div className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-400">
              ✓ Đã tìm thấy đường đi với {routePath.length} điểm
            </div>
          )}

          {/* Icon Type */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Loại icon</label>
            <div className="grid grid-cols-5 gap-2">
              {(["car", "walking", "bike", "plane", "custom"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setIconType(type);
                    // Auto-set route type based on icon type
                    if (type === "plane") {
                      setRouteType("straight");
                    } else if (type === "car" || type === "walking" || type === "bike") {
                      setRouteType("road");
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    iconType === type
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {type === "car" && "🚗"}
                  {type === "walking" && "🚶"}
                  {type === "bike" && "🚴"}
                  {type === "plane" && "✈️"}
                  {type === "custom" && "🎨"}
                </button>
              ))}
            </div>
          </div>

          {iconType === "custom" && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">URL Icon tùy chỉnh</label>
              <input
                type="text"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                placeholder="https://..."
              />
            </div>
          )}

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Màu đường chưa đi</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={routeColor}
                  onChange={(e) => setRouteColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={routeColor}
                  onChange={(e) => setRouteColor(e.target.value)}
                  className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Màu đường đã đi</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={visitedColor}
                  onChange={(e) => setVisitedColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={visitedColor}
                  onChange={(e) => setVisitedColor(e.target.value)}
                  className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                />
              </div>
            </div>
          </div>

          {/* Route Width & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Độ rộng đường ({routeWidth}px)
              </label>
              <input
                type="range"
                min="2"
                max="10"
                value={routeWidth}
                onChange={(e) => setRouteWidth(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Thời gian animation ({durationMs / 1000}s)
              </label>
              <input
                type="range"
                min="1000"
                max="30000"
                step="500"
                value={durationMs}
                onChange={(e) => setDurationMs(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-zinc-700">
            {routeAnimation && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                Xóa
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || routePath.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

