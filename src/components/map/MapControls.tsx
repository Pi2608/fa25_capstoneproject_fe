import { useState, useRef, useEffect } from "react";
import { FeatureData, toggleLayerVisibility, toggleFeatureVisibility, addDataLayerToMap, updateDataLayerInMap, removeDataLayerFromMap, createFeatureInMap, updateFeatureInMap, deleteFeatureFromMap } from "@/utils/mapUtils";
import { RawLayer, MapFeatureResponse, CreateMapFeatureRequest, UpdateMapFeatureRequest } from "@/lib/api";
import type { Map as LMap, FeatureGroup } from "leaflet";

import DeleteConfirmModal from "./DeleteConfirmModal";

// ---------------- StylePanel ----------------
export interface StylePanelProps {
  selectedLayer: FeatureData | RawLayer | null;
  showStylePanel: boolean;
  setShowStylePanel: (val: boolean) => void;
  onUpdateLayer?: (layerId: string, updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => Promise<void>;
  onUpdateFeature?: (featureId: string, updates: UpdateMapFeatureRequest) => Promise<void>;
  onApplyStyle?: (layer: any, styleOptions: any) => void;
}

export function StylePanel({
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
  const layerName = featureName || (isFeature ? selectedLayer.name : selectedLayer.name);

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
                    <></>
                  )}
                    <button
                      onClick={handleAddProperty}
                      className="w-full pt-2 hover:border-zinc-600 text-zinc-500 hover:text-zinc-400 text-sm transition-colors"
                    >
                      Add properties
                    </button>
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

// ---------------- DataLayersPanel (List Panel) ----------------
export interface DataLayersPanelProps {
  features: FeatureData[];
  layers: RawLayer[];
  showDataLayersPanel: boolean;
  setShowDataLayersPanel: (val: boolean) => void;
  map: LMap | null;
  dataLayerRefs: React.MutableRefObject<Map<string, L.Layer>>;
  onLayerVisibilityChange?: (layerId: string, isVisible: boolean) => void;
  onFeatureVisibilityChange?: (featureId: string, isVisible: boolean) => void;
  onSelectLayer?: (layer: FeatureData | RawLayer) => void;
  // CRUD operations
  onAddDataLayer?: (layerId: string, isVisible?: boolean, zIndex?: number) => Promise<void>;
  onUpdateDataLayer?: (layerId: string, updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => Promise<void>;
  onRemoveDataLayer?: (layerId: string) => Promise<void>;
  onDeleteFeature?: (featureId: string) => Promise<void>;
  // Base layer change
  onBaseLayerChange?: (baseLayer: "osm" | "sat" | "dark") => void;
  currentBaseLayer?: "osm" | "sat" | "dark";
  // Hover interactions
  onFeatureHover?: (layer: L.Layer | null, isEntering: boolean) => void;
  hoveredLayer?: L.Layer | null;
  selectedLayers?: Set<L.Layer>;
}

export function DataLayersPanel({
  features,
  layers,
  showDataLayersPanel,
  setShowDataLayersPanel,
  map,
  dataLayerRefs,
  onLayerVisibilityChange,
  onFeatureVisibilityChange,
  onSelectLayer,
  onAddDataLayer,
  onUpdateDataLayer,
  onRemoveDataLayer,
  onDeleteFeature,
  onBaseLayerChange,
  currentBaseLayer = "osm",
  onFeatureHover,
  hoveredLayer,
  selectedLayers
}: DataLayersPanelProps) {
  const [activeTab, setActiveTab] = useState<"Segment" | "List">("List");
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    itemId: string;
    itemName: string;
    itemType: "feature" | "layer";
  }>({
    isOpen: false,
    itemId: "",
    itemName: "",
    itemType: "feature"
  });

