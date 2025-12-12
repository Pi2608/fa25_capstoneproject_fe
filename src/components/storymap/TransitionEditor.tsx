"use client";

import { useState } from "react";
import { Segment, CreateTransitionRequest, TimelineTransition, FrontendTransitionType } from "@/lib/api-storymap";
import { Button } from "@/components/ui/button";

interface TransitionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateTransitionRequest) => Promise<void>;
  segments: Segment[];
  mapId: string;
}

export default function TransitionEditor({
  isOpen,
  onClose,
  onSave,
  segments,
  mapId,
}: TransitionEditorProps) {
  const [fromSegmentId, setFromSegmentId] = useState("");
  const [toSegmentId, setToSegmentId] = useState("");
  const [transitionName, setTransitionName] = useState("");
  const [durationMs, setDurationMs] = useState(800);
  const [transitionType, setTransitionType] = useState<FrontendTransitionType>("Ease");
  const [animateCamera, setAnimateCamera] = useState(true);
  const [cameraAnimationType, setCameraAnimationType] = useState<"Jump" | "Ease" | "Fly">("Fly");
  const [cameraAnimationDurationMs, setCameraAnimationDurationMs] = useState(1500);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayContent, setOverlayContent] = useState("");
  const [autoTrigger, setAutoTrigger] = useState(true);
  const [requireUserAction, setRequireUserAction] = useState(false);
  const [triggerButtonText, setTriggerButtonText] = useState("Continue");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromSegmentId || !toSegmentId) {
      alert("Please select both from and to segments");
      return;
    }

    if (fromSegmentId === toSegmentId) {
      alert("From and To segments must be different");
      return;
    }

    setSaving(true);
    try {
      const data: CreateTransitionRequest = {
        mapId,
        fromSegmentId,
        toSegmentId,
        transitionName: transitionName.trim() || undefined,
        durationMs,
        transitionType,
        animateCamera,
        cameraAnimationType: animateCamera ? cameraAnimationType : "Jump",
        cameraAnimationDurationMs: animateCamera ? cameraAnimationDurationMs : undefined,
        showOverlay,
        overlayContent: showOverlay && overlayContent.trim() ? overlayContent : undefined,
        autoTrigger,
        requireUserAction,
      };

      await onSave(data);

      // Reset form
      setFromSegmentId("");
      setToSegmentId("");
      setTransitionName("");
      setDurationMs(800);
      setTransitionType("Ease");
      setAnimateCamera(true);
      setCameraAnimationType("Fly");
      setCameraAnimationDurationMs(1500);
      setShowOverlay(false);
      setOverlayContent("");
      setAutoTrigger(true);
      setRequireUserAction(false);
      setTriggerButtonText("Continue");

      onClose();
    } catch (error) {
      console.error("Failed to create transition:", error);
      alert("Failed to create transition. Please try again.");
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
            <h3 className="text-lg font-semibold text-white">Create Transition</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Define how the story transitions between segments
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
            {/* Segment Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  From Segment *
                </label>
                <select
                  value={fromSegmentId}
                  onChange={(e) => setFromSegmentId(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white"
                  required
                >
                  <option value="">Select segment...</option>
                  {segments.map((segment, idx) => (
                    <option key={segment.segmentId} value={segment.segmentId}>
                      {idx + 1}. {segment.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  To Segment *
                </label>
                <select
                  value={toSegmentId}
                  onChange={(e) => setToSegmentId(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white"
                  required
                >
                  <option value="">Select segment...</option>
                  {segments.map((segment, idx) => (
                    <option key={segment.segmentId} value={segment.segmentId}>
                      {idx + 1}. {segment.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transition Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Transition Name (optional)
              </label>
              <input
                type="text"
                value={transitionName}
                onChange={(e) => setTransitionName(e.target.value)}
                placeholder="e.g., Zoom to Downtown"
                className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white placeholder-zinc-500"
              />
            </div>

            {/* Transition Type */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Layer Transition Type
              </label>
              <select
                value={transitionType}
                onChange={(e) => setTransitionType(e.target.value as FrontendTransitionType)}
                className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white"
              >
                <option value="Jump">Jump (instant)</option>
                <option value="Linear">Linear (constant speed)</option>
                <option value="Ease">Ease (smooth)</option>
                <option value="EaseIn">Ease In (slow start)</option>
                <option value="EaseOut">Ease Out (slow end)</option>
                <option value="EaseInOut">Ease In Out (smooth both ends)</option>
              </select>
            </div>

            {/* Duration */}
            {transitionType !== "Jump" && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Transition Duration (ms)
                </label>
                <input
                  type="number"
                  value={durationMs}
                  onChange={(e) => setDurationMs(Number(e.target.value))}
                  min={100}
                  step={100}
                  className="w-full px-4 py-3 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-zinc-800 text-white"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {(durationMs / 1000).toFixed(1)} seconds
                </p>
              </div>
            )}

            {/* Camera Animation */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="animateCamera"
                  checked={animateCamera}
                  onChange={(e) => setAnimateCamera(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="animateCamera" className="text-sm text-zinc-300 cursor-pointer">
                  Animate Camera
                </label>
              </div>

              {animateCamera && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Camera Animation Type
                    </label>
                    <select
                      value={cameraAnimationType}
                      onChange={(e) => setCameraAnimationType(e.target.value as "Jump" | "Ease" | "Fly")}
                      className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                    >
                      <option value="Jump">Jump (instant)</option>
                      <option value="Ease">Ease (smooth pan)</option>
                      <option value="Fly">Fly (cinematic)</option>
                    </select>
                  </div>

                  {cameraAnimationType !== "Jump" && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Camera Animation Duration (ms)
                      </label>
                      <input
                        type="number"
                        value={cameraAnimationDurationMs}
                        onChange={(e) => setCameraAnimationDurationMs(Number(e.target.value))}
                        min={100}
                        step={100}
                        className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Overlay */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showOverlay"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="showOverlay" className="text-sm text-zinc-300 cursor-pointer">
                  Show Overlay Content
                </label>
              </div>

              {showOverlay && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Overlay Content
                  </label>
                  <textarea
                    value={overlayContent}
                    onChange={(e) => setOverlayContent(e.target.value)}
                    placeholder="Text to display during transition..."
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                  />
                </div>
              )}
            </div>

            {/* User Action */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requireUserAction"
                  checked={requireUserAction}
                  onChange={(e) => setRequireUserAction(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="requireUserAction" className="text-sm text-zinc-300 cursor-pointer">
                  Require User Action to Continue
                </label>
              </div>

              {requireUserAction && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={triggerButtonText}
                    onChange={(e) => setTriggerButtonText(e.target.value)}
                    placeholder="Continue"
                    className="w-full px-3 py-2 border border-zinc-600 rounded bg-zinc-800 text-white text-sm"
                  />
                </div>
              )}
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
              disabled={saving || !fromSegmentId || !toSegmentId}
            >
              {saving ? "Creating..." : "Create Transition"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
