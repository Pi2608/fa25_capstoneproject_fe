"use client";

import { useState, useEffect } from "react";
import type { Feature as GeoJSONFeature } from "geojson";
import { getMapLayers, LayerInfo, copyFeatureToLayer } from "@/lib/api-maps";

interface ZoneContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onZoomToFit: () => void;
  onCopyCoordinates: () => void;
  onCopyToExistingLayer?: (layerId: string) => void;
  onCopyToNewLayer?: (layerName: string) => void;
  onDeleteZone: () => void;
  zoneName?: string;
  mapId?: string;       
  layerId?: string;   
  featureIndex?: number;
  feature?: GeoJSONFeature;
  onSuccess?: (message: string) => void;
}

export default function ZoneContextMenu(props: ZoneContextMenuProps) {
  const {
    visible,
    x,
    y,
    onClose,
    onZoomToFit,
    onCopyCoordinates,
    onCopyToExistingLayer,
    onCopyToNewLayer,
    onDeleteZone,
    zoneName = "Zone",
    mapId,
    layerId,
    featureIndex = 0,
    onSuccess,
  } = props;

  const [showCopySubmenu, setShowCopySubmenu] = useState<"existing" | "new" | null>(null);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [newLayerName, setNewLayerName] = useState("");
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [copying, setCopying] = useState(false);

  const loadLayers = async () => {
    if (!mapId) return;
    try {
      setLoadingLayers(true);
      const layersData = await getMapLayers(mapId);
      const availableLayers = layersData.filter(layer => layer.layerId !== layerId);
      setLayers(availableLayers);
    } catch (error) {
      console.error("Failed to load layers:", error);
    } finally {
      setLoadingLayers(false);
    }
  };

  const handleCopyToExisting = async (targetLayerId: string) => {
    if (!mapId || !layerId) return;
    try {
      setCopying(true);
      const response = await copyFeatureToLayer(mapId, layerId, {
        featureIndex,
        targetLayerId,
      });
      if (response.success) {
        onSuccess?.(response.message);
        onCopyToExistingLayer?.(targetLayerId);
        setShowCopySubmenu(null);
        onClose();
      } else {
        alert("Failed to copy feature: " + response.message);
      }
    } catch (error) {
      console.error("Failed to copy feature:", error);
      alert("Failed to copy feature. Please try again.");
    } finally {
      setCopying(false);
    }
  };

  const handleCopyToNew = async () => {
    if (!mapId || !layerId || !newLayerName.trim()) return;
    try {
      setCopying(true);
      const response = await copyFeatureToLayer(mapId, layerId, {
        featureIndex,
        newLayerName: newLayerName.trim(),
      });
      if (response.success) {
        onSuccess?.(response.message);
        onCopyToNewLayer?.(newLayerName.trim());
        setShowCopySubmenu(null);
        setNewLayerName("");
        onClose();
      } else {
        alert("Failed to copy feature: " + response.message);
      }
    } catch (error) {
      console.error("Failed to copy feature:", error);
      alert("Failed to copy feature. Please try again.");
    } finally {
      setCopying(false);
    }
  };

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !target.closest) return;
      const contextMenuEl = target.closest(".zone-context-menu");
      if (!contextMenuEl) {
        setShowCopySubmenu(null);
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCopySubmenu) {
          setShowCopySubmenu(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onClose, showCopySubmenu]);

  if (!visible) return null;

  const menuItems: Array<
    | {
        icon: string;
        label: string;
        onClick?: () => void;
        shortcut?: string;
        danger?: boolean;
        type?: undefined;
        submenu?: boolean;
      }
    | { type: "divider" }
  > = [
    {
      icon: "🔍",
      label: "Zoom to Fit",
      onClick: () => {
        onZoomToFit();
        onClose();
      },
      shortcut: "Z",
    },
    {
      icon: "📍",
      label: "Copy Coordinates",
      onClick: () => {
        onCopyCoordinates();
        onClose();
      },
      shortcut: "C",
    },
    {
      icon: "📁",
      label: "Copy to Existing Layer",
      onClick: () => {
        if (showCopySubmenu !== "existing") {
          loadLayers();
          setShowCopySubmenu("existing");
        } else {
          setShowCopySubmenu(null);
        }
      },
      submenu: true,
    },
    {
      icon: "➕",
      label: "Copy to New Layer",
      onClick: () => {
        if (showCopySubmenu !== "new") {
          setShowCopySubmenu("new");
          setNewLayerName("");
        } else {
          setShowCopySubmenu(null);
        }
      },
      submenu: true,
    },
    { type: "divider" },
    {
      icon: "🗑️",
      label: "Delete Zone",
      onClick: () => {
        onDeleteZone();
        onClose();
      },
      shortcut: "Del",
      danger: true,
    },
  ];

  return (
    <div
      className="zone-context-menu fixed z-[10000] bg-zinc-900 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[250px]"
      style={{ left: `${x}px`, top: `${y}px` }}
      suppressHydrationWarning={true}
    >
      <div className="px-3 py-2 border-b border-white/10">
        <div className="text-xs text-white/50">Zone Action</div>
        <div className="text-sm font-medium text-white truncate">{zoneName}</div>
      </div>

      <div className="py-1">
        {menuItems.map((item, index) => {
          if ("type" in item && item.type === "divider") {
            return <div key={`divider-${index}`} className="my-1 border-t border-white/10" />;
          }

          const isSubmenuOpen = 
            (item.label === "Copy to Existing Layer" && showCopySubmenu === "existing") ||
            (item.label === "Copy to New Layer" && showCopySubmenu === "new");

          return (
            <div key={index}>
              <button
                onClick={item.onClick}
                className={`
                  w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-3
                  transition-colors
                  ${item.danger ? "text-red-400 hover:bg-red-500/10" : "text-white hover:bg-white/10"}
                  ${isSubmenuOpen ? "bg-white/5" : ""}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.submenu && (
                  <span className="text-xs text-white/40">
                    {isSubmenuOpen ? "▼" : "▶"}
                  </span>
                )}
                {item.shortcut && !item.submenu && <span className="text-xs text-white/40">{item.shortcut}</span>}
              </button>

              {/* Submenu for Copy to Existing Layer */}
              {isSubmenuOpen && item.label === "Copy to Existing Layer" && (
                <div className="bg-white/5 border-t border-white/5 px-2 py-2">
                  {loadingLayers ? (
                    <div className="text-xs text-white/50 px-2 py-2">Loading layers...</div>
                  ) : layers.length === 0 ? (
                    <div className="text-xs text-white/50 px-2 py-2">No other layers available</div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {layers.map((layer) => (
                        <button
                          key={layer.layerId}
                          onClick={() => handleCopyToExisting(layer.layerId)}
                          disabled={copying}
                          className="w-full px-2 py-1.5 text-left text-xs rounded transition-colors text-white/80 hover:bg-emerald-500/20 hover:text-white disabled:opacity-50"
                        >
                          <div className="font-medium truncate">{layer.layerName}</div>
                          <div className="text-white/50 text-xs">{layer.featureCount} features</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submenu for Copy to New Layer */}
              {isSubmenuOpen && item.label === "Copy to New Layer" && (
                <div className="bg-white/5 border-t border-white/5 px-2 py-2">
                  <input
                    type="text"
                    value={newLayerName}
                    onChange={(e) => setNewLayerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newLayerName.trim()) {
                        handleCopyToNew();
                      }
                    }}
                    placeholder="Layer name..."
                    autoFocus
                    disabled={copying}
                    className="w-full px-2 py-1.5 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                  />
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => setShowCopySubmenu(null)}
                      disabled={copying}
                      className="flex-1 px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/80 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCopyToNew}
                      disabled={copying || !newLayerName.trim()}
                      className="flex-1 px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {copying ? "..." : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


interface LayerPickerDialogProps {
  visible: boolean;
  layers: Array<{ id: string; name: string }>;
  currentLayerId: string;
  onSelect: (layerId: string) => void;
  onClose: () => void;
}

export function LayerPickerDialog({
  visible,
  layers,
  currentLayerId,
  onSelect,
  onClose,
}: LayerPickerDialogProps) {
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visible, onClose]);

  if (!visible) return null;

  const availableLayers = layers.filter((l) => l.id !== currentLayerId);

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-lg shadow-2xl w-96 max-h-[600px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        suppressHydrationWarning={true}
      >
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Copy to Layer</h3>
          <p className="text-sm text-white/60 mt-1">Select destination layer</p>
        </div>

        <div className="p-2 max-h-[400px] overflow-y-auto">
          {availableLayers.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              <p>No other layers available</p>
              <p className="text-xs mt-2">Create a new layer first</p>
            </div>
          ) : (
            availableLayers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => setSelectedLayerId(layer.id)}
                className={`w-full px-3 py-2 text-left rounded-md transition-colors ${
                  selectedLayerId === layer.id
                    ? "bg-emerald-500/20 border border-emerald-500/50 text-white"
                    : "hover:bg-white/5 text-white/80"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      selectedLayerId === layer.id ? "bg-emerald-500" : "bg-white/20"
                    }`}
                  />
                  <span className="font-medium">{layer.name}</span>
                </div>
                <div className="text-xs text-white/40 mt-1 ml-4">
                  Layer ID: {layer.id.slice(0, 8)}...
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedLayerId) {
                onSelect(selectedLayerId);
                onClose();
              }
            }}
            disabled={!selectedLayerId}
            className="px-4 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
