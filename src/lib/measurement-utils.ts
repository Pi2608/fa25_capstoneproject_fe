import type L from 'leaflet';

/**
 * Calculate distance between points using Leaflet's geodesic distance
 * Uses the Haversine formula (great circle distance)
 */
export function calculateDistance(points: L.LatLng[]): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += points[i].distanceTo(points[i + 1]);
  }
  return totalDistance; // meters
}

/**
 * Calculate area of polygon using the Shoelace formula for geodesic polygons
 * This is an approximation - for more accurate results, consider using a library
 * like turf.js or leaflet-geometryutil
 */
export function calculateArea(points: L.LatLng[]): number {
  if (points.length < 3) return 0;

  // Use Shoelace formula adapted for geodesic coordinates
  // This is an approximation - for small areas it's reasonably accurate
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lat1 = points[i].lat;
    const lng1 = points[i].lng;
    const lat2 = points[j].lat;
    const lng2 = points[j].lng;

    // Convert to radians
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    // Spherical excess formula (approximation for small areas)
    area +=
      Math.atan2(
        Math.tan(lat2Rad / 2 + Math.PI / 4) - Math.tan(lat1Rad / 2 + Math.PI / 4),
        dLng
      ) * Math.cos((lat1Rad + lat2Rad) / 2);
  }

  // Earth's radius in meters
  const R = 6378137;
  area = Math.abs(area * R * R);

  return area; // square meters
}

/**
 * Format distance: "125 m" or "2.5 km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(2)} km`;
  }
}

/**
 * Format area: "450 m²" or "2.5 ha"
 */
export function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) {
    return `${Math.round(sqMeters)} m²`;
  } else {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
}

