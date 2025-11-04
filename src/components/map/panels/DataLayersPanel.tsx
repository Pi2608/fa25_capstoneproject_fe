"use client";

import { useState } from "react";
import { FeatureData } from "@/utils/mapUtils";
import type { Map as LMap } from "leaflet";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { RawLayer } from "@/lib/api-maps";

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

export default function DataLayersPanel({
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
                  {features.map((feature, index: number) => {
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
      <ConfirmDialog
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
        title={`Delete ${deleteModal.itemType}`}
        message="This action cannot be undone"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
