import type { Zone } from "@/lib/api-storymap";
import type { CreateMapFeatureRequest } from "@/lib/api-maps";
import type L from "leaflet";

export async function convertZoneToLeafletLayer(
  zone: Zone,
  L: typeof import("leaflet").default
): Promise<L.Layer | null> {
  try {
    const geoJson = JSON.parse(zone.geometry);

    // Create GeoJSON layer with styling
    const geoJsonLayer = L.geoJSON(geoJson, {
      style: () => ({
        color: "#3388ff",
        weight: 3,
        opacity: 0.8,
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      }),
      // Handle Point geometry with circleMarker
      pointToLayer: (_feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: "#3388ff",
          fillOpacity: 0.8,
          color: "#3388ff",
          weight: 2,
          opacity: 1,
        });
      },
    });

    // Add popup with zone info
    geoJsonLayer.bindPopup(`
      <div style="font-family: system-ui, sans-serif;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">${zone.name}</h3>
        ${zone.description ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">${zone.description}</p>` : ""}
        <p style="margin: 4px 0; font-size: 11px; color: #999;">Type: ${zone.zoneType}</p>
        <p style="margin: 4px 0; font-size: 11px; color: #999;">Geometry: ${geoJson.type}</p>
      </div>
    `);

    // Add tooltip with zone name
    geoJsonLayer.bindTooltip(zone.name, {
      permanent: false,
      direction: "top",
      className: "zone-label-tooltip",
    });

    return geoJsonLayer;
  } catch (error) {
    console.error("Failed to convert zone to leaflet layer:", error);
    return null;
  }
}

// Get center coordinates from zone
export function getZoneCenter(zone: Zone): [number, number] | null {
  // Try centroid first
  if (zone.centroid) {
    const str = zone.centroid.trim();

    // Case 1: centroid as GeoJSON Point
    if (str.startsWith("{")) {
      try {
        const gj = JSON.parse(str);
        if (
          gj &&
          gj.type === "Point" &&
          Array.isArray(gj.coordinates) &&
          gj.coordinates.length >= 2
        ) {
          const lng = Number(gj.coordinates[0]);
          const lat = Number(gj.coordinates[1]);
          if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
            return [lng, lat];
          }
        }
      } catch {

      }
    }

    // Case 2: centroid as "lat,lon" or "lat lon"
    const parts = str.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = Number(parts[0]); // lat
      const b = Number(parts[1]); // lon
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        return [b, a]; // [lng, lat]
      }
    }
  }

  // Fallback to bounding box
  if (zone.boundingBox) {
    try {
      const bb = JSON.parse(zone.boundingBox);
      if (Array.isArray(bb) && bb.length >= 4) {
        const south = Number(bb[0]);
        const north = Number(bb[1]);
        const west = Number(bb[2]);
        const east = Number(bb[3]);

        if (
          !Number.isNaN(south) &&
          !Number.isNaN(north) &&
          !Number.isNaN(west) &&
          !Number.isNaN(east)
        ) {
          const lat = (south + north) / 2;
          const lng = (west + east) / 2;
          return [lng, lat];
        }
      }
    } catch {

    }
  }

  // Last resort: parse geometry to get center
  try {
    const geoJson = JSON.parse(zone.geometry);

    if (geoJson.type === "Point") {
      return [geoJson.coordinates[0], geoJson.coordinates[1]];
    }

    if (geoJson.type === "Polygon" && Array.isArray(geoJson.coordinates[0])) {
      const ring = geoJson.coordinates[0];
      let sumLng = 0;
      let sumLat = 0;
      let count = 0;

      for (const coord of ring) {
        if (!Array.isArray(coord) || coord.length < 2) continue;
        sumLng += coord[0];
        sumLat += coord[1];
        count++;
      }

      if (count > 0) {
        return [sumLng / count, sumLat / count];
      }
    }

    if (geoJson.type === "MultiPolygon" && Array.isArray(geoJson.coordinates)) {
      // Get center of first polygon
      const firstPolygon = geoJson.coordinates[0];
      if (Array.isArray(firstPolygon) && Array.isArray(firstPolygon[0])) {
        const ring = firstPolygon[0];
        let sumLng = 0;
        let sumLat = 0;
        let count = 0;

        for (const coord of ring) {
          if (!Array.isArray(coord) || coord.length < 2) continue;
          sumLng += coord[0];
          sumLat += coord[1];
          count++;
        }

        if (count > 0) {
          return [sumLng / count, sumLat / count];
        }
      }
    }

    if (geoJson.type === "LineString" && Array.isArray(geoJson.coordinates)) {
      const coords = geoJson.coordinates;
      if (coords.length > 0) {
        const midIndex = Math.floor(coords.length / 2);
        return [coords[midIndex][0], coords[midIndex][1]];
      }
    }
  } catch {
    
  }

  return null;
}

// Get geometry type from zone
export function getZoneGeometryType(zone: Zone): string {
  try {
    const geoJson = JSON.parse(zone.geometry);
    return geoJson.type || "Unknown";
  } catch {
    return "Unknown";
  }
}

//Simplify polygon coordinates using Douglas-Peucker algorithm
function simplifyPolygonCoordinates(coordinates: any[], tolerance = 0.001): any[] {
  if (!Array.isArray(coordinates)) return coordinates;

  // For Polygon: coordinates is array of rings
  if (coordinates.length > 0 && Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
    return coordinates.map(ring => simplifyLineString(ring, tolerance));
  }

  return coordinates;
}

//Simplify LineString using Douglas-Peucker algorithm
function simplifyLineString(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return points;

  // Find point with maximum distance from line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyLineString(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyLineString(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }

  // Return start and end points
  return [start, end];
}

//Calculate perpendicular distance from point to line segment
function perpendicularDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert Zone to CreateMapFeatureRequest
 * Handles MultiPolygon and MultiLineString by converting to single geometry
 * Simplifies complex geometries to improve performance
 */
export function convertZoneToFeatureRequest(
  zone: Zone,
  mapId: string,
  layerId?: string | null
): CreateMapFeatureRequest | null {
  try {
    const geoJson = JSON.parse(zone.geometry);
    let geometryType: "Point" | "LineString" | "Polygon" | "Circle" | "Rectangle";
    let coordinates = zone.geometry;

    // Map geometry types
    switch (geoJson.type) {
      case "Point":
        geometryType = "Point";
        break;
      case "LineString":
        geometryType = "LineString";
        // Simplify LineString
        if (Array.isArray(geoJson.coordinates)) {
          const simplified = simplifyLineString(geoJson.coordinates, 0.001);
          coordinates = JSON.stringify({
            type: "LineString",
            coordinates: simplified,
          });
        }
        break;
      case "Polygon":
        geometryType = "Polygon";
        // Simplify Polygon
        if (Array.isArray(geoJson.coordinates)) {
          const originalCount = geoJson.coordinates[0]?.length || 0;
          const simplified = simplifyPolygonCoordinates(geoJson.coordinates, 0.001);
          const simplifiedCount = simplified[0]?.length || 0;
          console.log(`Polygon simplified: ${originalCount} points → ${simplifiedCount} points (${Math.round((1 - simplifiedCount/originalCount) * 100)}% reduction)`);
          coordinates = JSON.stringify({
            type: "Polygon",
            coordinates: simplified,
          });
        }
        break;
      case "MultiPolygon":
        // Convert MultiPolygon to Polygon by using the first polygon, then simplify
        geometryType = "Polygon";
        if (Array.isArray(geoJson.coordinates) && geoJson.coordinates.length > 0) {
          const firstPolygon = geoJson.coordinates[0];
          const originalCount = firstPolygon[0]?.length || 0;
          const simplified = simplifyPolygonCoordinates(firstPolygon, 0.001);
          const simplifiedCount = simplified[0]?.length || 0;
          console.log(`MultiPolygon simplified: ${originalCount} points → ${simplifiedCount} points (${Math.round((1 - simplifiedCount/originalCount) * 100)}% reduction)`);
          coordinates = JSON.stringify({
            type: "Polygon",
            coordinates: simplified,
          });
        }
        break;
      case "MultiLineString":
        // Convert MultiLineString to LineString by using the first line, then simplify
        geometryType = "LineString";
        if (Array.isArray(geoJson.coordinates) && geoJson.coordinates.length > 0) {
          const firstLine = geoJson.coordinates[0];
          const simplified = simplifyLineString(firstLine, 0.001);
          coordinates = JSON.stringify({
            type: "LineString",
            coordinates: simplified,
          });
        }
        break;
      default:
        // Unsupported geometry type
        console.warn(`Unsupported geometry type: ${geoJson.type}`);
        return null;
    }

    // Create feature request
    const featureRequest: CreateMapFeatureRequest = {
      mapId,
      layerId: layerId || null,
      name: zone.name,
      description: zone.description || `Administrative zone: ${zone.zoneType}`,
      featureCategory: "Data",
      annotationType: null,
      geometryType,
      coordinates,
      properties: JSON.stringify({
        zoneId: zone.zoneId,
        zoneType: zone.zoneType,
        zoneCode: zone.zoneCode,
        adminLevel: zone.adminLevel,
        externalId: zone.externalId,
        source: "zone-search",
      }),
      style: JSON.stringify({
        color: "#3388ff",
        weight: 3,
        opacity: 0.8,
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      }),
      isVisible: true,
      zIndex: 1,
    };

    return featureRequest;
  } catch (error) {
    console.error("Failed to convert zone to feature request:", error);
    return null;
  }
}
