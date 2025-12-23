import type { MapWithPM } from "@/types";
import type { LatLng, Polyline, Polygon, LeafletMouseEvent, PathOptions } from "leaflet";

// Store for freehand drawing state
let isFreehandDrawing = false;
let freehandPoints: LatLng[] = [];
let freehandLayer: Polyline | Polygon | null = null;
let freehandMode: "marker" | "highlighter" | "polygon" = "marker";
let L: typeof import("leaflet") | null = null;

/**
 * Enable drawing mode for a specific shape on the map
 */
export async function enableDraw(
  mapRef: React.MutableRefObject<MapWithPM | null>,
  shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text" | "FreehandMarker" | "FreehandHighlighter"
) {
  // Map Geoman shapes to GeometryTypeEnum:
  // Marker/CircleMarker -> Point (GeometryTypeEnum.Point = 0)
  // Line -> LineString (GeometryTypeEnum.LineString = 1)
  // Polygon -> Polygon (GeometryTypeEnum.Polygon = 2)
  // Circle (large) -> Circle (GeometryTypeEnum.Circle = 3)
  // Rectangle -> Rectangle (GeometryTypeEnum.Rectangle = 4)
  // FreehandMarker -> Freehand black line (custom implementation)
  // FreehandHighlighter -> Freehand yellow highlighter line (custom implementation)
  if (shape === "FreehandMarker") {
    // Enable custom freehand marker drawing (black, thin)
    enableCustomFreehand(mapRef, "marker");
  } else if (shape === "FreehandHighlighter") {
    // Enable custom freehand highlighter drawing (yellow, thick)
    enableCustomFreehand(mapRef, "highlighter");
  } else if (shape === "Marker") {
    // For Marker, use CircleMarker instead to match loaded features
    if (!L) {
      L = (await import("leaflet")).default;
    }

    // Configure Geoman to use CircleMarker instead of Marker
    // This ensures consistent styling with loaded features
    mapRef.current?.pm.enableDraw("CircleMarker", {
      cursorMarker: false, // Disable cursor marker (no icon following mouse)
      pathOptions: {
        radius: 6,
        color: '#3388ff',
        fillColor: '#3388ff', // Blue fill instead of white
        fillOpacity: 1,
        weight: 2,
        opacity: 1
      }
    });
  } else {
    mapRef.current?.pm.enableDraw(shape);
  }
}

/**
 * Enable freehand polygon drawing mode for area highlighting
 * Note: Geoman Free doesn't support freehand, so we implement our own
 */
export function enableFreehandPolygon(mapRef: React.MutableRefObject<MapWithPM | null>) {
  enableCustomFreehand(mapRef, "polygon");
}

/**
 * Custom freehand drawing implementation
 * Since Geoman Free doesn't support freehand, we implement it manually
 * @param type - "marker" for black thin line, "highlighter" for yellow thick line, "polygon" for filled area
 */
async function enableCustomFreehand(
  mapRef: React.MutableRefObject<MapWithPM | null>,
  mode: "marker" | "highlighter" | "polygon"
) {
  const map = mapRef.current;
  if (!map) return;

  // Dynamically import Leaflet
  if (!L) {
    L = (await import("leaflet")).default;
  }

  // Disable any existing Geoman drawing mode
  map.pm.disableDraw();

  // Set up freehand drawing state
  freehandMode = mode;
  isFreehandDrawing = false;
  freehandPoints = [];
  freehandLayer = null;

  // Change cursor to crosshair
  map.getContainer().style.cursor = "crosshair";

  // Show instruction message based on mode
  let message = "Giữ chuột và vẽ. Thả chuột để hoàn thành.";
  if (mode === "marker") {
    message = "Giữ chuột và vẽ để tạo đường đánh dấu (Marker). Thả chuột để hoàn thành.";
  } else if (mode === "highlighter") {
    message = "Giữ chuột và vẽ để tô sáng (Highlighter). Thả chuột để hoàn thành.";
  } else {
    message = "Giữ chuột và vẽ để tạo vùng. Thả chuột để hoàn thành.";
  }
  
  const event = new CustomEvent("showMapInstruction", {
    detail: { message },
  });
  window.dispatchEvent(event);

  // Remove old event listeners if any
  map.off("mousedown", handleFreehandStart);
  map.off("mousemove", handleFreehandMove);
  map.off("mouseup", handleFreehandEnd);

  // Add event listeners for freehand drawing
  map.on("mousedown", handleFreehandStart);
  map.on("mousemove", handleFreehandMove);
  map.on("mouseup", handleFreehandEnd);
}

function handleFreehandStart(e: LeafletMouseEvent) {
  if (!L) return;
  
  isFreehandDrawing = true;
  freehandPoints = [e.latlng];
  
  const map = e.target as MapWithPM;
  
  // Different styles for Highlighter (polygon/area) vs Marker (line)
  // Highlighter: Yellow, thick, semi-transparent - for highlighting areas
  // Marker: Black, thin, solid - for drawing/annotating
  const highlighterStyle = {
    color: "#FFFF00",      // Yellow
    weight: 60,            // Thick stroke (60px)
    opacity: 0.5,          // 50% opacity
    lineCap: "round" as const,
    lineJoin: "round" as const,
    fillColor: "#FFFF00",
    fillOpacity: 0.3,
  };

  const markerStyle = {
    color: "#000000",      // Black
    weight: 10,            // Thinner stroke (10px) 
    opacity: 1,            // 100% opacity
    lineCap: "round" as const,
    lineJoin: "round" as const,
  };

  // Select style based on freehand mode
  // Marker: Black, thin line for precise annotations
  // Highlighter: Yellow, thick semi-transparent for highlighting
  // Polygon: Yellow filled area
  let style;
  if (freehandMode === "marker") {
    style = markerStyle;
    freehandLayer = L.polyline([e.latlng], style);
  } else if (freehandMode === "highlighter") {
    style = highlighterStyle;
    freehandLayer = L.polyline([e.latlng], style);
  } else {
    // polygon mode
    style = highlighterStyle;
    freehandLayer = L.polygon([e.latlng], style);
  }
  
  freehandLayer.addTo(map);

  // Disable map dragging while drawing
  map.dragging.disable();
}

