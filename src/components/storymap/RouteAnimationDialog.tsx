"use client";

import { useState, useEffect } from "react";
import {
  RouteAnimation,
  CreateRouteAnimationRequest,
  createRouteAnimation,
  updateRouteAnimation,
  deleteRouteAnimation,
  searchRouteWithMultipleLocations,
  getMapLocations,
  Location,
} from "@/lib/api-storymap";
import { Icon } from "@/components/map-editor-ui/Icon";
import { useI18n } from "@/i18n/I18nProvider";

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

type TabType = "route" | "timing" | "style" | "camera";

interface RouteAnimationDialogProps {
  mapId: string;
  segmentId: string;
  segmentDurationMs?: number; // Duration of parent segment for reference
  currentMap?: any;
  routeAnimation?: RouteAnimation | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function RouteAnimationDialog({
  mapId,
  segmentId,
  segmentDurationMs = 6000,
  currentMap,
  routeAnimation,
  isOpen,
  onClose,
  onSave,
}: RouteAnimationDialogProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>("route");
  
  // Route tab
  const [locations, setLocations] = useState<Location[]>([]);
  const [fromLocationId, setFromLocationId] = useState<string>("");
  const [toLocationId, setToLocationId] = useState<string>("");
  const [waypointLocationIds, setWaypointLocationIds] = useState<string[]>([]);
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [routeType, setRouteType] = useState<"road" | "straight">("road");
  
  // Timing tab
  const [durationMs, setDurationMs] = useState(5000);
  const [startTimeMs, setStartTimeMs] = useState<number | undefined>(undefined);
  const [endTimeMs, setEndTimeMs] = useState<number | undefined>(undefined);
  const [showLocationInfoOnArrival, setShowLocationInfoOnArrival] = useState(true);
  const [locationInfoDisplayDurationMs, setLocationInfoDisplayDurationMs] = useState<number | undefined>(undefined);
  
  // Style tab
  const [iconType, setIconType] = useState<"car" | "walking" | "bike" | "plane" | "custom">("car");
  const [iconUrl, setIconUrl] = useState("");
  const [routeColor, setRouteColor] = useState("#666666");
  const [visitedColor, setVisitedColor] = useState("#3b82f6");
  const [routeWidth, setRouteWidth] = useState(4);
  
  // Camera tab
  const [followCamera, setFollowCamera] = useState(true);
  const [followCameraZoom, setFollowCameraZoom] = useState<number | undefined>(undefined);
  const [cameraStateBefore, setCameraStateBefore] = useState<string>("");
  const [cameraStateAfter, setCameraStateAfter] = useState<string>("");
  
  // Camera state UI (parsed from JSON for easier editing)
  const [cameraBeforeEnabled, setCameraBeforeEnabled] = useState(false);
  const [cameraBeforeLat, setCameraBeforeLat] = useState<number | undefined>(undefined);
  const [cameraBeforeLng, setCameraBeforeLng] = useState<number | undefined>(undefined);
  const [cameraBeforeZoom, setCameraBeforeZoom] = useState<number | undefined>(undefined);
  
  const [cameraAfterEnabled, setCameraAfterEnabled] = useState(false);
  const [cameraAfterLat, setCameraAfterLat] = useState<number | undefined>(undefined);
  const [cameraAfterLng, setCameraAfterLng] = useState<number | undefined>(undefined);
  const [cameraAfterZoom, setCameraAfterZoom] = useState<number | undefined>(undefined);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingRoute, setIsSearchingRoute] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Load locations
  useEffect(() => {
    if (isOpen && mapId) {
      setIsLoadingLocations(true);
      getMapLocations(mapId)
        .then((locs) => setLocations(locs || []))
        .catch((e) => {
          console.error("Failed to load locations:", e);
          setLocations([]);
        })
        .finally(() => setIsLoadingLocations(false));
    }
  }, [isOpen, mapId]);

