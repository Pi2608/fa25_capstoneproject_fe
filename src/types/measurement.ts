import type L from 'leaflet';

export type MeasurementMode = 'distance' | 'area' | null;

export interface MeasurementState {
  mode: MeasurementMode;
  isActive: boolean;
  points: L.LatLng[];
  currentValue: number; // meters or square meters
  layer: L.Polyline | L.Polygon | null;
  tooltip: L.Tooltip | null;
}

export interface MeasurementToolsHookReturn {
  state: MeasurementState;
  startMeasurement: (mode: 'distance' | 'area') => void;
  cancelMeasurement: () => void;
  isDistanceMode: boolean;
  isAreaMode: boolean;
}

