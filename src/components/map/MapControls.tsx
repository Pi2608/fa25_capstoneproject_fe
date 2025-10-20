import { useState, useRef } from "react";
import { FeatureData, toggleLayerVisibility, toggleFeatureVisibility, addDataLayerToMap, updateDataLayerInMap, removeDataLayerFromMap, createFeatureInMap, updateFeatureInMap, deleteFeatureFromMap } from "@/utils/mapUtils";
import { RawLayer, MapFeatureResponse, CreateMapFeatureRequest, UpdateMapFeatureRequest } from "@/lib/api";
import type { Map as LMap, FeatureGroup } from "leaflet";

// ---------------- StylePanel ----------------
export interface StylePanelProps {
  selectedLayer: FeatureData | RawLayer | null;
  showStylePanel: boolean;
  setShowStylePanel: (val: boolean) => void;
  onUpdateLayer?: (layerId: string, updates: { isVisible?: boolean; zIndex?: number; customStyle?: string; filterConfig?: string }) => Promise<void>;
  onUpdateFeature?: (featureId: string, updates: UpdateMapFeatureRequest) => Promise<void>;
}

export function StylePanel({
  selectedLayer,
  showStylePanel,
  setShowStylePanel,
  onUpdateLayer,
  onUpdateFeature
}: StylePanelProps) {
  const [activeTab, setActiveTab] = useState<"Style" | "Attributes">("Style");
  const [style, setStyle] = useState({
    color: "#ff0000",
    fill: 21,
    stroke: 100,
    width: 2,
    lineStyle: "Solid",
    // areaStyle: "Solid"
  });

  if (!selectedLayer) return null;

  const isFeature = 'featureId' in selectedLayer;
  const layerName = isFeature ? selectedLayer.name : selectedLayer.name;

  return (
    <>
      {showStylePanel && (
        <div className="absolute top-15 right-1 z-[3000] w-80 max-h-[75vh] overflow-hidden pointer-events-auto bg-black/80 text-white rounded shadow-lg">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-600">
            <div className="font-semibold text-lg">{layerName}</div>
            <button
              onClick={() => setShowStylePanel(false)}
              className="px-2 py-1 rounded hover:bg-gray-500 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M6 16h2v2c0 .55.45 1 1 1s1-.45 1-1v-3c0-.55-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1m2-8H6c-.55 0-1 .45-1 1s.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1s-1 .45-1 1zm7 11c.55 0 1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-3c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1m1-11V6c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1s-.45-1-1-1z"/>
              </svg>
            </button>
          </div>

          {/* Description */}
          <div className="px-4 py-2">
            <input
              type="text"
              placeholder="Add a description"
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-white/50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 px-4 py-2">
            <button className="p-2 rounded hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-2 15l-5-5l1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </button>
            <button className="p-2 rounded hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              </svg>
            </button>
            <div className="ml-auto">
              <button className="p-2 rounded hover:bg-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2s-2 .9-2 2s.9 2 2 2m0 2c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2m0 6c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-600">
            <button
              onClick={() => setActiveTab("Style")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "Style" 
                  ? "text-white border-b-2 border-white" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Style
            </button>
            <button
              onClick={() => setActiveTab("Attributes")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "Attributes" 
                  ? "text-white border-b-2 border-white" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Attributes
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[40vh] overflow-y-auto">
            {activeTab === "Style" ? (
              <>
                {/* Color */}
                <div>
                  <label className="block text-sm font-medium mb-2">Color</label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border border-white/20 cursor-pointer"
                      style={{ backgroundColor: style.color }}
                      onClick={() => {
                        const newColor = prompt("Enter color (hex):", style.color);
                        if (newColor) setStyle(prev => ({ ...prev, color: newColor }));
                      }}
                    />
                    <span className="text-sm capitalize">{style.color}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6l-6-6l1.41-1.41z"/>
                    </svg>
                  </div>
                </div>

                {/* Fill */}
                <div>
                  <label className="block text-sm font-medium mb-2">Fill</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={style.fill}
                      onChange={(e) => setStyle(prev => ({ ...prev, fill: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-sm w-12 text-right">{style.fill}%</span>
                  </div>
                </div>

                {/* Stroke */}
                <div>
                  <label className="block text-sm font-medium mb-2">Stroke</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={style.stroke}
                      onChange={(e) => setStyle(prev => ({ ...prev, stroke: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-sm w-12 text-right">{style.stroke}%</span>
                  </div>
                </div>

                {/* Width */}
                <div>
                  <label className="block text-sm font-medium mb-2">Width</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={style.width}
                      onChange={(e) => setStyle(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-sm w-12 text-right">{style.width}</span>
                  </div>
                </div>

                {/* Style */}
                <div>
                  <label className="block text-sm font-medium mb-2">Style</label>
                  <select
                    value={style.lineStyle}
                    onChange={(e) => setStyle(prev => ({ ...prev, lineStyle: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white"
                  >
                    <option value="Solid">Solid</option>
                    <option value="Dashed">Dashed</option>
                    <option value="Dotted">Dotted</option>
                  </select>
                </div>

                {/* Area */}
                {/* <div>
                  <label className="block text-sm font-medium mb-2">Area</label>
                  <select
                    value={style.areaStyle}
                    onChange={(e) => setStyle(prev => ({ ...prev, areaStyle: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white"
                  >
                    <option value="Solid">Solid</option>
                    <option value="Hatched">Hatched</option>
                    <option value="Crosshatched">Crosshatched</option>
                  </select>
                </div> */}
              </>
            ) : (
              <div className="text-sm text-white/70">
                Attributes panel - Feature properties and metadata
              </div>
            )}
          </div>
        </div>
      )}
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
  currentBaseLayer = "osm"
}: DataLayersPanelProps) {
  const [activeTab, setActiveTab] = useState<"Segment" | "List">("List");

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
            <button
              onClick={() => setActiveTab("Segment")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "Segment" 
                  ? "text-white border-b-2 border-white" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Segment
            </button>
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
                  <div className="text-sm font-medium text-white/70 mb-2">Elements</div>
                  {features.map((feature,index : number) => (
                    <div
                      key={`${feature.featureId}-${index}`}
                      className="flex items-center justify-between px-2 py-1 hover:bg-white/5 rounded cursor-pointer"
                      onClick={() => onSelectLayer?.(feature)}
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
                              if (confirm(`Delete "${feature.name}"?`)) {
                                feature.featureId && onDeleteFeature(feature.featureId);
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
                              if (confirm(`Remove "${layer.name}" from map?`)) {
                                onRemoveDataLayer(layer.id);
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