"use client";

import { useState, useEffect } from "react";
import { CreateSegmentZoneRequest, Zone, getZones, searchZones } from "@/lib/api-storymap";
import { Icon } from "@/components/map-editor-ui/Icon";

interface ZoneFormProps {
  segmentId: string;
  onSave: (data: CreateSegmentZoneRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ZoneForm({
  segmentId,
  onSave,
  onCancel,
  isLoading = false,
}: ZoneFormProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [highlightBoundary, setHighlightBoundary] = useState(true);
  const [boundaryColor, setBoundaryColor] = useState("#FFD700");
  const [fillZone, setFillZone] = useState(true);
  const [fillColor, setFillColor] = useState("#FFD700");
  const [fillOpacity, setFillOpacity] = useState(0.3);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await getZones();
      setZones(data || []);
    } catch (error) {
      console.error("Failed to load zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadZones();
      return;
    }

    setLoading(true);
    try {
      const results = await searchZones(searchTerm);
      setZones(results || []);
    } catch (error) {
      console.error("Failed to search zones:", error);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="p-3 space-y-3 border-b border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Thêm Zone</h4>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          disabled={saving}
        >
          <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Search - Always visible */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Tìm kiếm Zone</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Tìm kiếm theo tên..."
              className="flex-1 bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
              disabled={saving || loading}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={saving || loading}
              className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title="Tìm kiếm"
            >
              <Icon icon="mdi:magnify" className="w-3.5 h-3.5" />
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  loadZones();
                }}
                disabled={saving || loading}
                className="px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                title="Xóa tìm kiếm"
              >
                <Icon icon="mdi:close" className="w-3.5 h-3.5" />
              </button>
            )}
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
                <div className="text-xs">Đang tải zones...</div>
              </div>
            ) : zones.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                {searchTerm ? "Không tìm thấy zone nào" : "Không có zone nào. Hãy thử tìm kiếm."}
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
                      selectedZoneId === zone.zoneId ? 'bg-blue-900/30 border-l-4 border-blue-500' : ''
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

        {/* Display Options - Only show when zone is selected */}
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
