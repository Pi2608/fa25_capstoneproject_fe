"use client";

import { useState, useEffect, useRef } from "react";
import {
  CreateRouteAnimationRequest,
  getMapLocations,
  Location,
  searchRouteWithMultipleLocations,
  RouteAnimation,
} from "@/lib/api-storymap";
import { Icon } from "@/components/map-editor-ui/Icon";

interface RouteAnimationFormProps {
  mapId: string;
  segmentId: string;
  initialRoute?: RouteAnimation;
  onSave: (data: CreateRouteAnimationRequest) => Promise<void>;
  onCancel: () => void;
}

type TabType = "route" | "timing" | "style";

export function RouteAnimationForm({
  mapId,
  segmentId,
  initialRoute,
  onSave,
  onCancel,
}: RouteAnimationFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>("route");
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Route tab
  const [fromLocationId, setFromLocationId] = useState<string>("");
  const [toLocationId, setToLocationId] = useState<string>("");
  const [iconType, setIconType] = useState<"car" | "walking" | "bike" | "plane" | "custom">("car");
  const [routePath, setRoutePath] = useState<string | null>(null); // GeoJSON LineString
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [useStraightLine, setUseStraightLine] = useState(true);
  const [routeDistance, setRouteDistance] = useState<number | null>(null); // meters

  // Icon upload state
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconUrl, setIconUrl] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Timing tab
  const [durationMs, setDurationMs] = useState(5000);
  const [startTimeMs, setStartTimeMs] = useState<number>(0);

  // Style tab
  const [lineColor, setLineColor] = useState("#FF0000");
  const [lineWidth, setLineWidth] = useState(3);
  const [showMarkers, setShowMarkers] = useState(true);

  useEffect(() => {
    loadLocations();
  }, [mapId]);

  // Load initial route data when editing
  useEffect(() => {
    if (initialRoute) {
      // Load route data - need to find location IDs from coordinates
      // Since RouteAnimation has fromLat/fromLng and toLat/toLng, we need to match with locations
      const fromLocation = locations.find(loc => {
        if (loc.markerGeometry) {
          try {
            const geo = JSON.parse(loc.markerGeometry);
            if (geo.type === "Point" && geo.coordinates) {
              const [lng, lat] = geo.coordinates;
              // Check if coordinates match (with small tolerance)
              return Math.abs(lat - initialRoute.fromLat) < 0.0001 && 
                     Math.abs(lng - initialRoute.fromLng) < 0.0001;
            }
          } catch (e) {}
        }
        return false;
      });
      
      const toLocation = locations.find(loc => {
        if (loc.markerGeometry) {
          try {
            const geo = JSON.parse(loc.markerGeometry);
            if (geo.type === "Point" && geo.coordinates) {
              const [lng, lat] = geo.coordinates;
              // Check if coordinates match (with small tolerance)
              return Math.abs(lat - initialRoute.toLat) < 0.0001 && 
                     Math.abs(lng - initialRoute.toLng) < 0.0001;
            }
          } catch (e) {}
        }
        return false;
      });
      
      setFromLocationId(fromLocation?.locationId || initialRoute.toLocationId || "");
      setToLocationId(toLocation?.locationId || initialRoute.toLocationId || "");
      setIconType(initialRoute.iconType || "car");
      setIconUrl(initialRoute.iconUrl || "");
      setDurationMs(initialRoute.durationMs || 5000);
      setStartTimeMs(initialRoute.startTimeMs ?? 0);
      setLineColor(initialRoute.routeColor || "#FF0000");
      setLineWidth(initialRoute.routeWidth || 3);
      
      // Load route path if exists
      if (initialRoute.routePath) {
        try {
          const routePathStr = typeof initialRoute.routePath === "string" 
            ? initialRoute.routePath 
            : JSON.stringify(initialRoute.routePath);
          setRoutePath(routePathStr);
          
          // Parse to check if it's a straight line or calculated route
          const geoJson = JSON.parse(routePathStr);
          if (geoJson.type === "LineString" && geoJson.coordinates) {
            // If route has more than 2 points, it's a calculated route
            setUseStraightLine(geoJson.coordinates.length <= 2);
            
            // Calculate distance
            if (geoJson.coordinates.length >= 2) {
              const calculateDistance = (coords: number[][]) => {
                let totalDistance = 0;
                for (let i = 1; i < coords.length; i++) {
                  const [lng1, lat1] = coords[i - 1];
                  const [lng2, lat2] = coords[i];
                  const R = 6371000; // Earth radius in meters
                  const dLat = ((lat2 - lat1) * Math.PI) / 180;
                  const dLng = ((lng2 - lng1) * Math.PI) / 180;
                  const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos((lat1 * Math.PI) / 180) *
                      Math.cos((lat2 * Math.PI) / 180) *
                      Math.sin(dLng / 2) *
                      Math.sin(dLng / 2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  totalDistance += R * c;
                }
                return totalDistance;
              };
              setRouteDistance(calculateDistance(geoJson.coordinates));
            }
          }
        } catch (e) {
          console.error("Failed to parse route path:", e);
        }
      }
    } else {
      // Reset form when creating new route
      setFromLocationId("");
      setToLocationId("");
      setIconType("car");
      setDurationMs(5000);
      setStartTimeMs(0);
      setLineColor("#FF0000");
      setLineWidth(3);
      setRoutePath(null);
      setRouteDistance(null);
      setUseStraightLine(true);
    }
  }, [initialRoute, locations]); // Add locations dependency to match after locations are loaded

  // Reset route when locations change (only if not editing)
  useEffect(() => {
    if (!initialRoute) {
      setRoutePath(null);
      setRouteDistance(null);
      setUseStraightLine(true);
    }
  }, [fromLocationId, toLocationId, initialRoute]);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await getMapLocations(mapId);
      setLocations(data || []);
    } catch (error) {
      console.error("Failed to load locations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle icon file upload
  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      setIconUrl(""); // Clear URL when file is selected
      const reader = new FileReader();
      reader.onload = (e) => setIconPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFindRoute = async () => {
    if (!fromLocationId || !toLocationId) {
      alert("Vui lòng chọn cả điểm đi và điểm đến");
      return;
    }

    // For plane, only use straight line
    if (iconType === "plane") {
      alert("Máy bay chỉ hỗ trợ đường thẳng");
      return;
    }

    const allLocationIds = [fromLocationId, toLocationId].filter(id => id);

    if (allLocationIds.length < 2) {
      alert("Cần ít nhất 2 điểm để tạo route");
      return;
    }

    setIsCalculatingRoute(true);
    try {
      // Use backend API to search route
      const result = await searchRouteWithMultipleLocations(allLocationIds, "road");
      
      if (result?.routePath) {
        // Parse routePath from string to verify it's valid
        const routePathStr = typeof result.routePath === "string" 
          ? result.routePath 
          : JSON.stringify(result.routePath);
        
        try {
          const geoJson = JSON.parse(routePathStr);
          if (geoJson.type === "LineString" && geoJson.coordinates && Array.isArray(geoJson.coordinates)) {
            setRoutePath(routePathStr);
            setUseStraightLine(false);
            
            // Calculate approximate distance from route coordinates
            if (geoJson.coordinates.length >= 2) {
              // Simple distance calculation for display
              const calculateDistance = (coords: number[][]) => {
                let totalDistance = 0;
                for (let i = 1; i < coords.length; i++) {
                  const [lng1, lat1] = coords[i - 1];
                  const [lng2, lat2] = coords[i];
                  const R = 6371000; // Earth radius in meters
                  const dLat = ((lat2 - lat1) * Math.PI) / 180;
                  const dLng = ((lng2 - lng1) * Math.PI) / 180;
                  const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos((lat1 * Math.PI) / 180) *
                      Math.cos((lat2 * Math.PI) / 180) *
                      Math.sin(dLng / 2) *
                      Math.sin(dLng / 2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  totalDistance += R * c;
                }
                return totalDistance;
              };
              
              setRouteDistance(calculateDistance(geoJson.coordinates));
            }
          } else {
            throw new Error("Invalid GeoJSON format");
          }
        } catch (parseError) {
          console.error("Failed to parse route path:", parseError);
          alert("Đường đi không hợp lệ. Vui lòng thử lại.");
          setUseStraightLine(true);
          setRoutePath(null);
          setRouteDistance(null);
        }
      } else {
        alert("Không tìm thấy đường đi giữa các điểm này. Sử dụng đường thẳng thay thế.");
        setUseStraightLine(true);
        setRoutePath(null);
        setRouteDistance(null);
      }
    } catch (error: any) {
      console.error("Failed to search route:", error);
      alert(error?.message || "Lỗi khi tìm đường đi. Vui lòng thử lại hoặc sử dụng đường thẳng.");
      setUseStraightLine(true);
      setRoutePath(null);
      setRouteDistance(null);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleUseStraightLine = () => {
    setUseStraightLine(true);
    setRoutePath(null);
    setRouteDistance(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromLocationId || !toLocationId) {
      alert("Vui lòng chọn cả điểm đi và điểm đến");
      return;
    }

    const fromLocation = locations.find(loc => loc.locationId === fromLocationId);
    const toLocation = locations.find(loc => loc.locationId === toLocationId);
    
    if (!fromLocation || !toLocation) {
      alert("Không tìm thấy location. Vui lòng thử lại.");
      return;
    }

    // Parse markerGeometry to get coordinates
    let fromLat = 0;
    let fromLng = 0;
    let toLat = 0;
    let toLng = 0;

    try {
      if (fromLocation.markerGeometry) {
        const fromGeo = JSON.parse(fromLocation.markerGeometry);
        if (fromGeo.type === "Point" && Array.isArray(fromGeo.coordinates) && fromGeo.coordinates.length >= 2) {
          fromLng = fromGeo.coordinates[0];
          fromLat = fromGeo.coordinates[1];
        }
      }
      if (toLocation.markerGeometry) {
        const toGeo = JSON.parse(toLocation.markerGeometry);
        if (toGeo.type === "Point" && Array.isArray(toGeo.coordinates) && toGeo.coordinates.length >= 2) {
          toLng = toGeo.coordinates[0];
          toLat = toGeo.coordinates[1];
        }
      }
    } catch (error) {
      console.error("Failed to parse location coordinates:", error);
      alert("Không thể đọc tọa độ của location. Vui lòng kiểm tra lại.");
      return;
    }

    // Use calculated route or create straight line
    let finalRoutePath: string;
    if (!useStraightLine && routePath) {
      finalRoutePath = routePath;
    } else {
      // Create straight line route (simple LineString)
      finalRoutePath = JSON.stringify({
        type: "LineString",
        coordinates: [[fromLng, fromLat], [toLng, toLat]]
      });
    }

    setSaving(true);
    try {
      const data: CreateRouteAnimationRequest = {
        segmentId,
        fromLat,
        fromLng,
        fromName: fromLocation.title,
        toLat,
        toLng,
        toName: toLocation.title,
        toLocationId: toLocationId,
        routePath: finalRoutePath,
        iconType,
        iconFile: iconFile || undefined,
        iconUrl: iconUrl.trim() || undefined,
        routeColor: lineColor,
        routeWidth: lineWidth,
        durationMs,
        startTimeMs,
        autoPlay: true,
        followCamera: false,
        isVisible: true,
      };
      console.log("Submitting route animation data:", data);
      await onSave(data);
      console.log("Route animation saved successfully");
    } catch (error) {
      console.error("Error saving route animation:", error);
      // Error is already handled in onSave callback
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "route", label: "Route", icon: "🛣️" },
    { id: "timing", label: "Timing", icon: "⏱️" },
    { id: "style", label: "Style", icon: "🎨" },
  ];

  return (
    <div className="p-3 space-y-3 border-b border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {initialRoute ? "Chỉnh sửa Route Animation" : "Thêm Route Animation"}
        </h4>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          disabled={saving}
        >
          <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={saving}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              activeTab === tab.id
                ? "text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {loading ? (
          <div className="text-xs text-zinc-400">Đang tải locations...</div>
        ) : (
          <>
            {/* Route Tab */}
            {activeTab === "route" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Từ Location *</label>
                  <select
                    value={fromLocationId}
                    onChange={(e) => setFromLocationId(e.target.value)}
                    className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    disabled={saving}
                  >
                    <option value="">-- Chọn location --</option>
                    {locations.map((loc) => (
                      <option key={loc.locationId} value={loc.locationId}>
                        {loc.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Đến Location *</label>
                  <select
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    disabled={saving}
                  >
                    <option value="">-- Chọn location --</option>
                    {locations.map((loc) => (
                      <option key={loc.locationId} value={loc.locationId}>
                        {loc.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Loại Icon</label>
                  <select
                    value={iconType}
                    onChange={(e) => setIconType(e.target.value as "car" | "walking" | "bike" | "plane" | "custom")}
                    className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    disabled={saving}
                  >
                    <option value="car">Xe hơi</option>
                    <option value="walking">Đi bộ</option>
                    <option value="bike">Xe đạp</option>
                    <option value="plane">Máy bay</option>
                    <option value="custom">Tùy chỉnh</option>
                  </select>
                </div>

                {/* Route Options */}
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">Loại đường đi</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleUseStraightLine}
                        disabled={saving || isCalculatingRoute}
                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                          useStraightLine
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                        } disabled:opacity-50`}
                      >
                        Đường thẳng
                      </button>
                      <button
                        type="button"
                        onClick={handleFindRoute}
                        disabled={saving || isCalculatingRoute || !fromLocationId || !toLocationId || iconType === "plane"}
                        className={`px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1 ${
                          !useStraightLine && routePath
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isCalculatingRoute ? (
                          <>
                            <Icon icon="mdi:loading" className="w-3 h-3 animate-spin" />
                            Đang tìm...
                          </>
                        ) : (
                          <>
                            <Icon icon="mdi:route" className="w-3 h-3" />
                            Tìm đường
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Route Info */}
                  {routeDistance !== null && !useStraightLine && (
                    <div className="bg-zinc-800/50 rounded px-2 py-1.5 space-y-1 text-[10px]">
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="text-zinc-400">Khoảng cách:</span>
                        <span className="font-medium">
                          {routeDistance < 1000
                            ? `${Math.round(routeDistance)}m`
                            : `${(routeDistance / 1000).toFixed(2)}km`}
                        </span>
                      </div>
                    </div>
                  )}

                  {useStraightLine && fromLocationId && toLocationId && (
                    <div className="bg-zinc-800/50 rounded px-2 py-1.5 text-[10px] text-zinc-400 italic">
                      Sử dụng đường thẳng giữa 2 điểm
                    </div>
                  )}

                  {iconType === "plane" && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5 text-[10px] text-amber-400">
                      <Icon icon="mdi:information" className="w-3 h-3 inline mr-1" />
                      Máy bay chỉ hỗ trợ đường thẳng
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timing Tab */}
            {activeTab === "timing" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Thời lượng (ms): {durationMs}
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="30000"
                    step="500"
                    value={durationMs}
                    onChange={(e) => setDurationMs(parseInt(e.target.value))}
                    className="w-full"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Thời gian bắt đầu (ms)</label>
                  <input
                    type="number"
                    value={startTimeMs}
                    onChange={(e) => setStartTimeMs(e.target.value ? parseInt(e.target.value) : 0)}
                    className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="0 = bắt đầu cùng segment"
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {/* Style Tab */}
            {activeTab === "style" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Màu đường</label>
                  <input
                    type="color"
                    value={lineColor}
                    onChange={(e) => setLineColor(e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Độ dày đường: {lineWidth}px
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(parseInt(e.target.value))}
                    className="w-full"
                    disabled={saving}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMarkers}
                    onChange={(e) => setShowMarkers(e.target.checked)}
                    className="w-4 h-4 rounded"
                    disabled={saving}
                  />
                  <span className="text-xs text-zinc-300">Hiển thị markers</span>
                </label>

                {/* Custom Icon Upload */}
                <div className="space-y-2 pt-2 border-t border-zinc-700/50">
                  <label className="block text-xs text-zinc-400">Custom Icon (Tùy chỉnh icon di chuyển)</label>

                  {/* Current Icon Preview */}
                  {(iconPreview || iconUrl) && !iconFile && (
                    <div className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded text-xs border border-zinc-700">
                      <img
                        src={iconPreview || iconUrl}
                        alt="Current icon"
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex-1">
                        <div className="text-zinc-300 text-xs">Icon hiện tại</div>
                        {iconUrl && (
                          <div className="text-zinc-500 text-[10px] truncate max-w-[180px]" title={iconUrl}>
                            {iconUrl}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleIconFileChange}
                      className="hidden"
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      disabled={saving}
                      className="w-full px-2 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors flex items-center justify-center gap-1"
                    >
                      {iconUrl || iconPreview ? "Thay đổi" : "Upload icon"}
                    </button>
                  </div>

                  {iconFile && (
                    <div className="flex items-center gap-2 p-2 bg-emerald-900/20 rounded text-xs border border-emerald-700/50">
                      {iconPreview && (
                        <img src={iconPreview} alt="Preview" className="w-8 h-8 rounded object-cover" />
                      )}
                      <span className="flex-1 truncate text-emerald-300 font-medium">{iconFile.name}</span>
                      <span className="text-[10px] text-emerald-400">Mới</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIconFile(null);
                          setIconPreview(null);
                        }}
                        className="p-1 hover:bg-zinc-700 rounded"
                      >
                        <Icon icon="mdi:close" className="w-3 h-3 text-zinc-400" />
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-zinc-500">Nhập URL icon:</div>
                  <input
                    type="url"
                    value={iconUrl}
                    onChange={(e) => {
                      setIconUrl(e.target.value);
                      setIconFile(null);
                      setIconPreview(null);
                    }}
                    className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="https://example.com/icon.png"
                    disabled={saving}
                  />

                  <div className="text-[10px] text-zinc-500 italic">
                    💡 Nhập URL hoặc upload file. Nếu để trống, sẽ dùng icon mặc định theo loại phương tiện.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-2 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || !fromLocationId || !toLocationId}
            className="flex-1 px-2 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}