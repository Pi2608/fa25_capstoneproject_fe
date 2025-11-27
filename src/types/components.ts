// Component-specific types

import type { GeoJSON } from "geojson";
import type { Layer } from "./map";

// Feature properties panel
export interface FeaturePropertiesPanelProps {
  layers: any[];
  selectedLayerId?: string;
  onFeatureSelect?: (feature: GeoJSON.Feature, layerId: string, featureIndex: number) => void;
  selectedFeature?: {
    layerId: string;
    featureIndex: number;
  };
}

// Feature properties table
export interface FeaturePropertiesTableProps {
  features: GeoJSON.Feature[];
  layerName?: string;
  onFeatureSelect?: (feature: GeoJSON.Feature, index: number) => void;
  selectedFeatureIndex?: number;
}

export interface PropertyColumn {
  key: string;
  type: "string" | "number" | "boolean" | "object" | "undefined";
  sampleValue: unknown;
}

// Copy feature dialog
export interface CopyFeatureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  sourceLayerId: string;
  sourceLayerName: string;
  featureIndex: number;
  initialCopyMode?: "existing" | "new";
  onSuccess: (message: string) => void;
}

// Zone context menu
export interface ZoneContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onZoomToFit: () => void;
  onCopyCoordinates: () => void;
  onCopyToExistingLayer?: (layerId?: string) => void;
  onCopyToNewLayer?: (layerName?: string) => void;
  onDeleteZone: () => void;
  zoneName?: string;
  mapId?: string;
  layerId?: string;
  featureIndex?: number;
  feature?: GeoJSON.Feature;
  onSuccess?: (message: string) => void;
}

export interface LayerPickerDialogProps {
  visible: boolean;
  layers: Array<{ id: string; name: string }>;
  currentLayerId: string;
  onSelect: (layerId: string) => void;
  onClose: () => void;
}

// Map toolbar
export interface MapToolbarProps {
  name: string;
  baseKey: string;
  mapRef: React.RefObject<any>;
  setName: (name: string) => void;
  setBaseKey: (key: string) => void;
  onDrawMarker: () => void;
  onDrawLine: () => void;
  onDrawPolygon: () => void;
  onDrawRectangle: () => void;
  onDrawCircle: () => void;
  onDrawText: () => void;
  onCutPolygon: () => void;
  onRotate: () => void;
  onDrag: () => void;
  onEdit: () => void;
  onSaveView: () => void;
  onClearSketch: () => void;
  onSaveMeta: () => void;
  busySaveView: boolean;
  busySaveMeta: boolean;
  feedback: string | null;
}

// Register layout
export interface RegisterLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  showBackButton?: boolean;
  onBack?: () => void;
  currentStep?: number;
  totalSteps?: number;
}

export interface RegisterFormManagerProps {}

// Template types
export interface Template {
  templateId: string;
  templateName: string;
  description?: string;
  previewImage?: string | null;
  category?: string;
}

export interface CreateFromTemplateRes {
  mapId: string;
}

// Logout button
export interface LogoutButtonProps {
  className?: string;
  children?: React.ReactNode;
}
