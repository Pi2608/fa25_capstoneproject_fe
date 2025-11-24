"use client";

import { useState, useEffect } from "react";
import { CreateLocationRequest, Location } from "@/lib/api-storymap";
import { LocationType } from "@/types/location";
import { Button } from "@/components/ui/button";
import InputField from "@/components/ui/InputField";

interface LocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateLocationRequest) => Promise<void>;
  segmentId: string;
  currentMap?: any; // Leaflet map instance
  initialCoordinates?: [number, number] | null; // Pre-picked coordinates
  initialLocation?: Location | null; // For editing existing location
  waitingForLocation?: boolean;
  setWaitingForLocation?: (waiting: boolean) => void;
}

export default function LocationDialog({
  isOpen,
  onClose,
  onSave,
  segmentId,
  currentMap,
  initialCoordinates,
  initialLocation,
  waitingForLocation,
  setWaitingForLocation,
}: LocationDialogProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("PointOfInterest");
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);

  // Icon settings
  const [iconType, setIconType] = useState("📍");
  const [iconUrl, setIconUrl] = useState("");
  const [iconColor, setIconColor] = useState("#FF0000");
  const [iconSize, setIconSize] = useState(32);

  // Display settings
  const [showTooltip, setShowTooltip] = useState(true);
  const [tooltipContent, setTooltipContent] = useState("");
  const [openPopupOnClick, setOpenPopupOnClick] = useState(true);
  const [popupContent, setPopupContent] = useState("");

  // Media
  const [mediaUrls, setMediaUrls] = useState("");
  const [playAudioOnClick, setPlayAudioOnClick] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens or load initial location for editing
  useEffect(() => {
    if (isOpen) {
      if (initialLocation) {
        // Edit mode: load existing location data
        setTitle(initialLocation.title || "");
        setSubtitle(initialLocation.subtitle || "");
        setDescription(initialLocation.description || "");
        setLocationType(initialLocation.locationType || "PointOfInterest");
        
        // Parse marker geometry for coordinates
        if (initialLocation.markerGeometry) {
          try {
            const geoJson = JSON.parse(initialLocation.markerGeometry);
            if (geoJson.type === "Point" && geoJson.coordinates) {
              setCoordinates(geoJson.coordinates as [number, number]);
            }
          } catch (e) {
            console.error("Failed to parse marker geometry:", e);
          }
        }
        
        setIconType(initialLocation.iconType || "📍");
        setIconUrl(initialLocation.iconUrl || "");
        setIconColor(initialLocation.iconColor || "#FF0000");
        setIconSize(initialLocation.iconSize || 32);
        setShowTooltip(initialLocation.showTooltip ?? true);
        setTooltipContent(initialLocation.tooltipContent || "");
        setOpenPopupOnClick(initialLocation.openPopupOnClick ?? false);
        setPopupContent(initialLocation.popupContent || "");
        setMediaUrls(initialLocation.mediaUrls || "");
        setPlayAudioOnClick(initialLocation.playAudioOnClick ?? false);
        setAudioUrl(initialLocation.audioUrl || "");
        setExternalUrl(initialLocation.externalUrl || "");
      } else {
        // Create mode: reset form
        setTitle("");
        setSubtitle("");
        setDescription("");
        setLocationType("PointOfInterest");
        // Use initialCoordinates if provided, otherwise null
        setCoordinates(initialCoordinates || null);
        setIconType("📍");
        setIconUrl("");
        setIconColor("#FF0000");
        setIconSize(32);
        setShowTooltip(true);
        setTooltipContent("");
        setOpenPopupOnClick(true);
        setPopupContent("");
        setMediaUrls("");
        setPlayAudioOnClick(false);
        setAudioUrl("");
        setExternalUrl("");
      }
    }
  }, [isOpen, initialCoordinates, initialLocation]);

  // Show temporary marker when coordinates are set
  useEffect(() => {
    if (!currentMap || !isOpen || !coordinates) return;

    const L = (window as any).L;
    if (!L) return;

    const [lng, lat] = coordinates;
    const tempMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'temp-location-marker',
        html: '<div style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">📍</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      }),
    });
    tempMarker.addTo(currentMap);

    return () => {
      currentMap.removeLayer(tempMarker);
    };
  }, [currentMap, isOpen, coordinates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Please enter a location title");
      return;
    }

    if (!coordinates) {
      alert("Please select a location on the map or enter coordinates");
      return;
    }

    setSaving(true);
    try {
      // Create GeoJSON Point
      const markerGeometry = JSON.stringify({
        type: "Point",
        coordinates: coordinates, // [lng, lat]
      });

      const data: CreateLocationRequest = {
        segmentId,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        locationType,
        markerGeometry,
        iconType: iconType || undefined,
        iconUrl: iconUrl.trim() || undefined,
        iconColor,
        iconSize,
        displayOrder: 0,
        highlightOnEnter: false,
        showTooltip,
        tooltipContent: tooltipContent.trim() || title.trim(),
        openPopupOnClick,
        popupContent: popupContent.trim() || description.trim() || undefined,
        mediaUrls: mediaUrls.trim() || undefined,
        playAudioOnClick,
        audioUrl: audioUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        isVisible: true,
        zIndex: 100,
      };

      await onSave(data);
      onClose();
    } catch (error) {
      console.error("Failed to save location:", error);
      alert("Failed to save location. Please try again.");
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
            <h3 className="text-lg font-semibold text-white">
              {initialLocation ? "Edit Location/POI" : "Add Location/POI"}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              Add a point of interest or marker to this segment
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
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Title *"
                value={title}
                onChange={setTitle}
                placeholder="Location name"
                required
              />
              <InputField
                label="Subtitle"
                value={subtitle}
                onChange={setSubtitle}
                placeholder="Brief tagline"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description"
                rows={2}
                className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white placeholder-zinc-500"
              />
            </div>

            {/* Location Type */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Location Type
              </label>
              <select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
                className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white"
              >
                <option value="PointOfInterest">Point of Interest</option>
                <option value="MediaSpot">Media Spot</option>
                <option value="TextOnly">Text Only</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {/* Coordinates */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Location Coordinates *
              </label>
              {coordinates ? (
                <div className="text-xs text-zinc-400 font-mono bg-zinc-900 rounded px-3 py-2">
                  Lng: {coordinates[0].toFixed(6)}, Lat: {coordinates[1].toFixed(6)}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">
                  No coordinates selected. Please pick a location on the map first.
                </p>
              )}
            </div>

            {/* Icon Settings */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-white text-sm">Icon Settings</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Icon Emoji/Text</label>
                  <input
                    type="text"
                    value={iconType}
                    onChange={(e) => setIconType(e.target.value)}
                    placeholder="📍"
                    className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Icon URL (optional)</label>
                  <input
                    type="text"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Icon Color</label>
                  <input
                    type="color"
                    value={iconColor}
                    onChange={(e) => setIconColor(e.target.value)}
                    className="w-full h-9 rounded border border-zinc-600 bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Icon Size (px)</label>
                  <input
                    type="number"
                    value={iconSize}
                    onChange={(e) => setIconSize(Number(e.target.value))}
                    min={16}
                    max={64}
                    className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Tooltip & Popup */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showTooltip"
                  checked={showTooltip}
                  onChange={(e) => setShowTooltip(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="showTooltip" className="text-sm text-zinc-300 cursor-pointer">
                  Show Tooltip (label above marker)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="openPopupOnClick"
                  checked={openPopupOnClick}
                  onChange={(e) => setOpenPopupOnClick(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="openPopupOnClick" className="text-sm text-zinc-300 cursor-pointer">
                  Open popup on click
                </label>
              </div>

              {openPopupOnClick && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Popup Content (HTML supported)</label>
                  <textarea
                    value={popupContent}
                    onChange={(e) => setPopupContent(e.target.value)}
                    placeholder="Rich content for popup..."
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm font-mono"
                  />
                </div>
              )}
            </div>

            {/* Media */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Media URLs (one per line)
                </label>
                <textarea
                  value={mediaUrls}
                  onChange={(e) => setMediaUrls(e.target.value)}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  rows={2}
                  className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm font-mono"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="playAudioOnClick"
                  checked={playAudioOnClick}
                  onChange={(e) => setPlayAudioOnClick(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="playAudioOnClick" className="text-sm text-zinc-300 cursor-pointer">
                  Play audio on click
                </label>
              </div>

              {playAudioOnClick && (
                <input
                  type="text"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="Audio URL"
                  className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                />
              )}

              <div>
                <label className="block text-xs text-zinc-400 mb-1">External Link URL</label>
                <input
                  type="text"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                />
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
            <Button
              type="submit"
              disabled={saving || !title.trim() || !coordinates}
            >
              {saving ? (initialLocation ? "Saving..." : "Adding...") : (initialLocation ? "Save Changes" : "Add Location")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
