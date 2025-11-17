"use client";

import { useState, useEffect } from "react";
import { AttachLayerRequest } from "@/lib/api-storymap";
import { getMapLayers } from "@/lib/api-maps";
import { Button } from "@/components/ui/button";

interface LayerInfo {
  layerId: string;
  layerName: string;
  layerType: string;
  isVisible: boolean;
  color?: string;
  zIndex?: number;
}

interface LayerAttachDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AttachLayerRequest) => Promise<void>;
  mapId: string;
  segmentId: string;
  attachedLayerIds?: string[]; // Already attached layer IDs to filter out
}

export default function LayerAttachDialog({
  isOpen,
  onClose,
  onSave,
  mapId,
  segmentId,
  attachedLayerIds = [],
}: LayerAttachDialogProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<LayerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Configuration
  const [isVisible, setIsVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [zIndex, setZIndex] = useState(0);

  // Load layers
  useEffect(() => {
    if (isOpen && mapId) {
      loadLayers();
    }
  }, [isOpen, mapId]);

  const loadLayers = async () => {
    setLoading(true);
    try {
      const data = await getMapLayers(mapId);

      // Filter out already attached layers
      const available = (data || []).filter(
        (layer: LayerInfo) => !attachedLayerIds.includes(layer.layerId)
      );

      setLayers(available);
    } catch (error) {
      console.error("Failed to load layers:", error);
      alert("Failed to load layers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLayer) {
      alert("Please select a layer");
      return;
    }

    setSaving(true);
    try {
      const data: AttachLayerRequest = {
        layerId: selectedLayer.layerId,
        isVisible,
        opacity,
        zIndex,
        displayOrder: 0,
      };

      await onSave(data);
      onClose();
    } catch (error) {
      console.error("Failed to attach layer:", error);
      alert("Failed to attach layer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div>
            <h3 className="text-lg font-semibold text-white">Attach Layer to Segment</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Select a layer from your map to display in this segment
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-180px)]">
          <div className="overflow-y-auto px-6 py-4 space-y-6">
            {/* Layer Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Available Layers ({layers.length})
              </label>
              <div className="max-h-64 overflow-y-auto border border-zinc-700 rounded-lg bg-zinc-800/50">
                {loading ? (
                  <div className="p-8 text-center text-zinc-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
                    Loading layers...
                  </div>
                ) : layers.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    {attachedLayerIds.length > 0
                      ? "No more layers available. All layers are already attached."
                      : "No layers found in this map. Please create layers first."}
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-700">
                    {layers.map((layer) => (
                      <button
                        key={layer.layerId}
                        type="button"
                        onClick={() => setSelectedLayer(layer)}
                        className={`w-full text-left px-4 py-3 hover:bg-zinc-700/50 transition-colors ${
                          selectedLayer?.layerId === layer.layerId
                            ? 'bg-emerald-900/30 border-l-4 border-emerald-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {layer.color && (
                                <div
                                  className="w-4 h-4 rounded border border-zinc-600"
                                  style={{ backgroundColor: layer.color }}
                                />
                              )}
                              <span className="font-medium text-white">{layer.layerName}</span>
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">
                              Type: {layer.layerType}
                              {layer.isVisible !== undefined && (
                                <> • {layer.isVisible ? 'Visible' : 'Hidden'}</>
                              )}
                            </div>
                          </div>
                          {selectedLayer?.layerId === layer.layerId && (
                            <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Configuration */}
            {selectedLayer && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-white mb-3">Layer Display Settings</h4>

                {/* Visibility */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isVisible"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="isVisible" className="text-sm text-zinc-300 cursor-pointer">
                    Visible in this segment
                  </label>
                </div>

                {/* Opacity */}
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">
                    Opacity: {(opacity * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Z-Index */}
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">
                    Z-Index (layer order)
                  </label>
                  <input
                    type="number"
                    value={zIndex}
                    onChange={(e) => setZIndex(Number(e.target.value))}
                    min={-100}
                    max={100}
                    className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Higher values appear on top
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-900/70 border-t border-zinc-800/80">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !selectedLayer}
            >
              {saving ? "Attaching..." : "Attach Layer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
