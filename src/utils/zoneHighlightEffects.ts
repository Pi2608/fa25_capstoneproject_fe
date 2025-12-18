import type L from "leaflet";

export interface HighlightOptions {
  enabled: boolean;
  color?: string;
  intensity?: "low" | "medium" | "high";
  pulseSpeed?: number;
}

export function applyZoneHighlight(
  layer: any,
  options: HighlightOptions = { enabled: false }
): void {
  if (!options.enabled || !layer) return;

  const intensity = options.intensity || "medium";
  const pulseSpeed = options.pulseSpeed || 2000;

  // Get current style
  const currentStyle = layer.options || {};

  // IMPORTANT: Use zone's existing color for glow, or fallback to options.color
  const baseColor = currentStyle.color || currentStyle.fillColor || options.color || "#10b981";

  try {
    // Create pulsing effect using CSS animations
    const layerElement = layer.getElement?.();

    if (layerElement) {
      // Add pulsing animation via CSS class
      layerElement.classList.add("zone-highlight-pulse");

      // Apply inline styles for glow effect using zone's own color
      const intensityMap = {
        low: { opacity: 0.4, glowSize: "5px", strokeWidth: 1 },
        medium: { opacity: 0.6, glowSize: "10px", strokeWidth: 2 },
        high: { opacity: 0.8, glowSize: "15px", strokeWidth: 3 },
      };

      const settings = intensityMap[intensity];

      // Use zone's own color for glow effect
      layerElement.style.filter = `drop-shadow(0 0 ${settings.glowSize} ${baseColor}) drop-shadow(0 0 ${settings.glowSize} ${baseColor})`;
      layerElement.style.animation = `zonePulse ${pulseSpeed}ms ease-in-out infinite`;
    }

    // Apply highlight style to layer - enhance existing style WITHOUT changing colors
    const currentWeight = currentStyle.weight || 2;
    const currentOpacity = currentStyle.opacity !== undefined ? currentStyle.opacity : 1;
    const currentFillOpacity = currentStyle.fillOpacity !== undefined ? currentStyle.fillOpacity : 0.3;

    layer.setStyle?.({
      ...currentStyle,
      weight: currentWeight + 1, // Slightly thicker border
      opacity: Math.min(currentOpacity + 0.2, 1), // Increase opacity
      fillOpacity: Math.min(currentFillOpacity + 0.1, 0.5), // Slightly more visible fill
    });

    // Store highlight state
    (layer as any)._isHighlighted = true;
    (layer as any)._originalStyle = currentStyle;
  } catch (error) {
    console.warn("Failed to apply zone highlight:", error);
  }
}

export function removeZoneHighlight(layer: any): void {
  if (!layer || !(layer as any)._isHighlighted) return;

  try {
    const layerElement = layer.getElement?.();

    if (layerElement) {
      layerElement.classList.remove("zone-highlight-pulse");
      layerElement.style.filter = "";
      layerElement.style.animation = "";
    }

    // Restore original style
    const originalStyle = (layer as any)._originalStyle || {};
    layer.setStyle?.(originalStyle);

    (layer as any)._isHighlighted = false;
    delete (layer as any)._originalStyle;
  } catch (error) {
    console.warn("Failed to remove zone highlight:", error);
  }
}

export function applyLayerHighlight(
  geoJsonLayer: any,
  options: HighlightOptions = { enabled: false }
): void {
  if (!options.enabled || !geoJsonLayer) return;

  // Apply to all sub-layers/features if it's a FeatureCollection
  if (geoJsonLayer.eachLayer) {
    geoJsonLayer.eachLayer((subLayer: any) => {
      // Each feature in the layer gets highlighted with its own color
      applyZoneHighlight(subLayer, {
        ...options,
        // Don't override color - let applyZoneHighlight extract from feature style
        color: undefined,
      });
    });
  } else {
    // Single layer/feature
    applyZoneHighlight(geoJsonLayer, options);
  }

  // Mark layer as highlighted
  (geoJsonLayer as any)._isHighlighted = true;
}

export function removeLayerHighlight(geoJsonLayer: any): void {
  if (!geoJsonLayer || !(geoJsonLayer as any)._isHighlighted) return;

  // Remove from all sub-layers if it's a FeatureCollection
  if (geoJsonLayer.eachLayer) {
    geoJsonLayer.eachLayer((subLayer: any) => {
      removeZoneHighlight(subLayer);
    });
  } else {
    removeZoneHighlight(geoJsonLayer);
  }

  (geoJsonLayer as any)._isHighlighted = false;
}

export function applyBorderGlow(layer: any, color: string = "#10b981", intensity: number = 1): void {
  if (!layer) return;

  try {
    const currentStyle = layer.options || {};

    layer.setStyle?.({
      ...currentStyle,
      color: color,
      weight: Math.max((currentStyle.weight || 2) * intensity, 4),
      opacity: 1,
      className: "zone-border-glow",
    });

    // Add glow shadow
    const layerElement = layer.getElement?.();
    if (layerElement) {
      layerElement.style.filter = `drop-shadow(0 0 ${10 * intensity}px ${color})`;
    }
  } catch (error) {
    console.warn("Failed to apply border glow:", error);
  }
}

export function injectZoneHighlightStyles(): void {
  if (typeof document === "undefined") return;

  // Check if styles already injected
  if (document.getElementById("zone-highlight-styles")) return;

  const styleSheet = document.createElement("style");
  styleSheet.id = "zone-highlight-styles";
  styleSheet.textContent = `
    @keyframes zonePulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.7;
        transform: scale(1.02);
      }
    }

    @keyframes zoneGlow {
      0%, 100% {
        filter: drop-shadow(0 0 5px currentColor);
      }
      50% {
        filter: drop-shadow(0 0 15px currentColor) drop-shadow(0 0 25px currentColor);
      }
    }

    .zone-highlight-pulse {
      animation: zonePulse 2s ease-in-out infinite;
    }

    .zone-border-glow {
      animation: zoneGlow 2s ease-in-out infinite;
    }

    /* Highlight for zone labels */
    .zone-label-highlight {
      animation: zonePulse 2s ease-in-out infinite;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.6), 0 0 20px rgba(16, 185, 129, 0.4);
    }
  `;

  document.head.appendChild(styleSheet);
}
