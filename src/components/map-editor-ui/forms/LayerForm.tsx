"use client";

import { useState, useEffect } from "react";
import { AttachLayerRequest } from "@/lib/api-storymap";
import { getMapLayers } from "@/lib/api-maps";
import { Icon } from "@/components/map-editor-ui/Icon";

interface LayerInfo {
  layerId: string;
  layerName: string;
  layerType: string;
  isVisible: boolean;
  color?: string;
  zIndex?: number;
}

interface LayerFormProps {
  mapId: string;
  segmentId: string;
  onSave: (data: AttachLayerRequest) => Promise<void>;
  onCancel: () => void;
  attachedLayerIds?: string[];
}

export function LayerForm({
  mapId,
  segmentId,
  onSave,
  onCancel,
  attachedLayerIds = [],
}: LayerFormProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<LayerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [zIndex, setZIndex] = useState(0);

  useEffect(() => {
    loadLayers();
  }, [mapId]);

  const loadLayers = async () => {
    setLoading(true);
    try {
      const data = await getMapLayers(mapId);
      const available = (data || []).filter(
        (layer: LayerInfo) => !attachedLayerIds.includes(layer.layerId)
      );
      setLayers(available);
    } catch (error) {
      console.error("Failed to load layers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLayer) return;

    setSaving(true);
    try {
      const data: AttachLayerRequest = {
        layerId: selectedLayer.layerId,
        isVisible,
        opacity,
        zIndex,
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
        <h4 className="text-sm font-semibold text-white">Thêm Layer</h4>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          disabled={saving}
        >
          <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {loading ? (
          <div className="text-xs text-zinc-400">Đang tải layers...</div>
        ) : (
          <>
            {/* Layer Selection */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Chọn Layer *</label>
              <select
                value={selectedLayer?.layerId || ""}
                onChange={(e) => {
                  const layer = layers.find((l) => l.layerId === e.target.value);
                  setSelectedLayer(layer || null);
                }}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={saving}
              >
                <option value="">-- Chọn layer --</option>
                {layers.map((layer) => (
                  <option key={layer.layerId} value={layer.layerId}>
                    {layer.layerName}
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="w-4 h-4 rounded"
                disabled={saving}
              />
              <span className="text-xs text-zinc-300">Hiển thị</span>
            </label>

            {/* Opacity */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Độ mờ: {(opacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full"
                disabled={saving}
              />
            </div>

            {/* Z-Index */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Z-Index</label>
              <input
                type="number"
                value={zIndex}
                onChange={(e) => setZIndex(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-800 text-white rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={saving}
              />
            </div>
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
            disabled={saving || !selectedLayer}
            className="flex-1 px-2 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
