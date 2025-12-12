import { useCallback, useRef, useState } from "react";
import type { Layer, LayerStyle, PathLayer, LayerWithOptions } from "@/types";

/**
 * Custom hook to manage layer styles for hover, selection, and multi-selection
 */
export function useLayerStyles() {
  const originalStylesRef = useRef<Map<Layer, LayerStyle>>(new Map());
  const [hoveredLayer, setHoveredLayer] = useState<Layer | null>(null);
  const [currentLayer, setCurrentLayer] = useState<Layer | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<Set<Layer>>(new Set());

  /**
   * Store original style of a layer before applying hover or selection styles
   */
  const storeOriginalStyle = useCallback((layer: Layer) => {
    if (originalStylesRef.current.has(layer)) return;

    const style: LayerStyle = {};
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      // Check if layer has options property at runtime
      const unknownLayer = layer as unknown;
      const hasOptions = (
        unknownLayer !== null &&
        typeof unknownLayer === 'object' &&
        'options' in unknownLayer &&
        typeof (unknownLayer as { options: unknown }).options === 'object'
      );

      if (hasOptions) {
        const layerWithOptions = unknownLayer as LayerWithOptions;
        const options = layerWithOptions.options || {};
        style.color = options.color || '#3388ff';
        style.weight = options.weight || 3;
        style.opacity = options.opacity || 1.0;
        style.fillColor = options.fillColor || options.color || '#3388ff';
        style.fillOpacity = options.fillOpacity || 0.2;
        style.dashArray = options.dashArray || '';
      } else {
        // Default style for layers without options
        style.color = '#3388ff';
        style.weight = 3;
        style.opacity = 1.0;
        style.fillColor = '#3388ff';
        style.fillOpacity = 0.2;
        style.dashArray = '';
      }
    }
    originalStylesRef.current.set(layer, style);
  }, []);

  /**
   * Apply hover highlight style to a layer
   * Note: Keeps original colors to prevent color changes on hover
   */
  const applyHoverStyle = useCallback((layer: Layer) => {
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      // Get original style to preserve colors
      const originalStyle = originalStylesRef.current.get(layer);
      
      if (originalStyle) {
        // Apply hover style while preserving original colors
        (layer as unknown as PathLayer).setStyle({
          color: originalStyle.color,
          fillColor: originalStyle.fillColor,
          opacity: originalStyle.opacity,
          weight: originalStyle.weight || 3, // Keep original weight, don't change
          dashArray: originalStyle.dashArray || '',
          fillOpacity: originalStyle.fillOpacity || 0.2 // Keep original fillOpacity
        });
      }
      // If no original style stored, don't apply any changes

      // Bring to front
      const pathLayer = layer as unknown as PathLayer;
      if ('bringToFront' in layer && pathLayer.bringToFront) {
        pathLayer.bringToFront();
      }
    }
  }, []);

  /**
   * Reset layer to its original style
   */
  const resetToOriginalStyle = useCallback((layer: Layer) => {
    // Skip Markers - they don't use path styles and should keep their icon
    // Check if it's a Marker by checking for the marker-specific methods
    if ('getIcon' in layer && 'setIcon' in layer) {
      // It's a Marker, don't reset style
      return;
    }

    const originalStyle = originalStylesRef.current.get(layer);

    // For PathLayers (Polygon, Line, Circle, etc.)
    if (originalStyle && 'setStyle' in layer && typeof layer.setStyle === 'function') {
      (layer as unknown as PathLayer).setStyle(originalStyle);
    }
  }, []);

  /**
   * Apply selection style to a single selected layer
   * Preserves original weight for thick lines (freehand drawings)
   */
  const applySelectionStyle = useCallback((layer: Layer) => {
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      // Get original style to preserve weight for thick lines
      const originalStyle = originalStylesRef.current.get(layer);
      const originalWeight = originalStyle?.weight || 3;
      
      // For thick lines (freehand drawings), preserve weight and just add selection indicator
      // For normal lines, use standard selection weight
      const selectionWeight = originalWeight > 10 ? originalWeight : Math.max(originalWeight + 1, 4);
      
      (layer as unknown as PathLayer).setStyle({
        color: '#ff6600',
        weight: selectionWeight,
        fillOpacity: 0.5
      });
    }
  }, []);

  /**
   * Apply multi-selection style to a layer
   * Preserves original weight for thick lines (freehand drawings)
   */
  const applyMultiSelectionStyle = useCallback((layer: Layer) => {
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      // Get original style to preserve weight for thick lines
      const originalStyle = originalStylesRef.current.get(layer);
      const originalWeight = originalStyle?.weight || 3;
      
      // For thick lines (freehand drawings), preserve weight
      const selectionWeight = originalWeight > 10 ? originalWeight : Math.max(originalWeight + 1, 4);
      
      (layer as unknown as PathLayer).setStyle({
        color: '#ff0000',
        weight: selectionWeight,
        fillOpacity: 0.5
      });
    }
  }, []);

  /**
   * Handle layer hover (enter/leave)
   * Note: No style changes on hover to preserve original colors
   */
  const handleLayerHover = useCallback((layer: Layer | null, isEntering: boolean) => {
    if (!layer) return;

    if (isEntering) {
      // Store original style but don't apply any hover style changes
      // This ensures colors remain unchanged
      if (!selectedLayers.has(layer)) {
        storeOriginalStyle(layer);
        // Don't apply hover style - keep original colors
      }
      setHoveredLayer(layer);
      
      // Only bring to front without changing style
      if ('bringToFront' in layer && typeof (layer as any).bringToFront === 'function') {
        (layer as any).bringToFront();
      }
    } else {
      // No need to reset since we didn't change anything
      setHoveredLayer(null);
    }
  }, [selectedLayers, storeOriginalStyle]);

  /**
   * Reset all layer selections
   */
  const resetAllSelections = useCallback(() => {
    selectedLayers.forEach(layer => {
      resetToOriginalStyle(layer);
    });
    setSelectedLayers(new Set());
    setCurrentLayer(null);
  }, [selectedLayers, resetToOriginalStyle]);

  return {
    // State
    hoveredLayer,
    currentLayer,
    selectedLayers,
    originalStylesRef,

    // Setters
    setCurrentLayer,
    setSelectedLayers,

    // Methods
    storeOriginalStyle,
    applyHoverStyle,
    resetToOriginalStyle,
    applySelectionStyle,
    applyMultiSelectionStyle,
    handleLayerHover,
    resetAllSelections,
  };
}
