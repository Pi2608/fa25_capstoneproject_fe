"use client";

import { useState, useEffect } from "react";
import {
  RouteAnimation,
  CreateRouteAnimationRequest,
  createRouteAnimation,
  updateRouteAnimation,
  deleteRouteAnimation,
  searchRouteBetweenLocations,
  searchRouteWithMultipleLocations,
  getSegmentLocations,
  getMapLocations,
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
  const [waypointLocationIds, setWaypointLocationIds] = useState<string[]>([]); // Points between start and end
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
  
  // New fields for enhanced route animation
  const [showLocationInfoOnArrival, setShowLocationInfoOnArrival] = useState(true);
  const [locationInfoDisplayDurationMs, setLocationInfoDisplayDurationMs] = useState<number | undefined>(undefined);
  const [cameraStateBefore, setCameraStateBefore] = useState<string>("");
  const [cameraStateAfter, setCameraStateAfter] = useState<string>("");

  // Load locations from entire map (to support multi-segment routes)
  useEffect(() => {
    if (isOpen && mapId) {
      setIsLoadingLocations(true);
      getMapLocations(mapId)
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
  }, [isOpen, mapId]);

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
      
      // Load new fields
      if (routeAnimation.toLocationId) {
        setToLocationId(routeAnimation.toLocationId);
      }
      setShowLocationInfoOnArrival(routeAnimation.showLocationInfoOnArrival ?? true);
      setLocationInfoDisplayDurationMs(routeAnimation.locationInfoDisplayDurationMs);
      setCameraStateBefore(routeAnimation.cameraStateBefore || "");
      setCameraStateAfter(routeAnimation.cameraStateAfter || "");
      
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
      setWaypointLocationIds([]);
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
      
      // Reset new fields
      setShowLocationInfoOnArrival(true);
      setLocationInfoDisplayDurationMs(undefined);
      setCameraStateBefore("");
      setCameraStateAfter("");
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

    // Build list of location IDs: [from, ...waypoints, to]
    const allLocationIds = [
      fromLocationId,
      ...waypointLocationIds,
      toLocationId
    ].filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

    if (allLocationIds.length < 2) {
      alert("Cần ít nhất 2 điểm để tạo route");
      return;
    }

    setIsSearchingRoute(true);
    try {
      const result = await searchRouteWithMultipleLocations(allLocationIds, routeType);
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
        alert("Không tìm thấy đường đi giữa các điểm này");
      }
    } catch (error: any) {
      console.error("Failed to search route:", error);
      alert(error?.message || "Lỗi khi tìm đường đi");
    } finally {
      setIsSearchingRoute(false);
    }
  };

  const handleAddWaypoint = () => {
    // This will be triggered by a button to add a waypoint
    // For now, we'll add an empty slot that user can select
    setWaypointLocationIds([...waypointLocationIds, ""]);
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypointLocationIds(waypointLocationIds.filter((_, i) => i !== index));
  };

  const handleWaypointChange = (index: number, locationId: string) => {
    const newWaypoints = [...waypointLocationIds];
    newWaypoints[index] = locationId;
    setWaypointLocationIds(newWaypoints);
  };

  const handleMoveWaypoint = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index > 0) {
      const newWaypoints = [...waypointLocationIds];
      [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
      setWaypointLocationIds(newWaypoints);
    } else if (direction === "down" && index < waypointLocationIds.length - 1) {
      const newWaypoints = [...waypointLocationIds];
      [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
      setWaypointLocationIds(newWaypoints);
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

      // Build waypoints JSON if there are waypoints
      let waypointsJson: string | undefined = undefined;
      const validWaypoints = waypointLocationIds.filter(id => id);
      
      if (validWaypoints.length > 0) {
        const waypoints = validWaypoints.map(locId => {
          const loc = locations.find(l => (l.locationId || l.poiId) === locId);
          const coords = loc ? parseLocationCoords(loc) : null;
          return {
            locationId: locId,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
            name: loc?.title || loc?.subtitle || "Unnamed",
            segmentId: segmentId
          };
        });
        waypointsJson = JSON.stringify(waypoints);
      }

      const data: CreateRouteAnimationRequest = {
        segmentId,
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        fromName: fromLocation?.title || undefined,
        toLat: toCoords.lat,
        toLng: toCoords.lng,
        toName: toLocation?.title || undefined,
        routePath: JSON.stringify(geoJson),
        waypoints: waypointsJson,
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
        toLocationId: toLocationId || undefined,
        showLocationInfoOnArrival,
        locationInfoDisplayDurationMs: locationInfoDisplayDurationMs || undefined,
        cameraStateBefore: cameraStateBefore || undefined,
        cameraStateAfter: cameraStateAfter || undefined,
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
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

          {/* Waypoints Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-zinc-400">Điểm ở giữa (Waypoints)</label>
              <button
                type="button"
                onClick={handleAddWaypoint}
                className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
              >
                + Thêm điểm
              </button>
            </div>
            
            {waypointLocationIds.length === 0 ? (
              <div className="text-xs text-zinc-500 italic py-2">
                Chưa có điểm ở giữa. Click "Thêm điểm" để thêm.
              </div>
            ) : (
              <div className="space-y-2">
                {waypointLocationIds.map((waypointId, index) => (
                  <div key={index} className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2">
                    <div className="flex-shrink-0 text-xs text-zinc-400 w-6 text-center">
                      {index + 1}
                    </div>
                    <select
                      value={waypointId}
                      onChange={(e) => handleWaypointChange(index, e.target.value)}
                      className="flex-1 bg-zinc-700 text-white rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                    >
                      <option value="">-- Chọn location --</option>
                      {locations
                        .filter(loc => {
                          const locId = loc.locationId || loc.poiId;
                          return locId !== fromLocationId && 
                                 locId !== toLocationId && 
                                 !waypointLocationIds.includes(locId) || locId === waypointId;
                        })
                        .map((loc) => (
                          <option key={loc.locationId || loc.poiId} value={loc.locationId || loc.poiId}>
                            {loc.title || loc.subtitle || "Unnamed Location"}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveWaypoint(index, "up")}
                        disabled={index === 0}
                        className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded transition-colors"
                        title="Di chuyển lên"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveWaypoint(index, "down")}
                        disabled={index === waypointLocationIds.length - 1}
                        className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded transition-colors"
                        title="Di chuyển xuống"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWaypoint(index)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                        title="Xóa"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

          {/* Location Info Display Settings */}
          <div className="pt-4 border-t border-zinc-700 space-y-3">
            <h4 className="text-sm font-semibold text-zinc-300">Hiển thị thông tin địa điểm</h4>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLocationInfo"
                checked={showLocationInfoOnArrival}
                onChange={(e) => setShowLocationInfoOnArrival(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="showLocationInfo" className="text-sm text-zinc-300 cursor-pointer">
                Tự động hiển thị popup thông tin khi đến đích
              </label>
            </div>

            {showLocationInfoOnArrival && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Thời gian hiển thị (ms) - Để trống = hiển thị đến khi đóng
                </label>
                <input
                  type="number"
                  value={locationInfoDisplayDurationMs || ""}
                  onChange={(e) => setLocationInfoDisplayDurationMs(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                  placeholder="Ví dụ: 5000"
                  min="0"
                />
              </div>
            )}
          </div>

          {/* Camera State Transitions */}
          <div className="pt-4 border-t border-zinc-700 space-y-3">
            <h4 className="text-sm font-semibold text-zinc-300">Camera Transitions</h4>
            
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Camera State Trước Route (JSON) - Zoom out để bao quát
              </label>
              <textarea
                value={cameraStateBefore}
                onChange={(e) => setCameraStateBefore(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
                rows={2}
                placeholder='{"center": [lng, lat], "zoom": 10}'
              />
              <p className="text-xs text-zinc-500 mt-1">
                Format: JSON với center [lng, lat] và zoom. Để trống = không thay đổi camera trước route.
              </p>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Camera State Sau Route (JSON) - Zoom in vào điểm đến
              </label>
              <textarea
                value={cameraStateAfter}
                onChange={(e) => setCameraStateAfter(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
                rows={2}
                placeholder='{"center": [lng, lat], "zoom": 15}'
              />
              <p className="text-xs text-zinc-500 mt-1">
                Format: JSON với center [lng, lat] và zoom. Để trống = không thay đổi camera sau route.
              </p>
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