  return (
    <>
      {!showDataLayersPanel && (
        <div className="absolute top-15 left-1 z-[3000] pointer-events-auto">
          <button
            onClick={() => setShowDataLayersPanel(true)}
            className="flex w-10 h-10 justify-center items-center rounded-full bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-2xl text-white hover:bg-black/70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 2L2 7l10 5l10-5l-10-5zM2 17l10 5l10-5M2 12l10 5l10-5"/>
            </svg>
          </button>
        </div>
      )}
      {showDataLayersPanel && (
        <div className="absolute top-15 left-1 z-[3000] w-80 max-h-[65vh] overflow-hidden pointer-events-auto bg-black/80 text-white rounded shadow-lg">
          {/* Tabs */}
          <div className="flex border-b border-gray-600">
            {/* <button
              onClick={() => setActiveTab("Segment")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "Segment" 
                  ? "text-white border-b-2 border-white" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Segment
            </button> */}
            <button
              onClick={() => setActiveTab("List")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "List" 
                  ? "text-white border-b-2 border-white" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              List
            </button>
            <div className="ml-auto px-4 py-2">
              <button
                onClick={() => setShowDataLayersPanel(false)}
                className="px-2 py-1 rounded hover:bg-gray-500 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M6 16h2v2c0 .55.45 1 1 1s1-.45 1-1v-3c0-.55-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1m2-8H6c-.55 0-1 .45-1 1s.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1s-1 .45-1 1zm7 11c.55 0 1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-3c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1m1-11V6c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[50vh] overflow-y-auto">
            {activeTab === "List" ? (
              <>
                {/* Elements Section */}
                <div className="px-4 py-2">
                  <div className="text-sm font-medium text-white/70 mb-2">Elements ({features.length})</div>
                  {features.map((feature,index : number) => {
                    const isHovered = hoveredLayer === feature.layer;
                    const isSelected = selectedLayers?.has(feature.layer);
                    
                    
                    return (
                    <div
                      key={`${feature.featureId || feature.id}-${index}`}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-orange-500/30' : isHovered ? 'bg-white/20' : 'hover:bg-white/5'
                      }`}
                      onClick={() => onSelectLayer?.(feature)}
                      onMouseEnter={() => onFeatureHover?.(feature.layer, true)}
                      onMouseLeave={() => onFeatureHover?.(feature.layer, false)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {/* Icon based on type */}
                        <div className="w-4 h-4">
                          {(feature.type.toLocaleLowerCase() === "marker" || feature.type.toLocaleLowerCase() === "point") && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 21s-6-4.5-6-10a6 6 0 1 1 12 0c0 5.5-6 10-6 10z" />
                              <circle cx="12" cy="11" r="2.5" />
                            </svg>
                          )}
                          {feature.type.toLocaleLowerCase() === "line" && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="5" cy="7" r="2" />
                              <circle cx="19" cy="17" r="2" />
                              <path d="M7 8.5 17 15.5" />
                            </svg>
                          )}
                          {(feature.type.toLocaleLowerCase() === "polygon" || feature.type.toLocaleLowerCase() === "rectangle") && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 4h10l4 6-4 10H7L3 10 7 4z" />
                            </svg>
                          )}
                          {feature.type.toLocaleLowerCase() === "circle" && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm">{feature.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            feature.featureId && onFeatureVisibilityChange?.(feature.featureId, !feature.isVisible);
                          }}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          {feature.isVisible ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                                <path d="M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0"/>
                                <path d="M2 12c1.6-4.097 5.336-7 10-7s8.4 2.903 10 7c-1.6 4.097-5.336 7-10 7s-8.4-2.903-10-7"/>
                              </g>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
                                <path strokeLinejoin="round" d="M10.73 5.073A11 11 0 0 1 12 5c4.664 0 8.4 2.903 10 7a11.6 11.6 0 0 1-1.555 2.788M6.52 6.519C4.48 7.764 2.9 9.693 2 12c1.6 4.097 5.336 7 10 7a10.44 10.44 0 0 0 5.48-1.52m-7.6-7.6a3 3 0 1 0 4.243 4.243"/>
                                <path d="m4 4l16 16"/>
                              </g>
                            </svg>
                          )}
                        </button>
                        {onDeleteFeature && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              
                              // Check if user has disabled confirmation
                              const skipConfirm = localStorage.getItem('skipDeleteConfirm') === 'true';
                              
                              if (skipConfirm) {
                                feature.featureId && onDeleteFeature(feature.featureId);
                              } else {
                                setDeleteModal({
                                  isOpen: true,
                                  itemId: feature.featureId || feature.id,
                                  itemName: feature.name,
                                  itemType: "feature"
                                });
                              }
                            }}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M7.616 20q-.672 0-1.144-.472T6 18.385V6H5V5h4v-.77h6V5h4v1h-1v12.385q0 .69-.462 1.153T16.384 20zM17 6H7v12.385q0 .269.173.442t.443.173h8.769q.23 0 .423-.192t.192-.424zM9.808 17h1V8h-1zm3.384 0h1V8h-1zM7 6v13z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>

                {/* Layers Section */}
                <div className="px-4 py-2 border-t border-gray-600">
                  <div className="text-sm font-medium text-white/70 mb-2">Layers</div>
                  {layers.map((layer) => (
                    <div
                      key={layer.id}
                      className="flex items-center justify-between px-2 py-1 hover:bg-white/5 rounded cursor-pointer"
                      onClick={() => onSelectLayer?.(layer)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-4 h-4">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L2 7l10 5l10-5l-10-5zM2 17l10 5l10-5M2 12l10 5l10-5"/>
                          </svg>
                        </div>
                        <span className="text-sm">{layer.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLayerVisibilityChange?.(layer.id, !layer.isVisible);
                          }}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          {layer.isVisible ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                                <path d="M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0"/>
                                <path d="M2 12c1.6-4.097 5.336-7 10-7s8.4 2.903 10 7c-1.6 4.097-5.336 7-10 7s-8.4-2.903-10-7"/>
                              </g>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
                                <path strokeLinejoin="round" d="M10.73 5.073A11 11 0 0 1 12 5c4.664 0 8.4 2.903 10 7a11.6 11.6 0 0 1-1.555 2.788M6.52 6.519C4.48 7.764 2.9 9.693 2 12c1.6 4.097 5.336 7 10 7a10.44 10.44 0 0 0 5.48-1.52m-7.6-7.6a3 3 0 1 0 4.243 4.243"/>
                                <path d="m4 4l16 16"/>
                              </g>
                            </svg>
                          )}
                        </button>
                        {onRemoveDataLayer && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              
                              // Check if user has disabled confirmation
                              const skipConfirm = localStorage.getItem('skipDeleteConfirm') === 'true';
                              
                              if (skipConfirm) {
                                onRemoveDataLayer(layer.id);
                              } else {
                                setDeleteModal({
                                  isOpen: true,
                                  itemId: layer.id,
                                  itemName: layer.name,
                                  itemType: "layer"
                                });
                              }
                            }}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M7.616 20q-.672 0-1.144-.472T6 18.385V6H5V5h4v-.77h6V5h4v1h-1v12.385q0 .69-.462 1.153T16.384 20zM17 6H7v12.385q0 .269.173.442t.443.173h8.769q.23 0 .423-.192t.192-.424zM9.808 17h1V8h-1zm3.384 0h1V8h-1zM7 6v13z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                </div>

                {/* Base Layer Section */}
                <div className="px-4 py-2 border-t border-gray-600">
                  <div className="text-sm font-medium text-white/70 mb-2">Base Layer</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onBaseLayerChange?.("osm")}
                      className={`px-3 py-1 text-xs rounded ${
                        currentBaseLayer === "osm" 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      OSM
                    </button>
                    <button
                      onClick={() => onBaseLayerChange?.("sat")}
                      className={`px-3 py-1 text-xs rounded ${
                        currentBaseLayer === "sat" 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      Satellite
                    </button>
                    <button
                      onClick={() => onBaseLayerChange?.("dark")}
                      className={`px-3 py-1 text-xs rounded ${
                        currentBaseLayer === "dark" 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 text-sm text-white/70">
                Segment panel - Visual representation of map symbols
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={() => {
          if (deleteModal.itemType === "feature" && onDeleteFeature) {
            onDeleteFeature(deleteModal.itemId);
          } else if (deleteModal.itemType === "layer" && onRemoveDataLayer) {
            onRemoveDataLayer(deleteModal.itemId);
          }
        }}
        itemName={deleteModal.itemName}
        itemType={deleteModal.itemType}
      />
    </>
  );
}

// ---------------- MapControls ----------------
export interface MapControlsProps {
  locating: boolean;
  goMyLocation: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export function MapControls({
  locating,
  goMyLocation,
  zoomIn,
  zoomOut
}: MapControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-[3000] flex flex-col gap-2">
      <button
        onClick={zoomIn}
        className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="currentColor" d="M13 6a1 1 0 1 0-2 0v5H6a1 1 0 1 0 0 2h5v5a1 1 0 1 0 2 0v-5h5a1 1 0 1 0 0-2h-5z"/>
        </svg>
      </button>
      <button
        onClick={zoomOut}
        className="flex w-10 h-10 justify-center items-center rounded-full bg-white text-black shadow hover:bg-gray-200 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14"/>
        </svg>
      </button>
      <button
        onClick={goMyLocation}
        className="flex w-10 h-10 justify-center items-center rounded-full bg-emerald-400 text-white shadow hover:bg-emerald-500 cursor-pointer"
      >
        {locating ? 
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="2" r="0" fill="currentColor"><animate attributeName="r" begin="0" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(45 12 12)"><animate attributeName="r" begin="0.125s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(90 12 12)"><animate attributeName="r" begin="0.25s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(135 12 12)"><animate attributeName="r" begin="0.375s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(180 12 12)"><animate attributeName="r" begin="0.5s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(225 12 12)"><animate attributeName="r" begin="0.625s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(270 12 12)"><animate attributeName="r" begin="0.75s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
              <circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(315 12 12)"><animate attributeName="r" begin="0.875s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle>
            </svg>
            :
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m5.252 9.975l11.66-5.552c1.7-.81 3.474.965 2.665 2.666l-5.552 11.659c-.759 1.593-3.059 1.495-3.679-.158L9.32 15.851a2 2 0 0 0-1.17-1.17l-2.74-1.027c-1.652-.62-1.75-2.92-.157-3.679"/>
            </svg>
        }
      </button>
    </div>
  );
}