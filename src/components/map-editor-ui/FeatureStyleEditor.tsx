"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { FeatureData } from "@/utils/mapUtils";
import { extractLayerStyle, applyLayerStyle } from "@/utils/mapUtils";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

interface FeatureStyleEditorProps {
  feature: FeatureData;
  onUpdate: (updates: {
    name?: string;
    description?: string;
    style?: Record<string, unknown>;
    properties?: Record<string, unknown>;
    isVisible?: boolean;
    zIndex?: number;
  }) => Promise<void>;
}

export function FeatureStyleEditor({ feature, onUpdate }: FeatureStyleEditorProps) {
  const [name, setName] = useState(feature.name);
  const [description, setDescription] = useState("");
  const [isVisible, setIsVisible] = useState(feature.isVisible);
  const [zIndex, setZIndex] = useState(0);

  // Style properties
  const [color, setColor] = useState("#3388ff");
  const [fillColor, setFillColor] = useState("#3388ff");
  const [opacity, setOpacity] = useState(1);
  const [fillOpacity, setFillOpacity] = useState(0.2);
  const [weight, setWeight] = useState(3);
  const [radius, setRadius] = useState(10);
  const [dashArray, setDashArray] = useState("");

  // Custom attributes
  const [customAttributes, setCustomAttributes] = useState<Record<string, string>>({});
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");

  const [activeTab, setActiveTab] = useState<"style" | "attributes">("style");
  
  // Refs for debouncing and tracking feature changes
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasChangesRef = useRef(false);
  const currentFeatureIdRef = useRef<string | undefined>(undefined);
  const isLoadingInitialValuesRef = useRef(false);
  const isReadyForAutoSaveRef = useRef(false); // Prevents premature autosave

  // Load initial values from feature when feature changes
  useEffect(() => {
    // Check if this is a new feature
    const isNewFeature = currentFeatureIdRef.current !== feature.featureId;

    if (isNewFeature) {
      currentFeatureIdRef.current = feature.featureId;
      isLoadingInitialValuesRef.current = true;
      isReadyForAutoSaveRef.current = false; // Block autosave until initial load completes
      hasChangesRef.current = false;

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    }

    // Load description from feature (separate field, not in properties)
    if (feature.description !== undefined && feature.description !== null) {
      setDescription(String(feature.description));
    } else {
      setDescription("");
    }

    if (feature.layer) {
      const style = extractLayerStyle(feature.layer);

      if (style.color) setColor(style.color as string);
      if (style.fillColor) setFillColor(style.fillColor as string);
      if (style.opacity !== undefined) setOpacity(style.opacity as number);
      if (style.fillOpacity !== undefined) setFillOpacity(style.fillOpacity as number);
      if (style.weight !== undefined) setWeight(style.weight as number);
      if (style.radius !== undefined) setRadius(style.radius as number);
      if (style.dashArray) setDashArray(style.dashArray as string);

      // Load properties (custom attributes only, NOT description)
      // Properties come from layer.feature.properties which is already parsed
      if (feature.layer.feature?.properties) {
        const props = feature.layer.feature.properties;
        const customProps: Record<string, string> = {};

        // If props is a string (shouldn't happen but handle it), try to parse
        let parsedProps = props;
        if (typeof props === 'string') {
          try {
            parsedProps = JSON.parse(props);
          } catch (e) {
            console.warn('Failed to parse properties string:', e);
            parsedProps = {};
          }
        }

        Object.keys(parsedProps).forEach((key) => {
          // Exclude standard fields - description should NOT be in properties
          if (!["name", "description", "zIndex"].includes(key)) {
            customProps[key] = String(parsedProps[key]);
          }
        });
        setCustomAttributes(customProps);

        // Only load zIndex from properties
        if (parsedProps.zIndex) setZIndex(Number(parsedProps.zIndex));
      }
    }

    // After loading values, reset the loading flag after a safe delay
    // Using 500ms to ensure all React state updates have completed and settled
    if (isNewFeature) {
      setTimeout(() => {
        isLoadingInitialValuesRef.current = false;
        isReadyForAutoSaveRef.current = true;
      }, 500);
    }
  }, [feature]);

  // Apply style to layer in real-time
  const applyStyleRealtime = useCallback(() => {
    if (!feature.layer) return;

    const style: Record<string, unknown> = {
      color,
      fillColor,
      opacity,
      fillOpacity,
      weight,
    };

    if (feature.type === "Circle" || feature.type === "CircleMarker") {
      style.radius = radius;
    }

    if (dashArray) {
      style.dashArray = dashArray;
    }

    // Apply style immediately to the layer for visual feedback
    applyLayerStyle(feature.layer, style);
  }, [feature.layer, feature.type, color, fillColor, opacity, fillOpacity, weight, radius, dashArray]);

  // Auto-save function with debouncing
  const autoSave = useCallback(async () => {
    if (!hasChangesRef.current) {
      return;
    }

    hasChangesRef.current = false;

    try {
      const style: Record<string, unknown> = {
        color,
        fillColor,
        opacity,
        fillOpacity,
        weight,
      };

      if (feature.type === "Circle" || feature.type === "CircleMarker") {
        style.radius = radius;
      }

      if (dashArray) {
        style.dashArray = dashArray;
      }

      // Properties should NOT include description - it's a separate field
      const properties = {
        ...customAttributes,
        // Do NOT include description here - it's sent separately
      };

      const updates = {
        name,
        description,
        style,
        properties,
        isVisible,
        zIndex,
      };

      await onUpdate(updates);
    } catch (error) {
      console.error("[FeatureStyleEditor] Failed to auto-save feature:", error);
    }
  }, [name, description, color, fillColor, opacity, fillOpacity, weight, radius, dashArray, customAttributes, isVisible, zIndex, feature.type, feature.featureId, onUpdate]);

  // Debounced auto-save
  useEffect(() => {
    // Skip auto-save if loading initial values or not ready yet
    if (isLoadingInitialValuesRef.current) {
      return;
    }

    if (!isReadyForAutoSaveRef.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Mark that we have changes
    hasChangesRef.current = true;

    // Apply style in real-time immediately
    applyStyleRealtime();

    // Set new timeout for auto-save (2s delay)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [color, fillColor, opacity, fillOpacity, weight, radius, dashArray, name, description, isVisible, zIndex, applyStyleRealtime, autoSave]);

  // Auto-save when attributes change
  useEffect(() => {
    // Skip auto-save if loading initial values or not ready yet
    if (isLoadingInitialValuesRef.current) {
      return;
    }

    if (!isReadyForAutoSaveRef.current) {
      return;
    }

    if (Object.keys(customAttributes).length > 0) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      hasChangesRef.current = true;
      saveTimeoutRef.current = setTimeout(() => {
        autoSave();
      }, 2000);

      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }
  }, [customAttributes, autoSave]);

  const handleAddAttribute = () => {
    if (newAttrKey && newAttrValue) {
      setCustomAttributes((prev) => ({
        ...prev,
        [newAttrKey]: newAttrValue,
      }));
      setNewAttrKey("");
      setNewAttrValue("");
    }
  };

  const handleRemoveAttribute = (key: string) => {
    setCustomAttributes((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  // Line is used by freehand drawings (Marker/Highlighter tools)
  const supportsColor = ["Polyline", "Line", "Polygon", "Rectangle", "Circle", "CircleMarker"].includes(feature.type);
  const supportsFill = ["Polygon", "Rectangle", "Circle", "CircleMarker"].includes(feature.type);
  const supportsRadius = ["Circle", "CircleMarker"].includes(feature.type);

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-3">Thông tin cơ bản</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tên</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder="Tên feature"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none resize-none transition-colors"
              placeholder="Mô tả tùy chọn"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
              />
              <span>Hiển thị</span>
            </label>

            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-zinc-400">Z-Index:</label>
              <input
                type="number"
                value={zIndex}
                onChange={(e) => setZIndex(Number(e.target.value))}
                className="w-20 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-zinc-800 pt-4">
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setActiveTab("style")}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
              activeTab === "style"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Icon icon="mdi:palette" className="w-4 h-4 inline mr-1" />
            Style
          </button>
          <button
            onClick={() => setActiveTab("attributes")}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
              activeTab === "attributes"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Icon icon="mdi:tag-multiple" className="w-4 h-4 inline mr-1" />
            Thuộc tính
          </button>
        </div>

        {/* Style Tab */}
        {activeTab === "style" && (
          <div className="space-y-4">

            {supportsColor && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Màu viền</label>
                  <div className="flex items-center gap-2">
                    <div className="relative w-9 h-9 flex-shrink-0">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="Chọn màu viền"
                      />
                      <div
                        className="absolute inset-0 rounded-lg border-2 border-zinc-600 hover:border-emerald-500 transition-all pointer-events-none shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
                      placeholder="#3388ff"
                    />
                  </div>
                </div>

                <br/>
                
                {supportsFill && (
                  <div>
                    <label className="text-xs text-zinc-400 mb-1.5 block">Màu nền</label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-9 h-9 flex-shrink-0">
                        <input
                          type="color"
                          value={fillColor}
                          onChange={(e) => setFillColor(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Chọn màu nền"
                        />
                        <div
                          className="absolute inset-0 rounded-lg border-2 border-zinc-600 hover:border-emerald-500 transition-all pointer-events-none shadow-sm"
                          style={{ backgroundColor: fillColor }}
                        />
                      </div>
                      <input
                        type="text"
                        value={fillColor}
                        onChange={(e) => setFillColor(e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
                        placeholder="#3388ff"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block flex items-center justify-between">
                  <span>Độ trong suốt viền</span>
                  <span className="text-emerald-400 font-medium">{Math.round(opacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  style={{
                    background: `linear-gradient(to right, rgb(16 185 129) 0%, rgb(16 185 129) ${opacity * 100}%, rgb(63 63 70) ${opacity * 100}%, rgb(63 63 70) 100%)`
                  }}
                />
              </div>

              {supportsFill && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block flex items-center justify-between">
                    <span>Độ trong suốt nền</span>
                    <span className="text-emerald-400 font-medium">{Math.round(fillOpacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={fillOpacity}
                    onChange={(e) => setFillOpacity(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    style={{
                      background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${fillOpacity * 100}%, rgb(63 63 70) ${fillOpacity * 100}%, rgb(63 63 70) 100%)`
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Độ dày viền (px)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              {supportsRadius && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Bán kính (m)</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Hide dashArray for freehand drawings (Line type = Marker/Highlighter) */}
            {feature.type !== "Line" && (
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">
                  Kiểu đường viền
                </label>
                <select
                  value={dashArray}
                  onChange={(e) => setDashArray(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="">Nét liền</option>
                  <option value="5, 5">Nét đứt</option>
                  <option value="2, 4">Nét chấm</option>
                  <option value="10, 5, 2, 5">Nét gạch-chấm</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Attributes Tab */}
        {activeTab === "attributes" && (
          <div className="space-y-3">
            <div className="text-xs text-zinc-500 italic mb-2">
              Thuộc tính sẽ tự động lưu khi bạn thêm hoặc xóa
            </div>

            <h4 className="text-sm font-medium text-zinc-300">Thuộc tính tùy chỉnh</h4>

            {/* Existing attributes */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(customAttributes).length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Chưa có thuộc tính tùy chỉnh.</p>
              ) : (
                Object.entries(customAttributes).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 bg-zinc-800 rounded p-2 hover:bg-zinc-750 transition-colors">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <span className="text-xs text-zinc-400 font-medium truncate">{key}</span>
                      <span className="text-xs text-zinc-200 truncate">{value}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveAttribute(key)}
                      className="p-1 hover:bg-zinc-700 rounded transition-colors"
                      title="Xóa thuộc tính"
                    >
                      <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add new attribute */}
            <div className="border-t border-zinc-800 pt-3 mt-3">
              <p className="text-xs text-zinc-400 mb-2">Thêm thuộc tính mới</p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newAttrKey}
                  onChange={(e) => setNewAttrKey(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="Tên (vd: category, owner, notes)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newAttrKey && newAttrValue) {
                      e.preventDefault();
                      handleAddAttribute();
                    }
                  }}
                />
                <input
                  type="text"
                  value={newAttrValue}
                  onChange={(e) => setNewAttrValue(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="Giá trị"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newAttrKey && newAttrValue) {
                      e.preventDefault();
                      handleAddAttribute();
                    }
                  }}
                />
                <button
                  onClick={handleAddAttribute}
                  disabled={!newAttrKey || !newAttrValue}
                  className="w-full px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors flex items-center justify-center gap-2"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  Thêm thuộc tính
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