  // Initialize form from existing route animation
  useEffect(() => {
    if (routeAnimation) {
      // Route
      setFromCoords({ lat: routeAnimation.fromLat, lng: routeAnimation.fromLng });
      setToCoords({ lat: routeAnimation.toLat, lng: routeAnimation.toLng });
      if (routeAnimation.toLocationId) setToLocationId(routeAnimation.toLocationId);
      
      // Timing
      setDurationMs(routeAnimation.durationMs);
      setStartTimeMs(routeAnimation.startTimeMs ?? undefined);
      setEndTimeMs(routeAnimation.endTimeMs ?? undefined);
      setShowLocationInfoOnArrival(routeAnimation.showLocationInfoOnArrival ?? true);
      setLocationInfoDisplayDurationMs(routeAnimation.locationInfoDisplayDurationMs);
      
      // Style
      setIconType(routeAnimation.iconType);
      setIconUrl(routeAnimation.iconUrl || "");
      setRouteColor(routeAnimation.routeColor);
      setVisitedColor(routeAnimation.visitedColor);
      setRouteWidth(routeAnimation.routeWidth);
      
      // Camera
      setFollowCamera(routeAnimation.followCamera ?? true);
      setFollowCameraZoom(routeAnimation.followCameraZoom ?? undefined);
      setCameraStateBefore(routeAnimation.cameraStateBefore || "");
      setCameraStateAfter(routeAnimation.cameraStateAfter || "");
      
      // Parse camera states for UI
      if (routeAnimation.cameraStateBefore) {
        try {
          const parsed = JSON.parse(routeAnimation.cameraStateBefore);
          setCameraBeforeEnabled(true);
          if (parsed.center) {
            setCameraBeforeLng(parsed.center[0]);
            setCameraBeforeLat(parsed.center[1]);
          }
          setCameraBeforeZoom(parsed.zoom);
        } catch {
          setCameraBeforeEnabled(false);
        }
      } else {
        setCameraBeforeEnabled(false);
      }
      
      if (routeAnimation.cameraStateAfter) {
        try {
          const parsed = JSON.parse(routeAnimation.cameraStateAfter);
          setCameraAfterEnabled(true);
          if (parsed.center) {
            setCameraAfterLng(parsed.center[0]);
            setCameraAfterLat(parsed.center[1]);
          }
          setCameraAfterZoom(parsed.zoom);
        } catch {
          setCameraAfterEnabled(false);
        }
      } else {
        setCameraAfterEnabled(false);
      }
      
      // Parse route path
      try {
        const geoJson = JSON.parse(routeAnimation.routePath);
        if (geoJson.type === "LineString" && geoJson.coordinates) {
          setRoutePath(geoJson.coordinates as [number, number][]);
          setRouteType(geoJson.coordinates.length === 2 ? "straight" : "road");
        }
      } catch (e) {
        console.error("Failed to parse route path:", e);
      }
    } else {
      // Reset form
      resetForm();
    }
  }, [routeAnimation, isOpen]);

  const resetForm = () => {
    setActiveTab("route");
    setFromLocationId("");
    setToLocationId("");
    setWaypointLocationIds([]);
    setFromCoords(null);
    setToCoords(null);
    setRoutePath([]);
    setRouteType("road");
    setDurationMs(5000);
    setStartTimeMs(undefined);
    setEndTimeMs(undefined);
    setShowLocationInfoOnArrival(true);
    setLocationInfoDisplayDurationMs(undefined);
    setIconType("car");
    setIconUrl("");
    setRouteColor("#666666");
    setVisitedColor("#3b82f6");
    setRouteWidth(4);
    setFollowCamera(true);
    setFollowCameraZoom(undefined);
    setCameraStateBefore("");
    setCameraStateAfter("");
    setCameraBeforeEnabled(false);
    setCameraBeforeLat(undefined);
    setCameraBeforeLng(undefined);
    setCameraBeforeZoom(undefined);
    setCameraAfterEnabled(false);
    setCameraAfterLat(undefined);
    setCameraAfterLng(undefined);
    setCameraAfterZoom(undefined);
  };
  
