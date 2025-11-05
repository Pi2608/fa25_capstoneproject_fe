"use client";

import { useState, useEffect } from "react";
import { AttachLayerRequest } from "@/lib/api-storymap";
import { RawLayer } from "@/lib/api-maps";
import { getJson } from "@/lib/api-core";

interface SelectLayerDialogProps {
  segmentId: string;
  onClose: () => void;
  onSave: (data: AttachLayerRequest) => Promise<void>;
}

export default function SelectLayerDialog({ segmentId, onClose, onSave }: SelectLayerDialogProps) {
  const [layers, setLayers] = useState<RawLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  
  // Configuration
  const [isVisible, setIsVisible] = useState(true);
  const [opacity, setOpacity] = useState(1.0);
  const [zIndex, setZIndex] = useState(1);
  const [displayOrder, setDisplayOrder] = useState(0);

  // Load layers (organization layers + public layers)
  useEffect(() => {
    const loadLayers = async () => {
      try {
        setLoading(true);
        // Fetch layers from organization or public layers
        // Adjust endpoint based on your API
        const response = await getJson<RawLayer[]>("/layers/available");
        setLayers(response || []);
      } catch (error) {
        console.error("Failed to load layers:", error);
        setLayers([]);
      } finally {
        setLoading(false);
      }
    };

    loadLayers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLayerId) {
      alert("Please select a layer");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        layerId: selectedLayerId,
        displayOrder,
        isVisible,
        opacity,
        zIndex,
      });
      onClose();
    } catch (error) {
      console.error("Failed to attach layer:", error);
      alert("Failed to attach layer to segment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-xl font-semibold text-white">Add Layer to Segment</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Layer Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Select Layer *
            </label>
            {loading ? (
              <div className="text-zinc-500 text-center py-8">Loading layers...</div>
            ) : layers.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">
                No layers available. Create layers in your organization first.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-zinc-700 rounded p-2">
                {layers.map((layer) => (
                  <label
                    key={layer.id}
                    className={`flex items-start gap-3 p-3 rounded cursor-pointer transition-colors ${
                      selectedLayerId === layer.id
                        ? "bg-emerald-900/30 border-emerald-500 border"
                        : "bg-zinc-800 hover:bg-zinc-700 border border-transparent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="layer"
                      value={layer.id}
                      checked={selectedLayerId === layer.id}
                      onChange={(e) => setSelectedLayerId(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white flex items-center gap-2">
                        <span>{layer.layerTypeIcon}</span>
                        {layer.name}
                        {layer.isPublic && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                            Public
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Type: {layer.layerTypeName} • Owner: {layer.ownerName}
                      </div>
                      {layer.sourceName && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Source: {layer.sourceName}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Display Configuration */}
          {selectedLayerId && (
            <>
              <div className="border-t border-zinc-700 pt-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Display Settings</h3>
                
                {/* Visibility */}
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-300">Visible</span>
                </label>

                {/* Opacity */}
                <div className="mb-3">
                  <label className="block text-sm text-zinc-300 mb-1">
                    Opacity: {(opacity * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Z-Index */}
                <div className="mb-3">
                  <label className="block text-sm text-zinc-300 mb-1">
                    Z-Index (Layer Order)
                  </label>
                  <input
                    type="number"
                    value={zIndex}
                    onChange={(e) => setZIndex(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  />
                </div>

                {/* Display Order */}
                <div>
                  <label className="block text-sm text-zinc-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Lower numbers appear first in the timeline
                  </p>
                </div>
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-300 hover:text-white"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedLayerId || saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add Layer"}
          </button>
        </div>
      </div>
    </div>
  );
}
