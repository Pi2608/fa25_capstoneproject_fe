

// ================== TYPES ==================

import { getJson } from "./api-core";

export type OsmSearchResult = {
  osmType: string; // "node", "way", "relation"
  osmId: number;
  displayName: string;
  lat: number;
  lon: number;
  boundingBox?: [number, number, number, number]; // [minLat, maxLat, minLon, maxLon]
  category?: string;
  type?: string;
  importance?: number;
  geoJson?: string; // GeoJSON geometry string
  addressDetails?: {
    road?: string;
    suburb?: string;
    city?: string;
    district?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
  placeRank?: number;
  adminLevel?: number;
};

export type OsmElementDetail = {
  osmType: string;
  osmId: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: any; // GeoJSON geometry
  members?: any[];
  bounds?: any;
};

export type GeocodeResult = {
  lat: number;
  lon: number;
  displayName: string;
  boundingBox?: [number, number, number, number];
};

// ================== API FUNCTIONS ==================

/**
 * Search OpenStreetMap by name/query
 */
export async function searchOsm(
  query: string,
  lat?: number,
  lon?: number,
  radiusMeters?: number,
  limit?: number
): Promise<OsmSearchResult[]> {
  const params = new URLSearchParams({ query });
  if (lat !== undefined) params.append("lat", lat.toString());
  if (lon !== undefined) params.append("lon", lon.toString());
  if (radiusMeters) params.append("radiusMeters", radiusMeters.toString());
  if (limit) params.append("limit", limit.toString());

  return getJson<OsmSearchResult[]>(`/osm/search?${params.toString()}`);
}

/**
 * Reverse geocode: coordinates → address
 */
export async function reverseGeocodeOsm(
  lat: number,
  lon: number
): Promise<{ displayName: string }> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
  });
  return getJson<{ displayName: string }>(
    `/osm/reverse-geocode?${params.toString()}`
  );
}

/**
 * Forward geocode: address → coordinates
 */
export async function geocodeAddressOsm(
  address: string
): Promise<GeocodeResult> {
  const params = new URLSearchParams({ address });
  return getJson<GeocodeResult>(`/osm/geocode?${params.toString()}`);
}

/**
 * Get full OSM element details by type and ID
 */
export async function getOsmElementDetail(
  osmType: string,
  osmId: number
): Promise<OsmElementDetail> {
  return getJson<OsmElementDetail>(`/osm/element/${osmType}/${osmId}`);
}