function handleFreehandMove(e: LeafletMouseEvent) {
  if (!isFreehandDrawing || !freehandLayer) return;
  
  // Add point to array (with some throttling for performance)
  const lastPoint = freehandPoints[freehandPoints.length - 1];
  const distance = e.latlng.distanceTo(lastPoint);
  
  // Only add point if it's far enough from last point (reduces noise)
  if (distance > 5) {
    freehandPoints.push(e.latlng);
    freehandLayer.setLatLngs(freehandPoints);
  }
}

function handleFreehandEnd(e: LeafletMouseEvent) {
  if (!isFreehandDrawing || !freehandLayer) return;
  
  const map = e.target as MapWithPM;
  
  // Re-enable map dragging
  map.dragging.enable();
  
  // Reset cursor
  map.getContainer().style.cursor = "";
  
  // Remove event listeners
  map.off("mousedown", handleFreehandStart);
  map.off("mousemove", handleFreehandMove);
  map.off("mouseup", handleFreehandEnd);
  
  // If we have at least 3 points, finalize the shape
  if (freehandPoints.length >= 3) {
    // Close polygon if needed
    if (freehandMode === "polygon" && freehandLayer instanceof (L as any).Polygon) {
      const closedPoints = [...freehandPoints, freehandPoints[0]];
      freehandLayer.setLatLngs(closedPoints);
    }
    
    // Mark this layer as a freehand drawing to prevent vertex editing
    (freehandLayer as any)._isFreehandDrawing = true;
    (freehandLayer as any)._freehandMode = freehandMode;
    
    // Disable vertex editing for freehand layers - only allow dragging as whole object
    if ((freehandLayer as any).pm) {
      // Disable editing (vertex manipulation) 
      (freehandLayer as any).pm.disable();
      
      // Configure to only allow drag mode, not edit mode
      (freehandLayer as any).pm.setOptions({
        allowEditing: false,       // Disable vertex editing
        draggable: true,           // Allow dragging entire shape
        allowSelfIntersection: true,
      });
    }
    
    // Determine shape type for pm:create event
    const shape = freehandMode === "polygon" ? "Polygon" : "Line";
    
    // Fire the standard Geoman event on the map
    map.fire("pm:create", {
      layer: freehandLayer,
      shape: shape,
    });
    
    // Hide instruction
    const hideEvent = new CustomEvent("hideMapInstruction");
    window.dispatchEvent(hideEvent);
  } else {
    // Not enough points, remove the layer
    if (freehandLayer) {
      map.removeLayer(freehandLayer);
    }
  }
  
  // Reset state
  isFreehandDrawing = false;
  freehandPoints = [];
  freehandLayer = null;
}

/**
 * Disable custom freehand drawing mode
 */
export function disableFreehandDrawing(mapRef: React.MutableRefObject<MapWithPM | null>) {
  const map = mapRef.current;
  if (!map) return;
  
  map.off("mousedown", handleFreehandStart);
  map.off("mousemove", handleFreehandMove);
  map.off("mouseup", handleFreehandEnd);
  
  map.getContainer().style.cursor = "";
  isFreehandDrawing = false;
  freehandPoints = [];
  
  if (freehandLayer && map.hasLayer(freehandLayer)) {
    map.removeLayer(freehandLayer);
  }
  freehandLayer = null;
}

/**
 * Toggle global edit mode
 */
export function toggleEdit(mapRef: React.MutableRefObject<MapWithPM | null>) {
  mapRef.current?.pm.toggleGlobalEditMode();
}

/**
 * Toggle global removal/delete mode
 */
export function toggleDelete(mapRef: React.MutableRefObject<MapWithPM | null>) {
  mapRef.current?.pm.toggleGlobalRemovalMode();
}

/**
 * Toggle global drag mode
 */
export function toggleDrag(mapRef: React.MutableRefObject<MapWithPM | null>) {
  mapRef.current?.pm.toggleGlobalDragMode();
}

/**
 * Enable polygon cutting mode
 */
export function enableCutPolygon(mapRef: React.MutableRefObject<MapWithPM | null>) {
  mapRef.current?.pm.enableGlobalCutMode();
}

/**
 * Toggle global rotate mode
 */
export function toggleRotate(mapRef: React.MutableRefObject<MapWithPM | null>) {
  mapRef.current?.pm?.toggleGlobalRotateMode?.();
}

/**
 * Zoom in on the map
 */
export function zoomIn(mapRef: React.MutableRefObject<MapWithPM | null>) {
  if (mapRef.current) {
    mapRef.current.zoomIn();
  }
}

/**
 * Zoom out on the map
 */
export function zoomOut(mapRef: React.MutableRefObject<MapWithPM | null>) {
  if (mapRef.current) {
    mapRef.current.zoomOut();
  }
}

/**
 * Get user initials from email for avatar display
 */
export function getInitials(email: string): string {
  if (!email) return '?';
  const parts = email.split('@')[0].split('.');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}