  // Build camera state JSON from UI fields
  const buildCameraStateJson = (enabled: boolean, lat?: number, lng?: number, zoom?: number): string => {
    if (!enabled || (lat === undefined && lng === undefined && zoom === undefined)) {
      return "";
    }
    const state: { center?: [number, number]; zoom?: number } = {};
    if (lat !== undefined && lng !== undefined) {
      state.center = [lng, lat];
    }
    if (zoom !== undefined) {
      state.zoom = zoom;
    }
    return JSON.stringify(state);
  };
  
  // Get current map camera state
  const captureCurrentCameraState = (target: "before" | "after") => {
    if (!currentMap) {
      alert("Không thể lấy thông tin camera. Map chưa sẵn sàng.");
      return;
    }
    
    try {
      const center = currentMap.getCenter();
      const zoom = currentMap.getZoom();
      
      if (target === "before") {
        setCameraBeforeEnabled(true);
        setCameraBeforeLat(center.lat);
        setCameraBeforeLng(center.lng);
        setCameraBeforeZoom(Math.round(zoom));
      } else {
        setCameraAfterEnabled(true);
        setCameraAfterLat(center.lat);
        setCameraAfterLng(center.lng);
        setCameraAfterZoom(Math.round(zoom));
      }
    } catch (e) {
      console.error("Failed to capture camera state:", e);
      alert("Lỗi khi lấy thông tin camera");
    }
  };
  
  // Focus camera on a location
  const focusCameraOnLocation = (target: "before" | "after", locationType: "from" | "to") => {
    const coords = locationType === "from" ? fromCoords : toCoords;
    if (!coords) {
      alert(`Vui lòng chọn điểm ${locationType === "from" ? "xuất phát" : "đến"} trước`);
      return;
    }
    
    if (target === "before") {
      setCameraBeforeEnabled(true);
      setCameraBeforeLat(coords.lat);
      setCameraBeforeLng(coords.lng);
      if (!cameraBeforeZoom) setCameraBeforeZoom(12);
    } else {
      setCameraAfterEnabled(true);
      setCameraAfterLat(coords.lat);
      setCameraAfterLng(coords.lng);
      if (!cameraAfterZoom) setCameraAfterZoom(15);
    }
  };

  // Update coordinates when location selection changes
  useEffect(() => {
    if (fromLocationId) {
      const location = locations.find(l => l.locationId === fromLocationId);
      if (location) {
        const coords = parseLocationCoords(location);
        if (coords) setFromCoords(coords);
      }
    } else {
      setFromCoords(null);
    }
  }, [fromLocationId, locations]);

