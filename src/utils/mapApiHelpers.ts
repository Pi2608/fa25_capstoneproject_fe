/**
 * Utility functions for Map API operations
 */

export type PresetData = {
  name: string;
  baseMapProvider?: "OSM" | "Satellite" | "Dark";
  initialLatitude: number;
  initialLongitude: number;
  initialZoom: number;
};

/**
 * Convert legacy preset format to new API format
 * @param preset - The preset data with initialLatitude/Longitude/Zoom
 * @returns Object with defaultBounds and viewState for new API
 */
export function convertPresetToNewFormat(preset: PresetData) {
  // Create bounds and viewState for new API format
  const latDiff = 180 / Math.pow(2, preset.initialZoom);
  const lngDiff = 360 / Math.pow(2, preset.initialZoom);
  
  const minLat = preset.initialLatitude - latDiff / 2;
  const maxLat = preset.initialLatitude + latDiff / 2;
  const minLng = preset.initialLongitude - lngDiff / 2;
  const maxLng = preset.initialLongitude + lngDiff / 2;

  const defaultBounds = JSON.stringify({
    type: "Polygon",
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat]
    ]]
  });

  const viewState = JSON.stringify({
    center: [preset.initialLatitude, preset.initialLongitude],
    zoom: preset.initialZoom
  });

  return {
    defaultBounds,
    viewState,
    baseMapProvider: preset.baseMapProvider ?? "OSM"
  };
}
