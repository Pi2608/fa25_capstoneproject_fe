import type { MapWithPM } from "@/types";

/**
 * Enable drawing mode for a specific shape on the map
 */
export function enableDraw(
  mapRef: React.MutableRefObject<MapWithPM | null>,
  shape: "Marker" | "Line" | "Polygon" | "Rectangle" | "Circle" | "CircleMarker" | "Text"
) {
  // Map Geoman shapes to GeometryTypeEnum:
  // Marker/CircleMarker -> Point (GeometryTypeEnum.Point = 0)
  // Line -> LineString (GeometryTypeEnum.LineString = 1)
  // Polygon -> Polygon (GeometryTypeEnum.Polygon = 2)
  // Circle (large) -> Circle (GeometryTypeEnum.Circle = 3)
  // Rectangle -> Rectangle (GeometryTypeEnum.Rectangle = 4)
  mapRef.current?.pm.enableDraw(shape);
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
