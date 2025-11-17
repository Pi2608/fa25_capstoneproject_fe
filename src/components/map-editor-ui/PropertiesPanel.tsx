"use client";

import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerDTO, UpdateMapFeatureRequest } from "@/lib/api-maps";
import type { Segment } from "@/lib/api-storymap";

type SelectedEntity = {
  type: "feature" | "layer" | "segment";
  data: FeatureData | LayerDTO | Segment;
};

interface PropertiesPanelProps {
  isOpen: boolean;
  selectedItem: SelectedEntity | null;
  onClose: () => void;
  onUpdate?: (updates: any) => Promise<void>;
  onUpdateFeature?: (featureId: string, updates: UpdateMapFeatureRequest) => Promise<void>;
  onApplyStyle?: (layer: any, styleOptions: any) => void;
}

export function PropertiesPanel({
  isOpen,
  selectedItem,
  onClose,
  onUpdate,
  onUpdateFeature,
  onApplyStyle,
}: PropertiesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      if (isOpen) {
        gsap.fromTo(
          panelRef.current,
          { x: 360 },
          { x: 0, duration: 0.3, ease: "power2.out" }
        );
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        x: 360,
        duration: 0.3,
        ease: "power2.in",
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  };

  if (!isOpen || !selectedItem) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="fixed right-0 top-10 bottom-0 w-[280px] bg-zinc-900/95 backdrop-blur-lg border-l border-zinc-800 z-[1500] overflow-y-auto"
      style={{ transform: "translateX(360px)" }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Icon
            icon={getItemIcon(selectedItem.type)}
            className="w-5 h-5 text-zinc-400"
          />
          <h3 className="font-semibold text-sm text-zinc-200">Properties</h3>
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-zinc-800 rounded transition-colors"
          title="Close"
        >
          <Icon icon="mdi:close" className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {selectedItem.type === "feature" && (
          <FeaturePropertiesContent
            feature={selectedItem.data as FeatureData}
            onUpdate={onUpdate}
            onUpdateFeature={onUpdateFeature}
            onApplyStyle={onApplyStyle}
          />
        )}
        {selectedItem.type === "layer" && (
          <LayerPropertiesContent
            layer={selectedItem.data as LayerDTO}
            onUpdate={onUpdate}
          />
        )}
        {selectedItem.type === "segment" && (
          <SegmentPropertiesContent
            segment={selectedItem.data as Segment}
            onUpdate={onUpdate}
          />
        )}
      </div>
    </div>
  );
}

