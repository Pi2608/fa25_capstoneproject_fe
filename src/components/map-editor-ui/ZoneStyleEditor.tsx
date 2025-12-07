"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import type { MapZone, Zone, UpdateMapZoneRequest } from "@/lib/api-maps";

interface ZoneStyleEditorProps {
    mapId: string;
    mapZone: MapZone;
    zone: Zone;
    onClose: () => void;
}

export function ZoneStyleEditor({
    mapId,
    mapZone,
    zone,
    onClose,
}: ZoneStyleEditorProps) {
    const [boundaryColor, setBoundaryColor] = useState(mapZone.boundaryColor || "#3388ff");
    const [boundaryWidth, setBoundaryWidth] = useState(mapZone.boundaryWidth || 2);
    const [fillColor, setFillColor] = useState(mapZone.fillColor || "#3388ff");
    const [fillOpacity, setFillOpacity] = useState(mapZone.fillOpacity || 0.2);
    const [highlightBoundary, setHighlightBoundary] = useState(mapZone.highlightBoundary);
    const [fillZone, setFillZone] = useState(mapZone.fillZone);
    const [showLabel, setShowLabel] = useState(mapZone.showLabel);
    const [labelOverride, setLabelOverride] = useState(mapZone.labelOverride || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { updateMapZone } = await import("@/lib/api-maps");
            // Include all required fields from current mapZone to prevent them from being reset
            await updateMapZone(mapId, mapZone.mapZoneId, {
                displayOrder: mapZone.displayOrder,
                isVisible: mapZone.isVisible,
                zIndex: mapZone.zIndex,
                boundaryColor,
                boundaryWidth,
                fillColor,
                fillOpacity,
                highlightBoundary,
                fillZone,
                showLabel,
                labelOverride: labelOverride || undefined,
            });
            window.dispatchEvent(new CustomEvent("refreshMapZones"));
            onClose();
        } catch (err) {
            console.error("Failed to update zone style:", err);
            alert("Lỗi khi cập nhật zone");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed right-0 top-10 bottom-0 w-[300px] bg-zinc-900/95 backdrop-blur-lg border-l border-zinc-800 z-[1500] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                    <Icon icon="mdi:vector-polygon" className="w-5 h-5 text-blue-400" />
                    <h3 className="font-semibold text-sm text-zinc-200">Zone Style</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors"
                    title="Close"
                >
                    <Icon icon="mdi:close" className="w-5 h-5 text-zinc-400" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Zone Info */}
                <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-2">{zone.name}</h4>
                    <p className="text-xs text-zinc-500">{zone.zoneType}</p>
                </div>

                {/* Border Settings */}
                <div className="border-t border-zinc-800 pt-4">
                    <h4 className="text-xs font-medium text-zinc-400 mb-3">BORDER</h4>

                    <div className="space-y-3">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={highlightBoundary}
                                onChange={(e) => setHighlightBoundary(e.target.checked)}
                                className="w-4 h-4 rounded"
                            />
                            <span className="text-xs text-zinc-300">Highlight Border</span>
                        </label>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-400 w-16">Color:</label>
                            <input
                                type="color"
                                value={boundaryColor}
                                onChange={(e) => setBoundaryColor(e.target.value)}
                                className="w-8 h-6 rounded cursor-pointer border border-zinc-700"
                            />
                            <input
                                type="text"
                                value={boundaryColor}
                                onChange={(e) => setBoundaryColor(e.target.value)}
                                className="flex-1 bg-zinc-800 text-white text-xs rounded px-2 py-1"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-400 w-16">Width:</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={boundaryWidth}
                                onChange={(e) => setBoundaryWidth(Number(e.target.value))}
                                className="flex-1"
                            />
                            <span className="text-xs text-zinc-300 w-6">{boundaryWidth}px</span>
                        </div>
                    </div>
                </div>

                {/* Fill Settings */}
                <div className="border-t border-zinc-800 pt-4">
                    <h4 className="text-xs font-medium text-zinc-400 mb-3">FILL</h4>

                    <div className="space-y-3">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={fillZone}
                                onChange={(e) => setFillZone(e.target.checked)}
                                className="w-4 h-4 rounded"
                            />
                            <span className="text-xs text-zinc-300">Enable Fill</span>
                        </label>

                        {fillZone && (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-zinc-400 w-16">Color:</label>
                                    <input
                                        type="color"
                                        value={fillColor}
                                        onChange={(e) => setFillColor(e.target.value)}
                                        className="w-8 h-6 rounded cursor-pointer border border-zinc-700"
                                    />
                                    <input
                                        type="text"
                                        value={fillColor}
                                        onChange={(e) => setFillColor(e.target.value)}
                                        className="flex-1 bg-zinc-800 text-white text-xs rounded px-2 py-1"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-zinc-400 w-16">Opacity:</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={fillOpacity}
                                        onChange={(e) => setFillOpacity(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-zinc-300 w-8">{(fillOpacity * 100).toFixed(0)}%</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Label Settings */}
                <div className="border-t border-zinc-800 pt-4">
                    <h4 className="text-xs font-medium text-zinc-400 mb-3">LABEL</h4>

                    <div className="space-y-3">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={showLabel}
                                onChange={(e) => setShowLabel(e.target.checked)}
                                className="w-4 h-4 rounded"
                            />
                            <span className="text-xs text-zinc-300">Show Label</span>
                        </label>

                        {showLabel && (
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Custom Label:</label>
                                <input
                                    type="text"
                                    value={labelOverride}
                                    onChange={(e) => setLabelOverride(e.target.value)}
                                    placeholder={zone.name}
                                    className="w-full bg-zinc-800 text-white text-xs rounded px-2 py-1.5"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="border-t border-zinc-800 pt-4 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-3 py-2 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-3 py-2 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
