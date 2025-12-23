/**
 * Get the icon name for a geometry type or feature type
 * Supports both geometryType (Point, LineString, Polygon, Circle, Rectangle)
 * and feature.type (Marker, CircleMarker, Line, Polygon, Circle, Rectangle)
 */
export function getFeatureIcon(type: string): string {
  const typeMap: Record<string, string> = {
    // GeometryType names
    point: "mdi:map-marker",
    linestring: "mdi:vector-polyline",
    polygon: "mdi:shape-polygon-plus",
    circle: "mdi:circle-outline",
    rectangle: "mdi:square-outline",
    // Feature.type names
    marker: "mdi:map-marker",
    circlemarker: "mdi:map-marker",
    line: "mdi:vector-polyline",
  };

  return typeMap[type.toLowerCase()] || "mdi:map-marker";
}
