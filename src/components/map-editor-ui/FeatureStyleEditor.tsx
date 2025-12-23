"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { FeatureData } from "@/utils/mapUtils";
import { extractLayerStyle, applyLayerStyle } from "@/utils/mapUtils";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";

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
  onChangeStatus?: (hasChanges: boolean) => void;
  onSaveReady?: (saveFn: () => Promise<void>) => void;
}

export function FeatureStyleEditor({ feature, onUpdate, onChangeStatus, onSaveReady }: FeatureStyleEditorProps) {
  const { t } = useI18n();
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

  // Refs for tracking feature changes
  const currentFeatureIdRef = useRef<string | undefined>(undefined);
  const isLoadingInitialValuesRef = useRef(false);

  // Load initial values from feature when feature changes
  useEffect(() => {
    // Check if this is a new feature
    const isNewFeature = currentFeatureIdRef.current !== feature.featureId;

    if (isNewFeature) {
      currentFeatureIdRef.current = feature.featureId;
      isLoadingInitialValuesRef.current = true;
      onChangeStatus?.(false);
    }

    // Load name from feature
    setName(feature.name);

    // Load description from feature (separate field, not in properties)
    if (feature.description !== undefined && feature.description !== null) {
      setDescription(String(feature.description));
    } else {
      setDescription("");
    }

    // Load isVisible from feature
    setIsVisible(feature.isVisible);

    // Reset to defaults first
    setZIndex(0);
    setCustomAttributes({});
    setColor("#3388ff");
    setFillColor("#3388ff");
    setOpacity(1);
    setFillOpacity(0.2);
    setWeight(3);
    setRadius(10);
    setDashArray("");
    setNewAttrKey("");
    setNewAttrValue("");
    setActiveTab("style");

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
      }, 500);
    }
  }, [feature, onChangeStatus]);

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

  // Manual save function
  const handleSave = useCallback(async () => {
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
      onChangeStatus?.(false);
    } catch (error) {
      console.error("[FeatureStyleEditor] Failed to save feature:", error);
    }
  }, [name, description, color, fillColor, opacity, fillOpacity, weight, radius, dashArray, customAttributes, isVisible, zIndex, feature.type, onUpdate, onChangeStatus]);

  // Track changes for real-time preview
  useEffect(() => {
    // Skip if loading initial values
    if (isLoadingInitialValuesRef.current) {
      return;
    }

    // Mark that we have changes
    onChangeStatus?.(true);

    // Apply style in real-time immediately for visual feedback
    applyStyleRealtime();
  }, [color, fillColor, opacity, fillOpacity, weight, radius, dashArray, name, description, isVisible, zIndex, applyStyleRealtime, onChangeStatus]);

  // Track changes when attributes change
  useEffect(() => {
    // Skip if loading initial values
    if (isLoadingInitialValuesRef.current) {
      return;
    }

    onChangeStatus?.(true);
  }, [customAttributes, onChangeStatus]);

  // Provide save function to parent
  useEffect(() => {
    if (onSaveReady) {
      onSaveReady(handleSave);
    }
  }, [handleSave, onSaveReady]);

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
        <h4 className="text-sm font-medium text-zinc-300 mb-3">{t('mapEditor', 'featureStyleBasicInfo')}</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">{t('mapEditor', 'featureStyleName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
              placeholder={t('mapEditor', 'featureStyleNamePlaceholder')}
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">{t('mapEditor', 'featureStyleDescription')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none resize-none transition-colors"
              placeholder={t('mapEditor', 'featureStyleDescriptionPlaceholder')}
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
              <span>{t('mapEditor', 'featureStyleVisible')}</span>
            </label>

            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs text-zinc-400">{t('mapEditor', 'featureStyleZIndex')}</label>
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
            {t('mapEditor', 'featureStyleTabStyle')}
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
            {t('mapEditor', 'featureStyleTabAttributes')}
          </button>
        </div>

        {/* Style Tab */}
        {activeTab === "style" && (
          <div className="space-y-4">

            {supportsColor && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">{t('mapEditor', 'featureStyleBorderColor')}</label>
                  <div className="flex items-center gap-2">
                    <div className="relative w-9 h-9 flex-shrink-0">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title={t('mapEditor', 'featureStyleSelectBorderColor')}
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
                    <label className="text-xs text-zinc-400 mb-1.5 block">{t('mapEditor', 'featureStyleFillColor')}</label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-9 h-9 flex-shrink-0">
                        <input
                          type="color"
                          value={fillColor}
                          onChange={(e) => setFillColor(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title={t('mapEditor', 'featureStyleSelectFillColor')}
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
                  <span>{t('mapEditor', 'featureStyleBorderOpacity')}</span>
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
                    <span>{t('mapEditor', 'featureStyleFillOpacity')}</span>
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
                <label className="text-xs text-zinc-400 mb-1.5 block">{t('mapEditor', 'featureStyleBorderWidth')}</label>
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
                  <label className="text-xs text-zinc-400 mb-1.5 block">{t('mapEditor', 'featureStyleRadius')}</label>
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
                  {t('mapEditor', 'featureStyleBorderStyle')}
                </label>
                <select
                  value={dashArray}
                  onChange={(e) => setDashArray(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="">{t('mapEditor', 'featureStyleBorderStyleSolid')}</option>
                  <option value="5, 5">{t('mapEditor', 'featureStyleBorderStyleDashed')}</option>
                  <option value="2, 4">{t('mapEditor', 'featureStyleBorderStyleDotted')}</option>
                  <option value="10, 5, 2, 5">{t('mapEditor', 'featureStyleBorderStyleDashDot')}</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Attributes Tab */}
        {activeTab === "attributes" && (
          <div className="space-y-3">

            <h4 className="text-sm font-medium text-zinc-300">{t('mapEditor', 'featureStyleCustomAttributes')}</h4>

            {/* Existing attributes */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(customAttributes).length === 0 ? (
                <p className="text-xs text-zinc-500 italic">{t('mapEditor', 'featureStyleNoAttributes')}</p>
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
                      title={t('mapEditor', 'featureStyleRemoveAttribute')}
                    >
                      <Icon icon="mdi:close" className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add new attribute */}
            <div className="border-t border-zinc-800 pt-3 mt-3">
              <p className="text-xs text-zinc-400 mb-2">{t('mapEditor', 'featureStyleAddAttributeTitle')}</p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newAttrKey}
                  onChange={(e) => setNewAttrKey(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder={t('mapEditor', 'featureStyleAttributeNamePlaceholder')}
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
                  placeholder={t('mapEditor', 'featureStyleAttributeValuePlaceholder')}
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
                  {t('mapEditor', 'featureStyleAddAttributeButton')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
