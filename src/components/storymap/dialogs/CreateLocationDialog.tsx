"use client";

import { useState, useEffect } from "react";

interface CreateLocationDialogProps {
  segmentId: string;
  currentMap?: any; // Leaflet map instance
  onClose: () => void;
  onSave: (data: CreateLocationRequest) => Promise<void>;
}

export type CreateLocationRequest = {
  segmentId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  locationType: "POI" | "Marker" | "Annotation";
  markerGeometry: string; // GeoJSON Point
  iconType?: string;
  iconUrl?: string;
  iconColor?: string;
  iconSize?: number;
  displayOrder?: number;
  showTooltip?: boolean;
  tooltipContent?: string;
  openPopupOnClick?: boolean;
  popupContent?: string;
  isVisible?: boolean;
  zIndex?: number;
};

export default function CreateLocationDialog({ 
  segmentId, 
  currentMap, 
  onClose, 
  onSave 
}: CreateLocationDialogProps) {
  const [step, setStep] = useState<"selectLocation" | "configure">("selectLocation");
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
  const [tempMarker, setTempMarker] = useState<any>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<"POI" | "Marker" | "Annotation">("POI");
  const [iconType, setIconType] = useState("📍");
  const [iconColor, setIconColor] = useState("#FF0000");
  const [iconSize, setIconSize] = useState(32);
  const [showTooltip, setShowTooltip] = useState(true);
  const [tooltipContent, setTooltipContent] = useState("");
  const [openPopupOnClick, setOpenPopupOnClick] = useState(true);
  const [popupContent, setPopupContent] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [zIndex, setZIndex] = useState(100);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Enable map click to select location
  useEffect(() => {
    if (!currentMap || step !== "selectLocation") return;

    const handleMapClick = async (e: any) => {
      const { lat, lng } = e.latlng;
      setSelectedPoint([lat, lng]);

      // Import Leaflet dynamically
      const L = (await import("leaflet")).default;

      // Remove previous temp marker
      if (tempMarker) {
        currentMap.removeLayer(tempMarker);
      }

      // Add temporary marker at clicked location
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "temp-location-marker",
          html: `<div style="
            font-size: 32px;
            text-align: center;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          ">📍</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        }),
      });
      marker.addTo(currentMap);
      setTempMarker(marker);
    };

    currentMap.on("click", handleMapClick);

    return () => {
      currentMap.off("click", handleMapClick);
      if (tempMarker) {
        currentMap.removeLayer(tempMarker);
      }
    };
  }, [currentMap, step, tempMarker]);

  const handleNext = () => {
    if (!selectedPoint) {
      alert("Please click on the map to select a location");
      return;
    }
    setStep("configure");
  };

  const handleBack = () => {
    setStep("selectLocation");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoint) return;

    setSaving(true);
    try {
      const geoJson = {
        type: "Point",
        coordinates: [selectedPoint[1], selectedPoint[0]], // [lng, lat]
      };

      await onSave({
        segmentId,
        title,
        subtitle: subtitle || undefined,
        description: description || undefined,
        locationType,
        markerGeometry: JSON.stringify(geoJson),
        iconType,
        iconColor,
        iconSize,
        displayOrder,
        showTooltip,
        tooltipContent: tooltipContent || title,
        openPopupOnClick,
        popupContent: popupContent || description,
        isVisible,
        zIndex,
      });

      // Cleanup temp marker
      if (tempMarker && currentMap) {
        currentMap.removeLayer(tempMarker);
      }

      onClose();
    } catch (error) {
      console.error("Failed to create location:", error);
      alert("Failed to create location");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Cleanup temp marker
    if (tempMarker && currentMap) {
      currentMap.removeLayer(tempMarker);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Semi-transparent overlay on the right side only when selecting location */}
      {step === "selectLocation" && (
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      )}
      
      {/* Dialog positioned on the left side */}
      <div className="absolute left-4 top-4 bottom-4 w-96 bg-zinc-900 rounded-lg shadow-xl overflow-hidden flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">
            {step === "selectLocation" ? "Select Location" : "Configure Location"}
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === "selectLocation" ? (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-500/50 rounded p-4">
                <p className="text-blue-300 text-sm">
                  🗺️ Click anywhere on the map to place your location marker
                </p>
              </div>

              {selectedPoint && (
                <div className="bg-emerald-900/20 border border-emerald-500/50 rounded p-4">
                  <p className="text-emerald-300 text-sm mb-2">
                    ✅ Location selected:
                  </p>
                  <p className="text-zinc-300 text-xs font-mono">
                    Lat: {selectedPoint[0].toFixed(6)}, Lng: {selectedPoint[1].toFixed(6)}
                  </p>
                </div>
              )}

              <div className="text-center text-zinc-500 text-sm py-8">
                {selectedPoint 
                  ? "Click 'Next' to configure the location" 
                  : "Waiting for you to click on the map..."}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  placeholder="Location name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  placeholder="Brief subtitle"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  rows={3}
                  placeholder="Detailed description"
                />
              </div>

              {/* Location Type */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Location Type
                </label>
                <div className="flex gap-2">
                  {(["POI", "Marker", "Annotation"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLocationType(type)}
                      className={`flex-1 px-3 py-2 rounded text-sm ${
                        locationType === type
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marker Style */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={iconType}
                    onChange={(e) => setIconType(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-center text-2xl"
                    placeholder="📍"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={iconColor}
                    onChange={(e) => setIconColor(e.target.value)}
                    className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Icon Size: {iconSize}px
                </label>
                <input
                  type="range"
                  min="16"
                  max="64"
                  value={iconSize}
                  onChange={(e) => setIconSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Tooltip */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={showTooltip}
                    onChange={(e) => setShowTooltip(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-zinc-300">Show Tooltip</span>
                </label>
                {showTooltip && (
                  <input
                    type="text"
                    value={tooltipContent}
                    onChange={(e) => setTooltipContent(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    placeholder="Tooltip text (defaults to title)"
                  />
                )}
              </div>

              {/* Popup */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={openPopupOnClick}
                    onChange={(e) => setOpenPopupOnClick(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-zinc-300">Open Popup on Click</span>
                </label>
                {openPopupOnClick && (
                  <textarea
                    value={popupContent}
                    onChange={(e) => setPopupContent(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    rows={2}
                    placeholder="Popup content (defaults to description)"
                  />
                )}
              </div>

              {/* Display Settings */}
              <div className="border-t border-zinc-700 pt-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Display Settings</h3>
                
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                  />
                  <span className="text-sm text-zinc-300">Visible</span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-1">
                      Z-Index
                    </label>
                    <input
                      type="number"
                      value={zIndex}
                      onChange={(e) => setZIndex(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-300 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between p-4 border-t border-zinc-700">
          {step === "configure" && (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-zinc-300 hover:text-white"
              disabled={saving}
            >
              ← Back
            </button>
          )}
          
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-zinc-300 hover:text-white"
              disabled={saving}
            >
              Cancel
            </button>
            
            {step === "selectLocation" ? (
              <button
                onClick={handleNext}
                disabled={!selectedPoint}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!title || saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Creating..." : "Create Location"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
