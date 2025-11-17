"use client";

import { useState, useEffect } from "react";
import { FeatureData } from "@/utils/mapUtils";
import { RawLayer, UpdateMapFeatureRequest } from "@/lib/api-maps";

export interface StylePanelProps {
  selectedLayer: FeatureData | RawLayer | null;
  showStylePanel: boolean;
  setShowStylePanel: (val: boolean) => void;
  onUpdateLayer?: (layerId: string, updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => Promise<void>;
  onUpdateFeature?: (featureId: string, updates: UpdateMapFeatureRequest) => Promise<void>;
  onApplyStyle?: (layer: any, styleOptions: any) => void;
}

export default function StylePanel({
  selectedLayer,
  showStylePanel,
  setShowStylePanel,
  onUpdateLayer,
  onUpdateFeature,
  onApplyStyle
}: StylePanelProps) {
  const [activeTab, setActiveTab] = useState<"Style" | "Attributes">("Style");
  const [style, setStyle] = useState({
    color: "#3388ff",
    fillOpacity: 25,
    strokeOpacity: 100,
    weight: 2,
    dashArray: "",
  });
  const [description, setDescription] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [properties, setProperties] = useState<Record<string, any>>({});

  // Initialize style from selected layer
  useEffect(() => {
    if (!selectedLayer) return;

    const isFeature = 'featureId' in selectedLayer;
    
    if (isFeature && selectedLayer.layer) {
      const layer = selectedLayer.layer as any;
      const options = layer.options || {};
      
      // Extract current styles from the layer
      const baseColor = options.fillColor || options.color || '#3388ff';
      setStyle({
        color: baseColor,
        fillOpacity: Math.round((options.fillOpacity || 0.25) * 100),
        strokeOpacity: Math.round((options.opacity || 1.0) * 100),
        weight: options.weight || 2,
        dashArray: options.dashArray || '',
      });

      setFeatureName(selectedLayer.name || '');
      
      // Extract properties from GeoJSON feature
      if (layer.feature && layer.feature.properties) {
        setProperties(layer.feature.properties);
        setDescription(layer.feature.properties.description || '');
      } else {
        setProperties({});
        setDescription('');
      }
    }
  }, [selectedLayer]);

  if (!selectedLayer) return null;

  const isFeature = 'featureId' in selectedLayer;

  // Apply style visually in real-time (no DB update)
  const applyStyleRealtime = () => {
    if (!isFeature || !selectedLayer.layer || !onApplyStyle) return;

    onApplyStyle(selectedLayer.layer, {
      color: style.color,
      fillColor: style.color,
      fillOpacity: style.fillOpacity / 100,
      opacity: style.strokeOpacity / 100,
      weight: style.weight,
      dashArray: style.dashArray,
    });
  };

  // Save to database (called on Apply Changes button)
  const handleApplyStyle = async () => {
    if (!isFeature || !selectedLayer.featureId) return;

    const styleJson = JSON.stringify({
      color: style.color,
      fillColor: style.color,
      fillOpacity: style.fillOpacity / 100,
      opacity: style.strokeOpacity / 100,
      weight: style.weight,
      dashArray: style.dashArray,
    });

    // Apply style visually
    applyStyleRealtime();

    // Update in database
    if (onUpdateFeature) {
      await onUpdateFeature(selectedLayer.featureId, {
        name: featureName,
        description: description || null,
        style: styleJson,
        properties: Object.keys(properties).length > 0 ? JSON.stringify(properties) : null,
      });
    }
  };

  // Handle property changes
  const handleAddProperty = () => {
    const newKey = `property${Object.keys(properties).length + 1}`;
    setProperties(prev => ({ ...prev, [newKey]: "" }));
  };

  const handleUpdateProperty = (oldKey: string, newKey: string, value: string) => {
    setProperties(prev => {
      const newProps = { ...prev };
      if (oldKey !== newKey) {
        delete newProps[oldKey];
      }
      newProps[newKey] = value;
      return newProps;
    });
  };

  const handleDeleteProperty = (key: string) => {
    setProperties(prev => {
      const newProps = { ...prev };
      delete newProps[key];
      return newProps;
    });
  };

  const handleSaveProperties = async () => {
    if (!isFeature || !selectedLayer.featureId || !onUpdateFeature) return;

    await onUpdateFeature(selectedLayer.featureId, {
      name: featureName,
      description: description || null,
      properties: Object.keys(properties).length > 0 ? JSON.stringify(properties) : null,
    });
  };

  return (
    <>
      {showStylePanel && (
        <div className="absolute top-15 right-1 z-[3000] w-80 max-h-[75vh] overflow-hidden pointer-events-auto bg-zinc-900 text-white rounded-lg shadow-2xl border border-zinc-700">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-700">
            <div className="font-semibold text-base text-white/90">Feature Properties</div>
            <button
              onClick={() => setShowStylePanel(false)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Name Input */}
          <div className="px-4 pt-4 pb-2">
            <input
              type="text"
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              placeholder="Add a name"
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Description Input */}
          <div className="px-4 pb-4">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description"
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-700">
            <button
              onClick={() => setActiveTab("Style")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "Style" 
                  ? "text-white border-b-2 border-white" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Style
            </button>
            <button
              onClick={() => setActiveTab("Attributes")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "Attributes" 
                  ? "text-white border-b-2 border-white" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Properties
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3 max-h-[45vh] overflow-y-auto">
            {activeTab === "Style" ? (
              <>
                {/* Color */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-400">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.color}
                      onChange={(e) => {
                        setStyle(prev => ({ ...prev, color: e.target.value }));
                        // Apply immediately on color change
                        setTimeout(() => applyStyleRealtime(), 0);
                      }}
                      className="w-8 h-8 rounded cursor-pointer"
                      style={{ padding: 0, border: 'none' }}
                    />
                    <div className="flex-1 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white flex items-center justify-between">
                      <span className="capitalize">{style.color}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Fill */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-400">Fill</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={style.fillOpacity}
                      onChange={(e) => setStyle(prev => ({ ...prev, fillOpacity: parseInt(e.target.value) }))}
                      onMouseUp={applyStyleRealtime}
                      onTouchEnd={applyStyleRealtime}
                      className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${style.color} 0%, ${style.color} ${style.fillOpacity}%, rgb(63 63 70) ${style.fillOpacity}%, rgb(63 63 70) 100%)`
                      }}
                    />
                    <span className="text-sm w-12 text-right text-zinc-300">{style.fillOpacity}%</span>
                  </div>
                </div>

                {/* Stroke */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-400">Stroke</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={style.strokeOpacity}
                      onChange={(e) => setStyle(prev => ({ ...prev, strokeOpacity: parseInt(e.target.value) }))}
                      onMouseUp={applyStyleRealtime}
                      onTouchEnd={applyStyleRealtime}
                      className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${style.color} 0%, ${style.color} ${style.strokeOpacity}%, rgb(63 63 70) ${style.strokeOpacity}%, rgb(63 63 70) 100%)`
                      }}
                    />
                    <span className="text-sm w-12 text-right text-zinc-300">{style.strokeOpacity}%</span>
                  </div>
                </div>

                {/* Width */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-400">Width</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={style.weight}
                      onChange={(e) => setStyle(prev => ({ ...prev, weight: parseInt(e.target.value) }))}
                      onMouseUp={applyStyleRealtime}
                      onTouchEnd={applyStyleRealtime}
                      className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgb(209 213 219) 0%, rgb(209 213 219) ${(style.weight / 15) * 100}%, rgb(63 63 70) ${(style.weight / 15) * 100}%, rgb(63 63 70) 100%)`
                      }}
                    />
                    <span className="text-sm w-12 text-right text-zinc-300">{style.weight}</span>
                  </div>
                </div>

                {/* Style */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-zinc-400">Style</label>
                  <div className="relative">
                    <select
                      value={style.dashArray}
                      onChange={(e) => {
                        setStyle(prev => ({ ...prev, dashArray: e.target.value }));
                        setTimeout(() => applyStyleRealtime(), 0);
                      }}
                      className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-zinc-600"
                    >
                      <option value="">Solid</option>
                      <option value="5, 5">Dashed</option>
                      <option value="2, 4">Dotted</option>
                      <option value="10, 5, 2, 5">Dash-Dot</option>
                    </select>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {/* Apply Button */}
                {isFeature && (
                  <div className="pt-2">
                    <button
                      onClick={handleApplyStyle}
                      className="w-full px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                      Apply Changes
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {/* Properties */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-zinc-400">Properties</label>
                    <button
                      onClick={handleAddProperty}
                      className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                  
                  {Object.keys(properties).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(properties).map(([key, value], index) => (
                        <div key={`${key}-${index}`} className="flex items-start gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={key}
                              onChange={(e) => handleUpdateProperty(key, e.target.value, value as string)}
                              placeholder="Name"
                              className="px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                            />
                            <input
                              type="text"
                              value={value as string}
                              onChange={(e) => handleUpdateProperty(key, key, e.target.value)}
                              placeholder="Value"
                              className="px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteProperty(key)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                            title="Delete property"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={handleAddProperty}
                      className="w-full pt-2 hover:border-zinc-600 text-zinc-500 hover:text-zinc-400 text-sm transition-colors"
                    >
                      Add properties
                    </button>
                  )}
                </div>

                {/* Save Properties Button */}
                {Object.keys(properties).length > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={handleSaveProperties}
                      className="w-full px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                      Save Properties
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          outline: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
      `}</style>
    </>
  );
}
