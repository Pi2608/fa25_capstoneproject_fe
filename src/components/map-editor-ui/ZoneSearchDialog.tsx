"use client";

import { useState, useEffect } from "react";
import { searchZones, type Zone } from "@/lib/api-storymap";
import { Icon } from "./Icon";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface ZoneSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectZone: (zone: Zone) => void;
  mapId?: string;
}

export function ZoneSearchDialog({
  open,
  onClose,
  onSelectZone,
  mapId,
}: ZoneSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setZones([]);
      setSelectedZone(null);
      return;
    }
  }, [open]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setZones([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchZones(searchQuery.trim());
      setZones(results || []);
    } catch (error) {
      console.error("Failed to search zones:", error);
      setZones([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectZone = (zone: Zone) => {
    setSelectedZone(zone);
    setConfirmModalOpen(true);
  };

  const handleConfirmSelection = () => {
    if (selectedZone) {
      onSelectZone(selectedZone);
      setConfirmModalOpen(false);
      setSelectedZone(null);
      onClose();
    }
  };

  const getGeometryType = (geometry: string): string => {
    try {
      const geoJson = JSON.parse(geometry);
      return geoJson.type || "Unknown";
    } catch {
      return "Unknown";
    }
  };

  const getGeometryIcon = (type: string): string => {
    switch (type) {
      case "Point":
        return "mdi:map-marker";
      case "LineString":
      case "MultiLineString":
        return "mdi:vector-polyline";
      case "Polygon":
      case "MultiPolygon":
        return "mdi:vector-polygon";
      default:
        return "mdi:shape";
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/80">
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
              <Icon icon="mdi:map-search" className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold leading-snug text-zinc-100">
                Search Zones
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Search for administrative zones to add to your map
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-zinc-800/80">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Icon
                  icon="mdi:magnify"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  placeholder="Enter zone name (e.g., Vietnam, Hanoi, District 1)..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isLoading || !searchQuery.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:magnify" className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="px-6 py-4 max-h-96 overflow-y-auto">
            {zones.length === 0 ? (
              <div className="text-center py-12">
                <Icon
                  icon="mdi:map-marker-question"
                  className="w-16 h-16 mx-auto mb-4 text-zinc-600"
                />
                <p className="text-sm text-zinc-400">
                  {searchQuery.trim()
                    ? "No zones found. Try a different search term."
                    : "Enter a zone name to start searching"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {zones.map((zone) => {
                  const geometryType = getGeometryType(zone.geometry);
                  return (
                    <div
                      key={zone.zoneId}
                      onClick={() => handleSelectZone(zone)}
                      className="p-4 rounded-lg border border-zinc-700/50 hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <Icon
                            icon={getGeometryIcon(geometryType)}
                            className="w-5 h-5 text-blue-400"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-zinc-100 truncate">
                            {zone.name}
                          </h4>
                          {zone.description && (
                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                              {zone.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                              {zone.zoneType}
                            </span>
                            {zone.adminLevel !== undefined && (
                              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                                Level {zone.adminLevel}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                              {geometryType}
                            </span>
                            {zone.zoneCode && (
                              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                                {zone.zoneCode}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Icon
                            icon="mdi:plus-circle"
                            className="w-6 h-6 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedZone && (
        <ConfirmModal
          open={confirmModalOpen}
          onOpenChange={setConfirmModalOpen}
          title="Add Zone to Map"
          description={`Do you want to add "${selectedZone.name}" (${selectedZone.zoneType}) to your map as a feature?`}
          confirmText="Add to Map"
          cancelText="Cancel"
          onConfirm={handleConfirmSelection}
          variant="info"
        />
      )}
    </>
  );
}
