"use client";

import { useState } from "react";
import { CreateSegmentZoneRequest, Zone, searchZones } from "@/lib/api-storymap";
import { Icon } from "@/components/map-editor-ui/Icon";

interface ZoneFormProps {
  segmentId: string;
  onSave: (data: CreateSegmentZoneRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ZoneForm({ segmentId, onSave, onCancel, isLoading = false }: ZoneFormProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search params (same as SearchZoneView)
  const [qName, setQName] = useState("");
  const [qCity, setQCity] = useState("");
  const [qState, setQState] = useState("");
  const [qCountry, setQCountry] = useState("");

  const [highlightBoundary, setHighlightBoundary] = useState(true);
  const [boundaryColor, setBoundaryColor] = useState("#FFD700");
  const [fillZone, setFillZone] = useState(true);
  const [fillColor, setFillColor] = useState("#FFD700");
  const [fillOpacity, setFillOpacity] = useState(0.3);

  const hasAnyQuery = (qName.trim() || qCity.trim() || qState.trim() || qCountry.trim()).length > 0;

  const handleSearch = async () => {
    if (!hasAnyQuery) {
      setZones([]);
      return;
    }

    setLoading(true);
    try {
      const results = await searchZones({
        name: qName.trim(),
        city: qCity.trim(),
        state: qState.trim(),
        country: qCountry.trim(),
      } as any);
      setZones(results || []);
    } catch (error) {
      console.error("Failed to search zones:", error);
      setZones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQName("");
    setQCity("");
    setQState("");
    setQCountry("");
    setZones([]);
    setSelectedZoneId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZoneId) return;

    setSaving(true);
    try {
      const data: CreateSegmentZoneRequest = {
        segmentId,
        zoneId: selectedZoneId,
        highlightBoundary,
        boundaryColor: highlightBoundary ? boundaryColor : undefined,
        fillZone,
        fillColor: fillZone ? fillColor : undefined,
        fillOpacity: fillZone ? fillOpacity : undefined,
        isVisible: true,
        displayOrder: 0,
      };
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || loading || isLoading;

  return (
    <div className="p-3 space-y-3 border-b border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Thêm Zone</h4>
        <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded transition-colors" disabled={saving}>
          <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Search - 4 fields (same as SearchZoneView) */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-400">Name</div>
              <input
                type="text"
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="VD: Đồng Tháp"
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
                disabled={disabled}
              />
            </div>

            <div className="space-y-1">
              <div className="text-[10px] text-zinc-400">City</div>
              <input
                type="text"
                value={qCity}
                onChange={(e) => setQCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="VD: Cao Lãnh"
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
                disabled={disabled}
              />
            </div>

            <div className="space-y-1">
              <div className="text-[10px] text-zinc-400">State</div>
              <input
                type="text"
                value={qState}
                onChange={(e) => setQState(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="VD: Đồng Tháp"
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
                disabled={disabled}
              />
            </div>

            <div className="space-y-1">
              <div className="text-[10px] text-zinc-400">Country</div>
              <input
                type="text"
                value={qCountry}
                onChange={(e) => setQCountry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="VD: Việt Nam"
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={disabled || !hasAnyQuery}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Icon icon="mdi:magnify" className="w-4 h-4 mr-1" />
                  Tìm kiếm
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={disabled || !hasAnyQuery}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs transition-colors disabled:opacity-50"
              title="Xóa"
            >
              <Icon icon="mdi:close" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zone List */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Chọn Zone * <span className="text-zinc-500">({zones.length})</span>
          </label>

          <div className="max-h-64 overflow-y-auto scrollbar-dark border border-zinc-700 rounded-lg bg-zinc-800/50">
            {loading ? (
              <div className="p-8 text-center text-zinc-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <div className="text-xs">Đang tìm zones...</div>
              </div>
            ) : zones.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                {hasAnyQuery ? "Không tìm thấy zone nào" : "Nhập từ khóa để tìm kiếm"}
              </div>
            ) : (
              <div className="divide-y divide-zinc-700">
                {zones.map((zone) => (
                  <button
                    key={zone.zoneId}
                    type="button"
                    onClick={() => setSelectedZoneId(zone.zoneId)}
                    disabled={saving || loading}
                    className={`w-full text-left px-3 py-2.5 hover:bg-zinc-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedZoneId === zone.zoneId ? "bg-blue-900/30 border-l-4 border-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-xs truncate">{zone.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {zone.zoneType}
                          {zone.zoneCode && <span className="ml-1">• {zone.zoneCode}</span>}
                        </div>
                      </div>

                      {selectedZoneId === zone.zoneId && (
                        <Icon icon="mdi:check-circle" className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Display Options */}
        {selectedZoneId && (
          <div className="space-y-1.5 text-xs pt-2 border-t border-zinc-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={highlightBoundary}
                onChange={(e) => setHighlightBoundary(e.target.checked)}
                className="w-3 h-3 rounded"
                disabled={saving}
              />
              <span className="text-zinc-300">Highlight Boundary</span>
            </label>

            {highlightBoundary && (
              <div className="ml-5 space-y-1">
                <label className="block text-zinc-400">Màu biên:</label>
                <input
                  type="color"
                  value={boundaryColor}
                  onChange={(e) => setBoundaryColor(e.target.value)}
                  className="w-full h-6 rounded cursor-pointer"
                  disabled={saving}
                />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fillZone}
                onChange={(e) => setFillZone(e.target.checked)}
                className="w-3 h-3 rounded"
                disabled={saving}
              />
              <span className="text-zinc-300">Fill Zone</span>
            </label>

            {fillZone && (
              <div className="ml-5 space-y-1">
                <label className="block text-zinc-400">Màu fill:</label>
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="w-full h-6 rounded cursor-pointer"
                  disabled={saving}
                />
                <label className="block text-zinc-400">Độ trong suốt:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={fillOpacity}
                  onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
                  className="w-full"
                  disabled={saving}
                />
              </div>
            )}
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
            disabled={saving || !selectedZoneId}
            className="flex-1 px-2 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