function FeaturePropertiesContent({
  feature,
  onUpdate,
  onUpdateFeature,
  onApplyStyle,
}: {
  feature: FeatureData;
  onUpdate?: (updates: any) => Promise<void>;
  onUpdateFeature?: (featureId: string, updates: UpdateMapFeatureRequest) => Promise<void>;
  onApplyStyle?: (layer: any, styleOptions: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<"Style" | "Properties">("Style");
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

  // Initialize style from selected feature
  useEffect(() => {
    if (!feature) return;

    const layer = feature.layer as any;
    const options = layer?.options || {};

    // Extract current styles from the layer
    const baseColor = options.fillColor || options.color || '#3388ff';
    setStyle({
      color: baseColor,
      fillOpacity: Math.round((options.fillOpacity || 0.25) * 100),
      strokeOpacity: Math.round((options.opacity || 1.0) * 100),
      weight: options.weight || 2,
      dashArray: options.dashArray || '',
    });

    setFeatureName(feature.name || '');

    // Extract properties from GeoJSON feature
    if (layer?.feature && layer.feature.properties) {
      setProperties(layer.feature.properties);
      setDescription(layer.feature.properties.description || '');
    } else {
      setProperties({});
      setDescription('');
    }
  }, [feature]);

  // Apply style visually in real-time (no DB update)
  const applyStyleRealtime = () => {
    if (!feature.layer || !onApplyStyle) return;

    onApplyStyle(feature.layer, {
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
    if (!feature.featureId) return;

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
      await onUpdateFeature(feature.featureId, {
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
    if (!feature.featureId || !onUpdateFeature) return;

    await onUpdateFeature(feature.featureId, {
      name: featureName,
      description: description || null,
      properties: Object.keys(properties).length > 0 ? JSON.stringify(properties) : null,
    });
  };

  return (
    <div className="space-y-3">
      {/* Name Input */}
      <div>
        <input
          type="text"
          value={featureName}
          onChange={(e) => setFeatureName(e.target.value)}
          placeholder="Feature name"
          className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {/* Description Input */}
      <div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-700 -mx-4 px-4">
        <button
          onClick={() => setActiveTab("Style")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "Style"
              ? "text-white border-b-2 border-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Style
        </button>
        <button
          onClick={() => setActiveTab("Properties")}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "Properties"
              ? "text-white border-b-2 border-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Properties
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
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
                    setTimeout(() => applyStyleRealtime(), 0);
                  }}
                  className="w-8 h-8 rounded cursor-pointer bg-zinc-800 border border-zinc-700"
                  style={{ padding: 0 }}
                />
                <div className="flex-1 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white">
                  <span className="uppercase">{style.color}</span>
                </div>
              </div>
            </div>

            {/* Fill Opacity */}
            <div>
              <label className="block text-sm font-medium mb-2 text-zinc-400">Fill</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={style.fillOpacity}
                  onChange={(e) => {
                    setStyle(prev => ({ ...prev, fillOpacity: parseInt(e.target.value) }));
                    applyStyleRealtime();
                  }}
                  className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer range-slider"
                  style={{
                    background: `linear-gradient(to right, ${style.color} 0%, ${style.color} ${style.fillOpacity}%, rgb(63 63 70) ${style.fillOpacity}%, rgb(63 63 70) 100%)`
                  }}
                />
                <span className="text-sm w-12 text-right text-zinc-300">{style.fillOpacity}%</span>
              </div>
            </div>

            {/* Stroke Opacity */}
            <div>
              <label className="block text-sm font-medium mb-2 text-zinc-400">Stroke</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={style.strokeOpacity}
                  onChange={(e) => {
                    setStyle(prev => ({ ...prev, strokeOpacity: parseInt(e.target.value) }));
                    applyStyleRealtime();
                  }}
                  className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer range-slider"
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
                  onChange={(e) => {
                    setStyle(prev => ({ ...prev, weight: parseInt(e.target.value) }));
                    applyStyleRealtime();
                  }}
                  className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer range-slider"
                  style={{
                    background: `linear-gradient(to right, rgb(209 213 219) 0%, rgb(209 213 219) ${(style.weight / 15) * 100}%, rgb(63 63 70) ${(style.weight / 15) * 100}%, rgb(63 63 70) 100%)`
                  }}
                />
                <span className="text-sm w-12 text-right text-zinc-300">{style.weight}</span>
              </div>
            </div>

            {/* Dash Array */}
            <div>
              <label className="block text-sm font-medium mb-2 text-zinc-400">Style</label>
              <select
                value={style.dashArray}
                onChange={(e) => {
                  setStyle(prev => ({ ...prev, dashArray: e.target.value }));
                  setTimeout(() => applyStyleRealtime(), 0);
                }}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-white cursor-pointer focus:outline-none focus:border-zinc-600"
              >
                <option value="">Solid</option>
                <option value="5, 5">Dashed</option>
                <option value="2, 4">Dotted</option>
                <option value="10, 5, 2, 5">Dash-Dot</option>
              </select>
            </div>

            {/* Apply Button */}
            <div className="pt-2">
              <button
                onClick={handleApplyStyle}
                className="w-full px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                Apply Changes
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {/* Properties */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-zinc-400">Custom Properties</label>
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
                    <div key={index} className="flex items-start gap-2">
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
                        <Icon icon="mdi:delete" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={handleAddProperty}
                  className="w-full py-3 border border-dashed border-zinc-700 rounded-md hover:border-zinc-600 text-zinc-500 hover:text-zinc-400 text-sm transition-colors"
                >
                  Add custom properties
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

      {/* CSS for range sliders */}
      <style jsx>{`
        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }

        .range-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}

function LayerPropertiesContent({
  layer,
  onUpdate,
}: {
  layer: LayerDTO;
  onUpdate?: (updates: any) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Layer Info</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Name:</span>
            <span className="text-zinc-200">{layer.layerName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Type:</span>
            <span className="text-zinc-200">{layer.layerType}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Features:</span>
            <span className="text-zinc-200">{layer.featureCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Visible:</span>
            <span className={cn("text-sm", layer.isPublic ? "text-emerald-500" : "text-zinc-500")}>
              {layer.isPublic ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500 italic">
          Layer configuration options will be expanded in future updates.
        </p>
      </div>
    </div>
  );
}

function SegmentPropertiesContent({
  segment,
  onUpdate,
}: {
  segment: Segment;
  onUpdate?: (updates: any) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Segment Info</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Name:</span>
            <span className="text-zinc-200">{segment.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Duration:</span>
            <span className="text-zinc-200">{(segment.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Order:</span>
            <span className="text-zinc-200">#{segment.displayOrder + 1}</span>
          </div>
        </div>
      </div>

      {segment.description && (
        <div className="border-t border-zinc-800 pt-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Description</h4>
          <p className="text-sm text-zinc-400">{segment.description}</p>
        </div>
      )}

      <div className="border-t border-zinc-800 pt-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Contents</h4>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Zones:</span>
            <span className="text-zinc-200">{segment.zones?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Layers:</span>
            <span className="text-zinc-200">{segment.layers?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Locations:</span>
            <span className="text-zinc-200">{segment.locations?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500 italic">
          Detailed segment editing is available in the left sidebar.
        </p>
      </div>
    </div>
  );
}

function getItemIcon(type: string): string {
  const iconMap: Record<string, string> = {
    feature: "mdi:vector-square",
    layer: "mdi:layers-outline",
    segment: "mdi:filmstrip-box",
  };

  return iconMap[type] || "mdi:information-outline";
}
