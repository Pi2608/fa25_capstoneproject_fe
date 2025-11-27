"use client";

import { useState, useEffect } from "react";
import { CreateLocationRequest, Location } from "@/lib/api-storymap";
import { LocationType } from "@/types/location";
import { Icon } from "@/components/map-editor-ui/Icon";

type TabType = "basic" | "icon" | "display" | "media";

interface LocationFormProps {
  segmentId: string;
  onSave: (data: CreateLocationRequest) => Promise<void>;
  onCancel: () => void;
  initialCoordinates?: [number, number] | null;
  initialLocation?: Location | null;
  isLoading?: boolean;
  onRepickLocation?: () => void;
}

export function LocationForm({
  segmentId,
  onSave,
  onCancel,
  initialCoordinates,
  initialLocation,
  isLoading = false,
  onRepickLocation,
}: LocationFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("PointOfInterest");
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [isVisible, setIsVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialLocation) {
      setTitle(initialLocation.title || "");
      setSubtitle(initialLocation.subtitle || "");
      setDescription(initialLocation.description || "");
      setLocationType(initialLocation.locationType || "PointOfInterest");
      setSelectedIcon(initialLocation.iconId || "");
      setIsVisible(initialLocation.isVisible !== false);
      if (initialLocation.markerGeometry) {
        try {
          const geo = JSON.parse(initialLocation.markerGeometry);
          if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
            setCoordinates([geo.coordinates[0], geo.coordinates[1]]);
          }
        } catch (e) {
          console.error("Failed to parse coordinates:", e);
        }
      }
    } else if (initialCoordinates) {
      setCoordinates(initialCoordinates);
    }
  }, [initialLocation, initialCoordinates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !coordinates) return;

    setSaving(true);
    try {
      const data: CreateLocationRequest = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        locationType,
        markerGeometry: JSON.stringify({
          type: "Point",
          coordinates: coordinates,
        }),
        iconId: selectedIcon || undefined,
        isVisible,
      };

      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "basic", label: "Thông tin", icon: "📍" },
    { id: "icon", label: "Icon", icon: "🎨" },
    { id: "display", label: "Hiển thị", icon: "👁️" },
  ];

  return (
    <div className="p-3 space-y-3 border-b border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {initialLocation ? "Chỉnh sửa Location" : "Thêm Location/POI"}
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

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Basic Tab */}
        {activeTab === "basic" && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tên địa điểm *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Tên location"
                required
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Phụ đề</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Mô tả ngắn"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                placeholder="Mô tả chi tiết..."
                rows={3}
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Loại địa điểm</label>
              <select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={saving}
              >
                <option value="PointOfInterest">Point of Interest</option>
                <option value="Landmark">Landmark</option>
                <option value="Route">Route</option>
                <option value="Event">Event</option>
              </select>
            </div>
            <div className="space-y-1.5">
              {coordinates ? (
                <div className="flex items-center justify-between gap-2 p-2 bg-zinc-800/50 rounded border border-zinc-700">
                  <div className="text-xs text-zinc-400">
                    <span className="font-medium text-zinc-300">📍 Tọa độ:</span>{" "}
                    {coordinates[0].toFixed(4)}, {coordinates[1].toFixed(4)}
                  </div>
                  {onRepickLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoordinates(null); // Clear coordinates immediately
                        onRepickLocation();
                      }}
                      disabled={saving}
                      className="px-2 py-1 text-[10px] bg-emerald-600/80 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Chọn lại vị trí trên bản đồ"
                    >
                      <Icon icon="mdi:map-marker-radius" className="w-3 h-3" />
                      <span>Chọn lại</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-2 bg-zinc-800/50 rounded border border-zinc-700 border-dashed">
                  {onRepickLocation ? (
                    <button
                      type="button"
                      onClick={onRepickLocation}
                      disabled={saving}
                      className="w-full px-2 py-1.5 text-xs bg-emerald-600/80 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <Icon icon="mdi:map-marker-plus" className="w-3.5 h-3.5" />
                      <span>Chọn vị trí trên bản đồ</span>
                    </button>
                  ) : (
                    <div className="text-xs text-zinc-500 text-center">
                      Chưa có tọa độ. Vui lòng chọn vị trí trên bản đồ.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Icon Tab */}
        {activeTab === "icon" && (
          <div className="space-y-2">
            <label className="block text-xs text-zinc-400 mb-1">Chọn icon</label>
            <div className="text-xs text-zinc-500">
              Icon selection sẽ được cập nhật sau
            </div>
          </div>
        )}

        {/* Display Tab */}
        {activeTab === "display" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={saving}
              />
              <span className="text-xs text-zinc-300">Hiển thị trên bản đồ</span>
            </label>
          </div>
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
            disabled={saving || !title.trim() || !coordinates}
            className="flex-1 px-2 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
