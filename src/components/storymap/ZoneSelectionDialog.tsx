"use client";

import { useState, useEffect } from "react";
import { Zone, CreateSegmentZoneRequest, getZones, searchZones } from "@/lib/api-storymap";
import { Button } from "@/components/ui/button";

interface ZoneSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateSegmentZoneRequest) => Promise<void>;
  segmentId: string;
}

export default function ZoneSelectionDialog({
  isOpen,
  onClose,
  onSave,
  segmentId,
}: ZoneSelectionDialogProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Configuration for zone highlighting
  const [highlightBoundary, setHighlightBoundary] = useState(true);
  const [boundaryColor, setBoundaryColor] = useState("#FFD700");
  const [boundaryWidth, setBoundaryWidth] = useState(2);
  const [fillZone, setFillZone] = useState(true);
  const [fillColor, setFillColor] = useState("#FFD700");
  const [fillOpacity, setFillOpacity] = useState(0.3);
  const [showLabel, setShowLabel] = useState(true);
  const [labelOverride, setLabelOverride] = useState("");

  // Load zones
  useEffect(() => {
    if (isOpen) {
      loadZones();
    }
  }, [isOpen]);

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await getZones();
      setZones(data || []);
    } catch (error) {
      console.error("Failed to load zones:", error);
      alert("Failed to load zones. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadZones();
      return;
    }

    setLoading(true);
    try {
      const results = await searchZones(searchTerm);
      setZones(results || []);
    } catch (error) {
      console.error("Failed to search zones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedZone) {
      alert("Please select a zone");
      return;
    }

    setSaving(true);
    try {
      const data: CreateSegmentZoneRequest = {
        segmentId,
        zoneId: selectedZone.zoneId,
        highlightBoundary,
        boundaryColor: highlightBoundary ? boundaryColor : undefined,
        boundaryWidth: highlightBoundary ? boundaryWidth : undefined,
        fillZone,
        fillColor: fillZone ? fillColor : undefined,
        fillOpacity: fillZone ? fillOpacity : undefined,
        showLabel,
        labelOverride: showLabel && labelOverride.trim() ? labelOverride : undefined,
        isVisible: true,
        displayOrder: 0,
      };

      await onSave(data);
      onClose();
    } catch (error) {
      console.error("Failed to add zone:", error);
      alert("Failed to add zone. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div>
            <h3 className="text-lg font-semibold text-white">Add Zone to Segment</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Select a zone from master data and configure how it appears
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-180px)]">
          <div className="overflow-y-auto px-6 py-4 space-y-6">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Search Zones
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                  placeholder="Search by name..."
                  className="flex-1 px-4 py-2 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white placeholder-zinc-500"
                />
                <Button type="button" onClick={handleSearch} disabled={loading}>
                  🔍 Search
                </Button>
              </div>
            </div>

            {/* Zone List */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Available Zones ({zones.length})
              </label>
              <div className="max-h-64 overflow-y-auto border border-zinc-700 rounded-lg bg-zinc-800/50">
                {loading ? (
                  <div className="p-8 text-center text-zinc-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
                    Loading zones...
                  </div>
                ) : zones.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    No zones found. Try a different search term.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-700">
                    {zones.map((zone) => (
                      <button
                        key={zone.zoneId}
                        type="button"
                        onClick={() => setSelectedZone(zone)}
                        className={`w-full text-left px-4 py-3 hover:bg-zinc-700/50 transition-colors ${
                          selectedZone?.zoneId === zone.zoneId ? 'bg-emerald-900/30 border-l-4 border-emerald-500' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-white">{zone.name}</div>
                            <div className="text-xs text-zinc-400 mt-1">
                              Type: {zone.zoneType} {zone.zoneCode && `• Code: ${zone.zoneCode}`}
                            </div>
                          </div>
                          {selectedZone?.zoneId === zone.zoneId && (
                            <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Configuration */}
            {selectedZone && (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-white mb-3">Zone Display Configuration</h4>

                {/* Boundary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="highlightBoundary"
                      checked={highlightBoundary}
                      onChange={(e) => setHighlightBoundary(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="highlightBoundary" className="text-sm text-zinc-300 cursor-pointer">
                      Highlight Boundary
                    </label>
                  </div>
                  {highlightBoundary && (
                    <div className="grid grid-cols-2 gap-3 ml-7">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Color</label>
                        <input
                          type="color"
                          value={boundaryColor}
                          onChange={(e) => setBoundaryColor(e.target.value)}
                          className="w-full h-9 rounded border border-zinc-600 bg-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Width (px)</label>
                        <input
                          type="number"
                          value={boundaryWidth}
                          onChange={(e) => setBoundaryWidth(Number(e.target.value))}
                          min={1}
                          max={10}
                          className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Fill */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="fillZone"
                      checked={fillZone}
                      onChange={(e) => setFillZone(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="fillZone" className="text-sm text-zinc-300 cursor-pointer">
                      Fill Zone
                    </label>
                  </div>
                  {fillZone && (
                    <div className="grid grid-cols-2 gap-3 ml-7">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Fill Color</label>
                        <input
                          type="color"
                          value={fillColor}
                          onChange={(e) => setFillColor(e.target.value)}
                          className="w-full h-9 rounded border border-zinc-600 bg-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Opacity</label>
                        <input
                          type="number"
                          value={fillOpacity}
                          onChange={(e) => setFillOpacity(Number(e.target.value))}
                          min={0}
                          max={1}
                          step={0.1}
                          className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showLabel"
                      checked={showLabel}
                      onChange={(e) => setShowLabel(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="showLabel" className="text-sm text-zinc-300 cursor-pointer">
                      Show Label
                    </label>
                  </div>
                  {showLabel && (
                    <div className="ml-7">
                      <label className="block text-xs text-zinc-400 mb-1">
                        Custom Label (optional, defaults to zone name)
                      </label>
                      <input
                        type="text"
                        value={labelOverride}
                        onChange={(e) => setLabelOverride(e.target.value)}
                        placeholder={selectedZone.name}
                        className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-900/70 border-t border-zinc-800/80">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !selectedZone}
            >
              {saving ? "Adding..." : "Add Zone"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
