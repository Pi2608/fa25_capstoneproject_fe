"use client";

import { useState, useEffect } from "react";
import {
  Segment,
  CreateSegmentRequest,
  CameraState,
  Location,
  searchLocations,
} from "@/lib/api-storymap";
import { Button } from "@/components/ui/button";
import InputField from "@/components/ui/InputField";

interface SegmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateSegmentRequest) => Promise<void>;
  editing?: Segment;
  currentMap?: any; // Leaflet map instance
}

export default function SegmentDialog({
  isOpen,
  onClose,
  onSave,
  editing,
  currentMap,
}: SegmentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [storyContent, setStoryContent] = useState("");
  const [durationMs, setDurationMs] = useState(5000);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [requireUserAction, setRequireUserAction] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState | null>(null);
  const [saving, setSaving] = useState(false);

  // --- LOCATION SEARCH STATE ---
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<Location[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  // Load editing data
  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description || "");
      setStoryContent(editing.storyContent || "");
      setDurationMs(editing.durationMs);
      setAutoAdvance(editing.autoAdvance);
      setRequireUserAction(editing.requireUserAction);

      // Parse camera state
      if (editing.cameraState) {
        try {
          const parsed =
            typeof editing.cameraState === "string"
              ? JSON.parse(editing.cameraState)
              : editing.cameraState;
          setCameraState(parsed);
        } catch (e) {
          console.warn("Failed to parse camera state:", e);
        }
      }
    } else {
      // Reset for new segment
      setName("");
      setDescription("");
      setStoryContent("");
      setDurationMs(5000);
      setAutoAdvance(true);
      setRequireUserAction(false);
      setCameraState(null);
      setSelectedLocation(null);
      setLocationQuery("");
      setLocationResults([]);
    }
  }, [editing, isOpen]);

  const handleCaptureCamera = () => {
    if (!currentMap) {
      alert("No map instance available. Please ensure map is loaded.");
      return;
    }

    try {
      const center = currentMap.getCenter();
      const zoom = currentMap.getZoom();

      const newCameraState: CameraState = {
        center: [center.lng, center.lat],
        zoom: zoom,
        bearing: 0,
        pitch: 0,
      };

      setCameraState(newCameraState);
      alert("Camera position captured!");
    } catch (error) {
      console.error("Failed to capture camera:", error);
      alert("Failed to capture camera position");
    }
  };

  // --- HELPER: get center from markerGeometry (Point / Polygon) ---
  function getCenterFromGeometry(markerGeometry?: string): [number, number] | null {
    if (!markerGeometry) return null;

    try {
      const geo = JSON.parse(markerGeometry);

      // Point: [lng, lat]
      if (geo.type === "Point" && Array.isArray(geo.coordinates)) {
        const [lng, lat] = geo.coordinates as [number, number];
        return [lng, lat];
      }

      // Polygon: lấy trung bình các điểm của outer ring
      if (geo.type === "Polygon" && Array.isArray(geo.coordinates)) {
        const ring = geo.coordinates[0];
        if (!ring || !ring.length) return null;

        let sumLng = 0;
        let sumLat = 0;

        for (const coord of ring) {
          if (!Array.isArray(coord) || coord.length < 2) continue;
          const [lng, lat] = coord as [number, number];
          sumLng += lng;
          sumLat += lat;
        }

        const n = ring.length;
        if (n === 0) return null;
        return [sumLng / n, sumLat / n];
      }

      return null;
    } catch (e) {
      console.error("Failed to parse markerGeometry", e);
      return null;
    }
  }

  // --- SEARCH LOCATION ---
  const handleSearchLocation = async () => {
    const term = locationQuery.trim();
    if (!term) return;

    try {
      setSearchingLocation(true);
      const results = await searchLocations(term);
      setLocationResults(results || []);
    } catch (error) {
      console.error("Failed to search locations:", error);
      alert("Search location failed. Please try again.");
    } finally {
      setSearchingLocation(false);
    }
  };

  // --- SELECT LOCATION: move map + set camera ---
  const handleSelectLocation = (loc: Location) => {
    setSelectedLocation(loc);

    // auto-fill name nếu đang trống
    if (!name.trim()) {
      setName(loc.title);
    }

    const center = getCenterFromGeometry(loc.markerGeometry);
    if (!center) return;

    const [lng, lat] = center;

    // Move map (Leaflet style)
    if (currentMap && typeof currentMap.flyTo === "function") {
      const currentZoom = currentMap.getZoom ? currentMap.getZoom() : 8;
      currentMap.flyTo([lat, lng], currentZoom || 8);
    }

    // Set camera state luôn cho segment
    const newCameraState: CameraState = {
      center: [lng, lat],
      zoom: currentMap && currentMap.getZoom ? currentMap.getZoom() : 8,
      bearing: 0,
      pitch: 0,
    };
    setCameraState(newCameraState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a segment name");
      return;
    }

    setSaving(true);
    try {
      const data: CreateSegmentRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        storyContent: storyContent.trim() || undefined,
        durationMs,
        autoAdvance,
        requireUserAction,
        cameraState: cameraState ? JSON.stringify(cameraState) : undefined,
        playbackMode: autoAdvance ? "Auto" : "Manual",
      };

      await onSave(data);
      onClose();
    } catch (error) {
      console.error("Failed to save segment:", error);
      alert("Failed to save segment. Please try again.");
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
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {editing ? "Edit Segment" : "Create New Segment"}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              {editing
                ? "Update segment details"
                : "Add a new scene to your story map"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body - Scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col max-h-[calc(90vh-180px)]"
        >
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            {/* Name */}
            <InputField
              label="Segment Name *"
              value={name}
              onChange={setName}
              placeholder="e.g., Ha Noi – Start, Da Nang – Destination"
              required
            />

            {/* LOCATION SEARCH BLOCK */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">
                  Search Location for this Segment
                </label>
                {selectedLocation && (
                  <span className="text-[11px] text-emerald-400">
                    Using: {selectedLocation.title}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Type a place name, e.g. Ha Noi, Da Nang..."
                  className="flex-1 px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchLocation();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleSearchLocation}
                  size="sm"
                  disabled={searchingLocation || !locationQuery.trim()}
                >
                  {searchingLocation ? "Searching..." : "Search"}
                </Button>
              </div>

              {locationResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                  {locationResults.map((loc) => (
                    <button
                      key={loc.poiId}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs border ${
                        selectedLocation?.poiId === loc.poiId
                          ? "bg-zinc-900 border-emerald-500"
                          : "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                      }`}
                    >
                      <div className="font-medium text-zinc-100">
                        {loc.title}
                      </div>
                      {loc.subtitle && (
                        <div className="text-[11px] text-zinc-400">
                          {loc.subtitle}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {locationResults.length === 0 && !searchingLocation && (
                <p className="text-[11px] text-zinc-500">
                  Type a keyword and click Search to find locations (DB &amp;
                  OSM).
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this segment"
                rows={2}
                className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors bg-zinc-800 text-white placeholder-zinc-500"
              />
            </div>

            {/* Story Content */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Story Content
              </label>
              <textarea
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
                placeholder="Rich text content for narration (supports markdown)"
                rows={4}
                className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors bg-zinc-800 text-white placeholder-zinc-500 font-mono text-sm"
              />
            </div>

            {/* Camera State */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300">
                  Camera Position
                </label>
                <Button
                  type="button"
                  onClick={handleCaptureCamera}
                  size="sm"
                  variant="outline"
                  disabled={!currentMap}
                >
                  📷 Capture Current View
                </Button>
              </div>
              {cameraState ? (
                <div className="text-xs text-zinc-400 font-mono bg-zinc-900 rounded px-3 py-2">
                  <div>
                    Center: [{cameraState.center[0].toFixed(4)},{" "}
                    {cameraState.center[1].toFixed(4)}]
                  </div>
                  <div>Zoom: {cameraState.zoom.toFixed(2)}</div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No camera position set. Search a location or click "Capture
                  Current View" to set.
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Duration (milliseconds)
              </label>
              <input
                type="number"
                value={durationMs}
                onChange={(e) => setDurationMs(Number(e.target.value))}
                min={1000}
                step={1000}
                className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors bg-zinc-800 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {(durationMs / 1000).toFixed(1)} seconds
              </p>
            </div>

            {/* Playback Options */}
            <div className="space-y-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoAdvance"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                />
                <label
                  htmlFor="autoAdvance"
                  className="text-sm text-zinc-300 cursor-pointer"
                >
                  Auto-advance to next segment
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requireUserAction"
                  checked={requireUserAction}
                  onChange={(e) =>
                    setRequireUserAction(e.target.checked)
                  }
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                />
                <label
                  htmlFor="requireUserAction"
                  className="text-sm text-zinc-300 cursor-pointer"
                >
                  Require user action to continue
                </label>
              </div>
            </div>
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
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving
                ? "Saving..."
                : editing
                ? "Update Segment"
                : "Create Segment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
