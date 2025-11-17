"use client";

import { useState, useEffect } from "react";
import { Segment, CreateSegmentRequest, CameraState } from "@/lib/api-storymap";
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
          const parsed = typeof editing.cameraState === 'string'
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
              {editing ? "Update segment details" : "Add a new scene to your story map"}
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

        {/* Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-180px)]">
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            {/* Name */}
            <InputField
              label="Segment Name *"
              value={name}
              onChange={setName}
              placeholder="e.g., Introduction, Historical Context, Key Locations"
              required
            />

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
                  <div>Center: [{cameraState.center[0].toFixed(4)}, {cameraState.center[1].toFixed(4)}]</div>
                  <div>Zoom: {cameraState.zoom.toFixed(2)}</div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No camera position set. Click "Capture Current View" to set.</p>
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
                <label htmlFor="autoAdvance" className="text-sm text-zinc-300 cursor-pointer">
                  Auto-advance to next segment
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requireUserAction"
                  checked={requireUserAction}
                  onChange={(e) => setRequireUserAction(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                />
                <label htmlFor="requireUserAction" className="text-sm text-zinc-300 cursor-pointer">
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
            <Button
              type="submit"
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : editing ? "Update Segment" : "Create Segment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
