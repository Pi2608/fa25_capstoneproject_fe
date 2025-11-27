/**
 * Routing API utilities
 * Uses OSRM (Open Source Routing Machine) for route calculation
 */

export interface RouteResult {
  geometry: {
    type: "LineString";
    coordinates: [number, number][]; // [lng, lat]
  };
  distance: number; // meters
  duration: number; // seconds
  waypoints: Array<{
    location: [number, number]; // [lng, lat]
    name?: string;
  }>;
}

/**
 * Calculate route between two points using OSRM
 * @param fromLng Longitude of start point
 * @param fromLat Latitude of start point
 * @param toLng Longitude of end point
 * @param toLat Latitude of end point
 * @param profile Routing profile: 'driving', 'walking', 'cycling'
 * @returns Route result with geometry, distance, and duration
 */
export async function calculateRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  profile: "driving" | "walking" | "cycling" = "driving"
): Promise<RouteResult | null> {
  try {
    // OSRM public demo server (can be replaced with your own instance)
    const baseUrl = "https://router.project-osrm.org";
    
    // Map profile to OSRM profile
    const osrmProfile = profile === "driving" ? "driving" : profile === "walking" ? "foot" : "cycling";
    
    // Build OSRM route request URL
    // Format: /route/v1/{profile}/{coordinates}?overview=full&geometries=geojson
    const coordinates = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `${baseUrl}/route/v1/${osrmProfile}/${coordinates}?overview=full&geometries=geojson&alternatives=false`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Routing API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn("No route found:", data);
      return null;
    }
    
    const route = data.routes[0];
    const geometry = route.geometry;
    
    // OSRM returns coordinates as [lng, lat]
    const coordinatesArray: [number, number][] = geometry.coordinates;
    
    return {
      geometry: {
        type: "LineString",
        coordinates: coordinatesArray,
      },
      distance: route.distance, // meters
      duration: route.duration, // seconds
      waypoints: data.waypoints?.map((wp: any) => ({
        location: wp.location as [number, number],
        name: wp.name,
      })) || [],
    };
  } catch (error) {
    console.error("Failed to calculate route:", error);
    return null;
  }
}

/**
 * Convert route result to GeoJSON LineString format
 */
export function routeToGeoJSON(route: RouteResult): string {
  return JSON.stringify(route.geometry);
}

/**
 * Calculate straight line distance between two points (Haversine formula)
 */
export function calculateStraightLineDistance(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}
