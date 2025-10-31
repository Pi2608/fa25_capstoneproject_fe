"use client";

import { useState, useEffect } from "react";
import { 
  getMapLayers, 
  copyFeatureToLayer, 
  type LayerInfo, 
  type CopyFeatureToLayerRequest 
} from "@/lib/api";

interface CopyFeatureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  sourceLayerId: string;
  sourceLayerName: string;
  featureIndex: number;
  initialCopyMode?: "existing" | "new";
  onSuccess: (message: string) => void;
}

export default function CopyFeatureDialog({
  isOpen,
  onClose,
  mapId,
  sourceLayerId,
  sourceLayerName,
  featureIndex,
  initialCopyMode = "existing",
  onSuccess
}: CopyFeatureDialogProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [copyMode, setCopyMode] = useState<"existing" | "new">(initialCopyMode);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [newLayerName, setNewLayerName] = useState<string>("Copy");

  // Update copyMode when initialCopyMode changes
  useEffect(() => {
    setCopyMode(initialCopyMode);
  }, [initialCopyMode]);

  // Load layers when dialog opens
  useEffect(() => {
    if (isOpen && mapId) {
      loadLayers();
    }
  }, [isOpen, mapId]);

  const loadLayers = async () => {
    try {
      setLoading(true);
      const layersData = await getMapLayers(mapId);
      // Filter out the source layer from the list
      const availableLayers = layersData.filter(layer => layer.layerId !== sourceLayerId);
      setLayers(availableLayers);
      
      // Auto-select first available layer if any
      if (availableLayers.length > 0) {
        setSelectedLayerId(availableLayers[0].layerId);
      }
    } catch (error) {
      console.error("Failed to load layers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    
    try {
      setLoading(true);

      const request: CopyFeatureToLayerRequest = {
        featureIndex,
        ...(copyMode === "existing" 
          ? { targetLayerId: selectedLayerId }
          : { newLayerName: newLayerName || "Copy" }
        )
      };


      const response = await copyFeatureToLayer(mapId, sourceLayerId, request);
      
      if (response.success) {
        onSuccess(response.message);
        onClose();
      } else {
        alert("Failed to copy feature: " + response.message);
      }
    } catch (error) {
      console.error("Failed to copy feature:", error);
      alert("Failed to copy feature. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10002]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Copy Feature</h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Copy feature from <span className="font-medium">{sourceLayerName}</span>
          </p>
        </div>

        {/* Copy Options */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Copy to:
          </label>
          
          {/* Existing Layers Section */}
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <input
                type="radio"
                value="existing"
                checked={copyMode === "existing"}
                onChange={(e) => setCopyMode(e.target.value as "existing")}
                className="mr-2"
              />
              <span className="text-sm font-medium">Existing layer</span>
            </div>
            
            {copyMode === "existing" && (
              <div className="ml-6">
                {loading ? (
                  <div className="text-sm text-gray-500">Loading layers...</div>
                ) : layers.length === 0 ? (
                  <div className="text-sm text-gray-500">No other layers available</div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 bg-gray-50">
                    {layers.map((layer) => (
                      <label key={layer.layerId} className="flex items-center cursor-pointer hover:bg-white p-2 rounded transition-colors">
                        <input
                          type="radio"
                          name="existingLayer"
                          value={layer.layerId}
                          checked={selectedLayerId === layer.layerId}
                          onChange={(e) => setSelectedLayerId(e.target.value)}
                          className="mr-3 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{layer.layerName}</div>
                          <div className="text-xs text-gray-500">
                            {layer.featureCount} features • {layer.layerType}
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${layer.isVisible ? 'bg-green-500' : 'bg-gray-300'}`} title={layer.isVisible ? 'Visible' : 'Hidden'} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New Layer Section */}
          <div>
            <div className="flex items-center mb-2">
              <input
                type="radio"
                value="new"
                checked={copyMode === "new"}
                onChange={(e) => setCopyMode(e.target.value as "new")}
                className="mr-2"
              />
              <span className="text-sm font-medium">Create new layer</span>
            </div>
            
            {copyMode === "new" && (
              <div className="ml-6">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newLayerName}
                    onChange={(e) => setNewLayerName(e.target.value)}
                    placeholder="Enter layer name"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <div className="text-xs text-gray-500">
                    The new layer will be created and the feature will be copied to it.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={loading || 
              (copyMode === "existing" && !selectedLayerId) ||
              (copyMode === "new" && !newLayerName.trim())
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ pointerEvents: 'auto' }}
          >
            {loading ? "Copying..." : "Copy Feature"}
          </button>
        </div>
      </div>
    </div>
  );
}
