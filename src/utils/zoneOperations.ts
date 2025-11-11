import type { LatLngBounds } from 'leaflet';
import { messages, type Lang } from "@/i18n/messages";

/**
 * Get current language from localStorage or default to 'en'
 */
function getCurrentLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("lang") as Lang | null;
  return saved === "vi" || saved === "en" ? saved : "en";
}

/**
 * Get translated message from i18n messages
 */
function t(namespace: "common", key: string): string {
  const lang = getCurrentLang();
  const pack = messages[lang]?.[namespace] as Record<string, unknown> | undefined;
  const msg = pack ? (pack[key] as string | undefined) : undefined;
  return typeof msg === "string" ? msg : key;
}

/**
 * Get center coordinates from a feature
 */
export function getFeatureCenter(feature: GeoJSON.Feature): [number, number] | null {
  if (!feature.geometry) return null;

  switch (feature.geometry.type) {
    case 'Point':
      return feature.geometry.coordinates as [number, number];
    
    case 'Polygon':
      // Calculate centroid of polygon
      const coords = feature.geometry.coordinates[0] as [number, number][];
      const sum = coords.reduce((acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]], [0, 0]);
      return [sum[0] / coords.length, sum[1] / coords.length];
    
    case 'LineString':
      // Get middle point of line
      const lineCoords = feature.geometry.coordinates as [number, number][];
      const midIndex = Math.floor(lineCoords.length / 2);
      return lineCoords[midIndex];
    
    case 'MultiPolygon':
      // Get centroid of first polygon
      const firstPoly = feature.geometry.coordinates[0][0] as [number, number][];
      const polySum = firstPoly.reduce((acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]], [0, 0]);
      return [polySum[0] / firstPoly.length, polySum[1] / firstPoly.length];
    
    default:
      return null;
  }
}

/**
 * Get bounds from a feature
 */
export function getFeatureBounds(feature: GeoJSON.Feature): [[number, number], [number, number]] | null {
  if (!feature.geometry) return null;

  const getAllCoords = (geometry: GeoJSON.Geometry): [number, number][] => {
    switch (geometry.type) {
      case 'Point':
        return [geometry.coordinates as [number, number]];
      
      case 'LineString':
        return geometry.coordinates as [number, number][];
      
      case 'Polygon':
        return geometry.coordinates.flat() as [number, number][];
      
      case 'MultiPoint':
        return geometry.coordinates as [number, number][];
      
      case 'MultiLineString':
        return geometry.coordinates.flat() as [number, number][];
      
      case 'MultiPolygon':
        return geometry.coordinates.flat(2) as [number, number][];
      
      default:
        return [];
    }
  };

  const coords = getAllCoords(feature.geometry);
  if (coords.length === 0) return null;

  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);

  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ];
}

/**
 * Format coordinates for copying
 */
export function formatCoordinates(feature: GeoJSON.Feature): string {
  const center = getFeatureCenter(feature);
  if (!center) return t("common", "notAvailable");

  const [lng, lat] = center;
  const latLabel = t("common", "latitude");
  const lngLabel = t("common", "longitude");
  return `${latLabel}: ${lat.toFixed(6)}, ${lngLabel}: ${lng.toFixed(6)}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Get feature name from properties
 */
export function getFeatureName(feature: GeoJSON.Feature): string {
  if (!feature.properties) return t("common", "unknownZone");
  
  // Try common name properties
  const nameProps = ['name', 'Name', 'NAME', 'TinhThanh', 'title', 'label'];
  for (const prop of nameProps) {
    if (feature.properties[prop]) {
      return String(feature.properties[prop]);
    }
  }
  
  return t("common", "zone");
}

/**
 * Find feature index in GeoJSON FeatureCollection
 */
export function findFeatureIndex(
  featureCollection: GeoJSON.FeatureCollection,
  feature: GeoJSON.Feature
): number {
  // Try to match by properties
  if (feature.properties && feature.properties.id) {
    const index = featureCollection.features.findIndex(
      f => f.properties?.id === feature.properties?.id
    );
    if (index !== -1) return index;
  }

  // Try to match by geometry
  return featureCollection.features.findIndex(
    f => JSON.stringify(f.geometry) === JSON.stringify(feature.geometry)
  );
}

/**
 * Remove feature from GeoJSON FeatureCollection
 */
export function removeFeatureFromGeoJSON(
  featureCollection: GeoJSON.FeatureCollection,
  featureIndex: number
): GeoJSON.FeatureCollection {
  return {
    ...featureCollection,
    features: featureCollection.features.filter((_, index) => index !== featureIndex)
  };
}

/**
 * Add feature to GeoJSON FeatureCollection
 */
export function addFeatureToGeoJSON(
  featureCollection: GeoJSON.FeatureCollection,
  feature: GeoJSON.Feature
): GeoJSON.FeatureCollection {
  return {
    ...featureCollection,
    features: [...featureCollection.features, feature]
  };
}

