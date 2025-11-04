"use client";

import { useEffect, useState } from "react";
import {
  CreateSegmentZoneRequest,
  Zone,
  searchZones,
  getZonesByParent,
} from "@/lib/api-storymap";

interface SelectZoneDialogProps {
  segmentId: string;
  onClose: () => void;
  onSave: (data: CreateSegmentZoneRequest) => void;
}

export default function SelectZoneDialog({
  segmentId,
  onClose,
  onSave,
}: SelectZoneDialogProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Highlight settings
  const [highlightBoundary, setHighlightBoundary] = useState(true);
  const [boundaryColor, setBoundaryColor] = useState("#FFD700");
  const [fillZone, setFillZone] = useState(false);
  const [fillColor, setFillColor] = useState("#FFD700");
  const [fillOpacity, setFillOpacity] = useState(0.3);
  
  useEffect(() => {
    const loadZones = async () => {
      setLoading(true);
      try {
        const results = searchTerm 
          ? await searchZones(searchTerm)
          : await getZonesByParent();
        setZones(results);
      } catch (error) {
        console.error("Failed to load zones:", error);
      } finally {
        setLoading(false);
      }
    };
    
    const timer = setTimeout(loadZones, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const handleSubmit = () => {
    if (selectedZone) {
      onSave({
        segmentId,
        zoneId: selectedZone.zoneId,
        highlightBoundary,
        boundaryColor,
        fillZone,
        fillColor,
        fillOpacity,
      });
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10003]">
      <div className="bg-zinc-900 rounded-lg w-[600px] shadow-2xl border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add Zone</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search zones (e.g., TP.HCM, Quận 1)"
            className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          
          {/* Zone list */}
          <div className="border border-zinc-700 rounded max-h-[200px] overflow-y-auto">
            {loading && <div className="p-4 text-center text-zinc-500">Loading...</div>}
            {!loading && zones.length === 0 && (
              <div className="p-4 text-center text-zinc-500">No zones found</div>
            )}
            {zones.map((zone) => (
              <div
                key={zone.zoneId}
                onClick={() => setSelectedZone(zone)}
                className={`p-3 border-b border-zinc-800 last:border-b-0 cursor-pointer ${
                  selectedZone?.zoneId === zone.zoneId
                    ? 'bg-emerald-900/30 border-l-4 border-l-emerald-500'
                    : 'hover:bg-zinc-800/50'
                }`}
              >
                <div className="font-medium text-white">{zone.name}</div>
                <div className="text-xs text-zinc-500">{zone.zoneType}</div>
              </div>
            ))}
          </div>
          
          {/* Highlight config */}
          {selectedZone && (
            <div className="border border-zinc-700 rounded p-3 space-y-3">
              <h4 className="text-sm font-semibold text-white">Highlight Style</h4>
              
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={highlightBoundary}
                  onChange={(e) => setHighlightBoundary(e.target.checked)}
                />
                Boundary
              </label>
              
              {highlightBoundary && (
                <input
                  type="color"
                  value={boundaryColor}
                  onChange={(e) => setBoundaryColor(e.target.value)}
                  className="h-8 w-20 rounded"
                />
              )}
              
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={fillZone}
                  onChange={(e) => setFillZone(e.target.checked)}
                />
                Fill
              </label>
              
              {fillZone && (
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="h-8 w-20 rounded"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={fillOpacity}
                    onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="px-4 py-3 border-t border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedZone}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
