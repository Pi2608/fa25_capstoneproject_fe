"use client";

import { useEffect, useRef, useState } from "react";
import {
  CameraState,
  parseCameraState,
  stringifyCameraState,
  getCurrentCameraState,
  applyCameraState,
  CreateSegmentRequest,
  Segment,
} from "@/lib/api-storymap";

interface SegmentDialogProps {
  editing?: Segment;
  currentMap?: any;
  onClose: () => void;
  onSave: (data: CreateSegmentRequest) => void;
}

export default function SegmentDialog({
  editing,
  currentMap,
  onClose,
  onSave,
}: SegmentDialogProps) {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");

  const [cameraState, setCameraState] = useState<CameraState>(() => {
    if (editing?.cameraState) {
      if (typeof editing.cameraState === "string") {
        const parsed = parseCameraState(editing.cameraState);
        if (parsed) return parsed;
      } else if (editing.cameraState && typeof editing.cameraState === "object") {
        return editing.cameraState as CameraState;
      }
    }
    if (currentMap) {
      try {
        const current = getCurrentCameraState(currentMap);
        if (current) return current;
      } catch (error) {
        console.warn("Failed to get current camera state:", error);
      }
    }
    return {
      center: [106.63, 10.82],
      zoom: 12,
      bearing: 0,
      pitch: 0,
    };
  });

  const [autoAdvance, setAutoAdvance] = useState(editing?.autoAdvance ?? true);
  const [durationMs, setDurationMs] = useState(editing?.durationMs || 6000);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const center = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    setPosition(center);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      setPosition(prev => {
        if (!prev) return prev;
        return {
          x: e.clientX - dragOffsetRef.current.dx,
          y: e.clientY - dragOffsetRef.current.dy,
        };
      });
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!position) return;
    e.preventDefault();
    dragOffsetRef.current = {
      dx: e.clientX - position.x,
      dy: e.clientY - position.y,
    };
    setIsDragging(true);
  };

  const handleCaptureView = () => {
    if (!currentMap) {
      console.warn("No map instance available for capture");
      return;
    }
    if (typeof currentMap.getCenter !== "function" || typeof currentMap.getZoom !== "function") {
      console.error("Invalid map instance - missing required methods");
      return;
    }
    try {
      const captured = getCurrentCameraState(currentMap);
      if (captured) {
        setCameraState(captured);
      }
    } catch (error) {
      console.error("Failed to capture camera state:", error);
    }
  };

  const handlePreviewCamera = () => {
    if (currentMap) {
      applyCameraState(currentMap, cameraState, { duration: 1000 });
    }
  };

  const handleSubmit = () => {
    if (name.trim()) {
      onSave({
        name,
        description,
        cameraState: stringifyCameraState(cameraState),
        playbackMode: autoAdvance ? "Auto" : "Manual",
      });
    }
  };

  if (!position) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10003] bg-black/55">
      <div
        className="absolute"
        style={{ top: position.y, left: position.x, transform: "translate(-50%, -50%)" }}
      >
        <div className="w-[540px] max-w-[92vw] max-h-[80vh] bg-zinc-900/98 border border-zinc-800 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden backdrop-blur">
          <div
            className="px-5 pt-3 pb-2 border-b border-zinc-800 cursor-move select-none"
            onMouseDown={handleHeaderMouseDown}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-emerald-400 mb-0.5">
                  Storymap timeline
                </div>
                <h3 className="text-base font-semibold text-white leading-tight">
                  {editing ? "Edit segment" : "Create segment"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Segment name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                placeholder="e.g., Explore District 1"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80 resize-none"
                placeholder="Brief description..."
              />
            </div>

            <div className="border border-zinc-700/80 rounded-xl px-3.5 py-3 space-y-3 bg-zinc-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">Camera view</h4>
                  <p className="text-[11px] text-zinc-400">
                    Use current map position as segment start.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureView}
                    className="px-3 py-1.5 text-xs rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium inline-flex items-center gap-1"
                  >
                    <span>📷</span>
                    <span>Capture</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePreviewCamera}
                    className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 inline-flex items-center gap-1"
                  >
                    <span>👁️</span>
                    <span>Preview</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-800 rounded-lg px-3 py-2.5">
                  <div className="text-zinc-500 mb-0.5 text-[11px]">Center</div>
                  <div className="text-white font-mono text-[13px]">
                    {cameraState.center[0].toFixed(4)}, {cameraState.center[1].toFixed(4)}
                  </div>
                </div>
                <div className="bg-zinc-800 rounded-lg px-3 py-2.5">
                  <div className="text-zinc-500 mb-0.5 text-[11px]">Zoom</div>
                  <div className="text-white font-mono text-[13px]">
                    {cameraState.zoom.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-zinc-700/80 rounded-xl px-3.5 py-3 space-y-3 bg-zinc-900/60">
              <div>
                <h4 className="text-sm font-semibold text-white">Playback</h4>
                <p className="text-[11px] text-zinc-400">
                  Control how long this segment is visible in the story.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={e => setAutoAdvance(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                />
                Auto advance to next segment
              </label>

              {autoAdvance && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Duration (seconds)</label>
                  <input
                    type="number"
                    value={durationMs / 1000}
                    onChange={e =>
                      setDurationMs(Math.max(1, parseInt(e.target.value) || 1) * 1000)
                    }
                    min={1}
                    max={60}
                    className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/80"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    This controls only the playback timing in the timeline.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">
              You can adjust these settings later from the Storymap timeline.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
