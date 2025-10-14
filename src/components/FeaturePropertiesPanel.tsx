"use client";

import { useState, useEffect } from "react";
import FeaturePropertiesTable from "./FeaturePropertiesTable";
import type { GeoJSON } from "geojson";
import type { RawLayer } from "@/lib/api";

interface FeaturePropertiesPanelProps {
  layers: RawLayer[];
  selectedLayerId?: string;
  onFeatureSelect?: (feature: GeoJSON.Feature, layerId: string, featureIndex: number) => void;
  selectedFeature?: {
    layerId: string;
    featureIndex: number;
  };
}

function layerTypeName(id?: number) {
  switch (id) {
    case 1: return "Point";
    case 2: return "LineString";
    case 3: return "Polygon";
    case 4: return "Raster";
    default: return "Unknown";
  }
}

type UnknownObj = Record<string, unknown>;

function getNumberProp(o: unknown, key: string): number | undefined {
  const r = (o ?? {}) as UnknownObj;
  const v = r[key];
  return typeof v === "number" ? v : undefined;
}

function getStringProp(o: unknown, key: string): string | undefined {
  const r = (o ?? {}) as UnknownObj;
  const v = r[key];
  return typeof v === "string" ? v : undefined;
}

function getLayerTypeId(layer: RawLayer): number | undefined {
  return getNumberProp(layer, "layerTypeId") ?? getNumberProp(layer, "layer_type_id");
}

function getLayerId(layer: RawLayer): string {
  return getStringProp(layer, "id")
    ?? getStringProp(layer, "layer_id")
    ?? getStringProp(layer, "layerId")
    ?? "";
}

function getLayerName(layer: RawLayer): string {
  return getStringProp(layer, "name")
    ?? getStringProp(layer, "layer_name")
    ?? getStringProp(layer, "layerName")
    ?? "";
}

function getLayerData(layer: RawLayer): string | undefined {
  return getStringProp(layer, "layerData")
    ?? getStringProp(layer, "layer_data")
    ?? getStringProp(layer, "layerdata");
}

export default function FeaturePropertiesPanel({
  layers,
  selectedLayerId,
  onFeatureSelect,
  selectedFeature
}: FeaturePropertiesPanelProps) {
  const [selectedLayer, setSelectedLayer] = useState<RawLayer | null>(null);
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([]);

  useEffect(() => {
    const layer = layers.find((l) => getLayerId(l) === selectedLayerId) ?? null;
    setSelectedLayer(layer);
  }, [selectedLayerId, layers]);

  useEffect(() => {
    const raw = selectedLayer ? getLayerData(selectedLayer) : undefined;

    if (!raw) {
      setFeatures([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const type = getStringProp(parsed, "type");
      const feats = (parsed as UnknownObj)["features"];

      if (type === "FeatureCollection" && Array.isArray(feats)) {
        setFeatures(feats as GeoJSON.Feature[]);
      } else {
        setFeatures([]);
      }
    } catch (error) {
      console.error("Failed to parse layer data:", error);
      setFeatures([]);
    }
  }, [selectedLayer]);

  const handleFeatureSelect = (feature: GeoJSON.Feature, index: number) => {
    if (selectedLayer && onFeatureSelect) {
      onFeatureSelect(feature, getLayerId(selectedLayer), index);
    }
  };

  const getSelectedFeatureIndex = (): number => {
    if (selectedFeature && selectedLayer && selectedFeature.layerId === getLayerId(selectedLayer)) {
      return selectedFeature.featureIndex;
    }
    return -1;
  };

  if (!selectedLayer) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Feature Properties
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>Select a layer to view feature properties</p>
        </div>
      </div>
    );
  }

  const typeLabel = layerTypeName(getLayerTypeId(selectedLayer));
  const layerName = getLayerName(selectedLayer);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900">{layerName}</h4>
        <div className="text-sm text-blue-700 mt-1">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
            {typeLabel}
          </span>
          {features.length} feature{features.length !== 1 ? "s" : ""}
        </div>
      </div>

      <FeaturePropertiesTable
        features={features}
        layerName={layerName}
        onFeatureSelect={handleFeatureSelect}
        selectedFeatureIndex={getSelectedFeatureIndex()}
      />

      {selectedFeature && selectedLayer && selectedFeature.layerId === getLayerId(selectedLayer) && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Selected Feature Details</h4>
          <div className="text-sm text-gray-600">
            <p><strong>Geometry Type:</strong> {features[selectedFeature.featureIndex]?.geometry?.type}</p>
            <p><strong>Feature Index:</strong> {selectedFeature.featureIndex + 1}</p>
          </div>
        </div>
      )}
    </div>
  );
}