  useEffect(() => {
    if (toLocationId) {
      const location = locations.find(l => l.locationId === toLocationId);
      if (location) {
        const coords = parseLocationCoords(location);
        if (coords) setToCoords(coords);
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

    const allLocationIds = [fromLocationId, ...waypointLocationIds, toLocationId]
      .filter((id, index, arr) => arr.indexOf(id) === index);

    if (allLocationIds.length < 2) {
      alert("Cần ít nhất 2 điểm để tạo route");
      return;
    }

    setIsSearchingRoute(true);
    try {
      const result = await searchRouteWithMultipleLocations(allLocationIds, routeType);
      if (result?.routePath) {
        const geoJson = typeof result.routePath === "string"
          ? JSON.parse(result.routePath)
          : result.routePath;
        
        if (geoJson.type === "LineString" && geoJson.coordinates) {
          setRoutePath(geoJson.coordinates as [number, number][]);
        } else {
          throw new Error("Invalid GeoJSON format");
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

  const handleSave = async () => {
    if (!fromCoords || !toCoords || routePath.length === 0) {
      alert("Vui lòng tìm đường đi trước khi lưu");
      return;
    }

    setIsLoading(true);
    try {
      const geoJson = { type: "LineString", coordinates: routePath };
      const fromLocation = locations.find(l => l.locationId === fromLocationId);
      const toLocation = locations.find(l => l.locationId === toLocationId);

      // Build waypoints JSON
      let waypointsJson: string | undefined = undefined;
      const validWaypoints = waypointLocationIds.filter(id => id);
      if (validWaypoints.length > 0) {
        const waypoints = validWaypoints.map(locId => {
          const loc = locations.find(l => l.locationId === locId);
          const coords = loc ? parseLocationCoords(loc) : null;
          return {
            locationId: locId,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
            name: loc?.title || "Unnamed",
            segmentId,
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
        startTimeMs,
        endTimeMs,
        autoPlay: true,
        loop: false,
        isVisible: true,
        zIndex: 1000,
        displayOrder: 0,
        toLocationId: toLocationId || undefined,
        showLocationInfoOnArrival,
        locationInfoDisplayDurationMs: locationInfoDisplayDurationMs || undefined,
        cameraStateBefore: buildCameraStateJson(cameraBeforeEnabled, cameraBeforeLat, cameraBeforeLng, cameraBeforeZoom) || undefined,
        cameraStateAfter: buildCameraStateJson(cameraAfterEnabled, cameraAfterLat, cameraAfterLng, cameraAfterZoom) || undefined,
        followCamera,
        followCameraZoom,
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
    if (!routeAnimation || !confirm("Bạn có chắc muốn xóa route animation này?")) return;

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

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "route", label: "Đường đi", icon: "🗺️" },
    { id: "timing", label: "Thời gian", icon: "⏱️" },
    { id: "style", label: "Giao diện", icon: "🎨" },
    { id: "camera", label: "Camera", icon: "📹" },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between bg-zinc-800/50">
          <h3 className="text-base font-semibold text-white">
            {routeAnimation ? "Chỉnh sửa Route" : "Thêm Route Animation"}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700 bg-zinc-800/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-emerald-400 border-b-2 border-emerald-400 bg-zinc-800/50"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Route Tab */}
          {activeTab === "route" && (
            <>
              {/* From/To */}
              <div className="grid grid-cols-2 gap-3">
                <LocationSelect
                  label="Điểm xuất phát"
                  value={fromLocationId}
                  onChange={setFromLocationId}
                  locations={locations}
                  isLoading={isLoadingLocations}
                  excludeIds={[toLocationId]}
                />
                <LocationSelect
                  label="Điểm đến"
                  value={toLocationId}
                  onChange={setToLocationId}
                  locations={locations}
                  isLoading={isLoadingLocations}
                  excludeIds={[fromLocationId]}
                />
              </div>

              {/* Waypoints */}
              <WaypointsSection
                waypoints={waypointLocationIds}
                locations={locations}
                excludeIds={[fromLocationId, toLocationId]}
                onAdd={() => setWaypointLocationIds([...waypointLocationIds, ""])}
                onChange={(index, value) => {
                  const newWaypoints = [...waypointLocationIds];
                  newWaypoints[index] = value;
                  setWaypointLocationIds(newWaypoints);
                }}
                onRemove={(index) => setWaypointLocationIds(waypointLocationIds.filter((_, i) => i !== index))}
                onMove={(index, dir) => {
                  const newWaypoints = [...waypointLocationIds];
                  const targetIndex = dir === "up" ? index - 1 : index + 1;
                  [newWaypoints[index], newWaypoints[targetIndex]] = [newWaypoints[targetIndex], newWaypoints[index]];
                  setWaypointLocationIds(newWaypoints);
                }}
              />

              {/* Route Type */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRouteType("road");
                    if (iconType === "plane") setIconType("car");
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    routeType === "road" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  🛣️ Đường bộ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRouteType("straight");
                    if (iconType !== "plane" && iconType !== "custom") setIconType("plane");
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    routeType === "straight" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  ✈️ Đường thẳng
                </button>
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearchRoute}
                disabled={isSearchingRoute || !fromLocationId || !toLocationId || fromLocationId === toLocationId}
                className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
              >
                {isSearchingRoute ? "Đang tìm..." : "🔍 Tìm đường đi"}
              </button>

              {routePath.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 text-xs text-emerald-300 flex items-center gap-2">
                  <Icon icon="mdi:check-circle" className="w-4 h-4" />
                  Đã tìm thấy đường đi với {routePath.length} điểm
                </div>
              )}
            </>
          )}

          {/* Timing Tab */}
          {activeTab === "timing" && (
            <>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 mb-2">
                <strong>Segment duration:</strong> {segmentDurationMs / 1000}s ({segmentDurationMs}ms)
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Thời gian animation: <strong className="text-white">{durationMs / 1000}s</strong>
                </label>
                <input
                  type="range"
                  min="1000"
                  max="30000"
                  step="500"
                  value={durationMs}
                  onChange={(e) => setDurationMs(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Start/End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Bắt đầu tại (ms)</label>
                  <input
                    type="number"
                    value={startTimeMs ?? ""}
                    onChange={(e) => setStartTimeMs(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Kết thúc tại (ms)</label>
                  <input
                    type="number"
                    value={endTimeMs ?? ""}
                    onChange={(e) => setEndTimeMs(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                    placeholder={`${(startTimeMs ?? 0) + durationMs}`}
                    min="0"
                  />
                </div>
              </div>

              <p className="text-[10px] text-zinc-500">
                💡 <strong>startTimeMs</strong>: Route bắt đầu chạy tại thời điểm này trong segment.
                <br />
                💡 <strong>endTimeMs</strong>: Thời điểm trigger popup/camera sau route. Để trống = startTimeMs + durationMs.
              </p>

              {/* Show Location Info */}
              <div className="pt-3 border-t border-zinc-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLocationInfoOnArrival}
                    onChange={(e) => setShowLocationInfoOnArrival(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-zinc-300">Hiển thị popup khi đến đích</span>
                </label>

                {showLocationInfoOnArrival && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Thời gian hiển thị popup (ms)</label>
                    <input
                      type="number"
                      value={locationInfoDisplayDurationMs ?? ""}
                      onChange={(e) => setLocationInfoDisplayDurationMs(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                      placeholder="Để trống = đến khi đóng"
                      min="0"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Style Tab */}
          {activeTab === "style" && (
            <>
              {/* Icon Type */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Icon di chuyển</label>
                <div className="grid grid-cols-5 gap-2">
                  {(["car", "walking", "bike", "plane", "custom"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setIconType(type);
                        if (type === "plane") setRouteType("straight");
                        else if (["car", "walking", "bike"].includes(type)) setRouteType("road");
                      }}
                      className={`px-2 py-2 rounded-lg text-lg transition-colors ${
                        iconType === type ? "bg-emerald-600 ring-2 ring-emerald-400" : "bg-zinc-800 hover:bg-zinc-700"
                      }`}
                      title={type}
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
                  <label className="block text-xs text-zinc-400 mb-1">URL Icon</label>
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
              <div className="grid grid-cols-2 gap-3">
                <ColorInput label="Màu đường chưa đi" value={routeColor} onChange={setRouteColor} />
                <ColorInput label="Màu đường đã đi" value={visitedColor} onChange={setVisitedColor} />
              </div>

              {/* Route Width */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Độ rộng đường: <strong className="text-white">{routeWidth}px</strong>
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={routeWidth}
                  onChange={(e) => setRouteWidth(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </>
          )}

          {/* Camera Tab */}
          {activeTab === "camera" && (
            <>
              {/* Follow Camera */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followCamera}
                    onChange={(e) => setFollowCamera(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-zinc-300">Camera theo icon khi di chuyển</span>
                </label>

                {followCamera && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Zoom level khi follow</label>
                    <input
                      type="number"
                      value={followCameraZoom ?? ""}
                      onChange={(e) => setFollowCameraZoom(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                      placeholder="Để trống = giữ nguyên zoom"
                      min="1"
                      max="20"
                    />
                  </div>
                )}
              </div>

              {/* Camera Before Route */}
              <CameraStateInput
                title="📍 Camera trước route"
                description="Zoom out để thấy toàn cảnh trước khi icon bắt đầu di chuyển"
                enabled={cameraBeforeEnabled}
                onEnabledChange={setCameraBeforeEnabled}
                lat={cameraBeforeLat}
                lng={cameraBeforeLng}
                zoom={cameraBeforeZoom}
                onLatChange={setCameraBeforeLat}
                onLngChange={setCameraBeforeLng}
                onZoomChange={setCameraBeforeZoom}
                onCaptureFromMap={() => captureCurrentCameraState("before")}
                onFocusFromLocation={() => focusCameraOnLocation("before", "from")}
                onFocusToLocation={() => focusCameraOnLocation("before", "to")}
                hasMap={!!currentMap}
                hasFromCoords={!!fromCoords}
                hasToCoords={!!toCoords}
              />

              {/* Camera After Route */}
              <CameraStateInput
                title="🎯 Camera sau route"
                description="Zoom in vào điểm đến sau khi icon đến nơi"
                enabled={cameraAfterEnabled}
                onEnabledChange={setCameraAfterEnabled}
                lat={cameraAfterLat}
                lng={cameraAfterLng}
                zoom={cameraAfterZoom}
                onLatChange={setCameraAfterLat}
                onLngChange={setCameraAfterLng}
                onZoomChange={setCameraAfterZoom}
                onCaptureFromMap={() => captureCurrentCameraState("after")}
                onFocusFromLocation={() => focusCameraOnLocation("after", "from")}
                onFocusToLocation={() => focusCameraOnLocation("after", "to")}
                hasMap={!!currentMap}
                hasFromCoords={!!fromCoords}
                hasToCoords={!!toCoords}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-700 flex gap-2 bg-zinc-800/30">
          {routeAnimation && (
            <button
              onClick={handleDelete}
              className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
            >
              Xóa
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || routePath.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isLoading ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Sub Components ====================

function LocationSelect({
  label,
  value,
  onChange,
  locations,
  isLoading,
  excludeIds = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locations: Location[];
  isLoading: boolean;
  excludeIds?: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      {isLoading ? (
        <div className="w-full bg-zinc-800 text-zinc-500 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
          <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
          <span>Đang tải...</span>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
        >
          <option value="">-- Chọn --</option>
          {locations
            .filter((loc) => !excludeIds.includes(loc.locationId))
            .map((loc) => (
              <option key={loc.locationId} value={loc.locationId}>
                {loc.title || loc.subtitle || "Unnamed"}
              </option>
            ))}
        </select>
      )}
    </div>
  );
}

function WaypointsSection({
  waypoints,
  locations,
  excludeIds,
  onAdd,
  onChange,
  onRemove,
  onMove,
}: {
  waypoints: string[];
  locations: Location[];
  excludeIds: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-zinc-400">Điểm ở giữa</label>
        <button
          type="button"
          onClick={onAdd}
          className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
        >
          + Thêm
        </button>
      </div>

      {waypoints.length === 0 ? (
        <div className="text-xs text-zinc-500 italic py-1">Chưa có điểm ở giữa</div>
      ) : (
        <div className="space-y-1.5">
          {waypoints.map((waypointId, index) => (
            <div key={index} className="flex items-center gap-1.5 bg-zinc-800 rounded-lg p-1.5">
              <span className="text-[10px] text-zinc-500 w-4 text-center">{index + 1}</span>
              <select
                value={waypointId}
                onChange={(e) => onChange(index, e.target.value)}
                className="flex-1 bg-zinc-700 text-white rounded px-2 py-1 text-xs outline-none"
              >
                <option value="">-- Chọn --</option>
                {locations
                  .filter((loc) => !excludeIds.includes(loc.locationId) && !waypoints.includes(loc.locationId) || loc.locationId === waypointId)
                  .map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.title || "Unnamed"}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => onMove(index, "up")}
                disabled={index === 0}
                className="p-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-white rounded"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(index, "down")}
                disabled={index === waypoints.length - 1}
                className="p-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-white rounded"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-1 text-xs bg-red-600/50 hover:bg-red-600 text-white rounded"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 rounded cursor-pointer border-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 font-mono"
        />
      </div>
    </div>
  );
}

function CameraStateInput({
  title,
  description,
  enabled,
  onEnabledChange,
  lat,
  lng,
  zoom,
  onLatChange,
  onLngChange,
  onZoomChange,
  onCaptureFromMap,
  onFocusFromLocation,
  onFocusToLocation,
  hasMap,
  hasFromCoords,
  hasToCoords,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  lat?: number;
  lng?: number;
  zoom?: number;
  onLatChange: (lat?: number) => void;
  onLngChange: (lng?: number) => void;
  onZoomChange: (zoom?: number) => void;
  onCaptureFromMap: () => void;
  onFocusFromLocation: () => void;
  onFocusToLocation: () => void;
  hasMap: boolean;
  hasFromCoords: boolean;
  hasToCoords: boolean;
}) {
  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
          enabled ? "bg-emerald-600/20" : "bg-zinc-800/50 hover:bg-zinc-800"
        }`}
        onClick={() => onEnabledChange(!enabled)}
      >
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              e.stopPropagation();
              onEnabledChange(e.target.checked);
            }}
            className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-white">{title}</span>
        </div>
        <Icon 
          icon={enabled ? "mdi:chevron-up" : "mdi:chevron-down"} 
          className="w-4 h-4 text-zinc-400" 
        />
      </div>
      
      {/* Content */}
      {enabled && (
        <div className="p-3 space-y-3 bg-zinc-800/30">
          <p className="text-[10px] text-zinc-500">{description}</p>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onCaptureFromMap}
              disabled={!hasMap}
              className="px-2 py-1 text-[10px] bg-sky-600 hover:bg-sky-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors flex items-center gap-1"
              title="Lấy vị trí camera hiện tại từ map"
            >
              <Icon icon="mdi:crosshairs-gps" className="w-3 h-3" />
              Lấy từ map
            </button>
            <button
              type="button"
              onClick={onFocusFromLocation}
              disabled={!hasFromCoords}
              className="px-2 py-1 text-[10px] bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors flex items-center gap-1"
              title="Focus vào điểm xuất phát"
            >
              <Icon icon="mdi:map-marker" className="w-3 h-3" />
              Điểm xuất phát
            </button>
            <button
              type="button"
              onClick={onFocusToLocation}
              disabled={!hasToCoords}
              className="px-2 py-1 text-[10px] bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors flex items-center gap-1"
              title="Focus vào điểm đến"
            >
              <Icon icon="mdi:flag-checkered" className="w-3 h-3" />
              Điểm đến
            </button>
          </div>
          
          {/* Coordinate Inputs */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">Latitude</label>
              <input
                type="number"
                value={lat ?? ""}
                onChange={(e) => onLatChange(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500/80"
                placeholder="10.7769"
                step="0.0001"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">Longitude</label>
              <input
                type="number"
                value={lng ?? ""}
                onChange={(e) => onLngChange(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500/80"
                placeholder="106.7009"
                step="0.0001"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">Zoom</label>
              <input
                type="number"
                value={zoom ?? ""}
                onChange={(e) => onZoomChange(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500/80"
                placeholder="12"
                min="1"
                max="20"
              />
            </div>
          </div>
          
          {/* Preview */}
          {(lat !== undefined || lng !== undefined || zoom !== undefined) && (
            <div className="text-[10px] text-zinc-400 bg-zinc-900 rounded px-2 py-1 font-mono">
              {lat !== undefined && lng !== undefined && (
                <span>📍 {lat.toFixed(4)}, {lng.toFixed(4)}</span>
              )}
              {zoom !== undefined && (
                <span className="ml-2">🔍 Zoom {zoom}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
