"use client";

import { useState, useEffect } from "react";
import type { GeoJSON } from "geojson";

interface FeaturePropertiesTableProps {
  features: GeoJSON.Feature[];
  layerName?: string;
  onFeatureSelect?: (feature: GeoJSON.Feature, index: number) => void;
  selectedFeatureIndex?: number;
}

type PropType = "string" | "number" | "boolean" | "object" | "undefined";

interface PropertyColumn {
  key: string;
  type: PropType;
  sampleValue: unknown;
}

type Primitive = string | number | boolean | null;
type PropsRecord = Record<string, unknown>;

function detectType(v: unknown): PropType {
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean" || t === "undefined") return t;
  return "object";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return Number.isFinite(value) ? value.toString() : "NaN";
    case "boolean":
      return value ? "Yes" : "No";
    case "object":
      try {
        return JSON.stringify(value);
      } catch {
        return "[object]";
      }
    default:
      return String(value);
  }
}

function normalizeForCompare(v: unknown): { kind: "number" | "string" | "boolean" | "other"; val: number | string | boolean } {
  if (typeof v === "number") return { kind: "number", val: v };
  if (typeof v === "boolean") return { kind: "boolean", val: v };
  if (typeof v === "string") return { kind: "string", val: v.toLowerCase() };
  return { kind: "other", val: formatValue(v).toLowerCase() };
}

export default function FeaturePropertiesTable({
  features,
  layerName = "Layer",
  onFeatureSelect,
  selectedFeatureIndex
}: FeaturePropertiesTableProps) {
  const [columns, setColumns] = useState<PropertyColumn[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  useEffect(() => {
    if (!features || features.length === 0) {
      setColumns([]);
      return;
    }

    const propertyMap = new Map<string, { type: PropType; sampleValue: unknown }>();

    features.forEach((feature) => {
      const props = feature.properties as PropsRecord | null | undefined;
      if (props) {
        Object.entries(props).forEach(([key, value]) => {
          if (!propertyMap.has(key)) {
            propertyMap.set(key, { type: detectType(value), sampleValue: value });
          }
        });
      }
    });

    const columnsArray: PropertyColumn[] = Array.from(propertyMap.entries()).map(([key, data]) => ({
      key,
      type: data.type,
      sampleValue: data.sampleValue
    }));

    setColumns(columnsArray);
  }, [features]);

  const sortedFeatures = [...features];
  if (sortConfig) {
    sortedFeatures.sort((a, b) => {
      const aProps = a.properties as PropsRecord | null | undefined;
      const bProps = b.properties as PropsRecord | null | undefined;

      const aValue: unknown = aProps ? aProps[sortConfig.key] : undefined;
      const bValue: unknown = bProps ? bProps[sortConfig.key] : undefined;

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      const aa = normalizeForCompare(aValue);
      const bb = normalizeForCompare(bValue);

      if (aa.kind === bb.kind) {
        if (aa.val < bb.val) return sortConfig.direction === "desc" ? 1 : -1;
        if (aa.val > bb.val) return sortConfig.direction === "desc" ? -1 : 1;
        return 0;
      } else {
        const sa = String(aa.val);
        const sb = String(bb.val);
        if (sa < sb) return sortConfig.direction === "desc" ? 1 : -1;
        if (sa > sb) return sortConfig.direction === "desc" ? -1 : 1;
        return 0;
      }
    });
  }

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const getTypeColor = (type: PropType): string => {
    switch (type) {
      case "string":
        return "bg-blue-100 text-blue-800";
      case "number":
        return "bg-green-100 text-green-800";
      case "boolean":
        return "bg-purple-100 text-purple-800";
      case "object":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!features || features.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Properties - {layerName}</h3>
        <div className="text-center py-8 text-gray-500">
          <p>No features found in this layer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Feature Properties - {layerName}</h3>
          <div className="text-sm text-gray-500">
            {features.length} feature{features.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.key}</span>
                    <div className="flex flex-col">
                      {sortConfig?.key === column.key ? (
                        <span className={`text-xs ${sortConfig.direction === "asc" ? "text-blue-600" : "text-blue-600"}`}>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">↕</span>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(
                        column.type
                      )}`}
                    >
                      {column.type}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedFeatures.map((feature, index) => {
              const props = feature.properties as PropsRecord | null | undefined;
              return (
                <tr
                  key={`${feature.geometry?.type}-${index}`}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedFeatureIndex === index ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  }`}
                  onClick={() => onFeatureSelect?.(feature, index)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                  {columns.map((column) => {
                    const cellVal: unknown = props ? props[column.key] : undefined;
                    const display = formatValue(cellVal);
                    return (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={display}>
                          {display}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>{columns.length} propert{columns.length !== 1 ? "ies" : "y"} found</div>
          <div>Click on column headers to sort</div>
        </div>
      </div>
    </div>
  );
}
