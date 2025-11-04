"use client";

import { useState } from "react";
import {
  CameraState,
  parseCameraState,
  stringifyCameraState,
  getCurrentCameraState,
  applyCameraState,
  CreateSegmentRequest,
  Segment,
} from "@/lib/api-storymap-v2";

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
  const [summary, setSummary] = useState(editing?.summary || "");
  
  // Camera state
  const [cameraState, setCameraState] = useState<CameraState>(() => {
    if (editing?.cameraState) {
      return parseCameraState(editing.cameraState) || {
        center: [106.63, 10.82],
        zoom: 12,
        bearing: 0,
        pitch: 0,
      };
    }
    return {
      center: [106.63, 10.82],
      zoom: 12,
      bearing: 0,
      pitch: 0,
    };
  });
  
  // Playback settings
  const [autoAdvance, setAutoAdvance] = useState(editing?.autoAdvance ?? true);
  const [durationMs, setDurationMs] = useState(editing?.durationMs || 6000);
  
  const handleCaptureView = () => {
    if (currentMap) {
      const captured = getCurrentCameraState(currentMap);
      setCameraState(captured);
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
        summary,
        cameraState: stringifyCameraState(cameraState),
        playbackMode: autoAdvance ? "Auto" : "Manual",
      });
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10003]">
      <div className="bg-zinc-900 rounded-lg w-[520px] shadow-2xl border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {editing ? "Edit Segment" : "Create Segment"}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Segment Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Explore District 1"
            />
          </div>
          
          {/* Summary */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Brief description..."
            />
          </div>
          
          {/* Camera */}
          <div className="border border-zinc-700 rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Camera View</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCaptureView}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
                >
                  📷 Capture
                </button>
                <button
                  type="button"
                  onClick={handlePreviewCamera}
                  className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded"
                >
                  👁️ Preview
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-800 rounded p-2">
                <div className="text-zinc-500">Center</div>
                <div className="text-white font-mono">
                  {cameraState.center[0].toFixed(4)}, {cameraState.center[1].toFixed(4)}
                </div>
              </div>
              <div className="bg-zinc-800 rounded p-2">
                <div className="text-zinc-500">Zoom</div>
                <div className="text-white font-mono">{cameraState.zoom.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          {/* Playback */}
          <div className="border border-zinc-700 rounded p-3 space-y-3">
            <h4 className="text-sm font-semibold text-white">Playback</h4>
            
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="rounded"
              />
              Auto advance to next
            </label>
            
            {autoAdvance && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  value={durationMs / 1000}
                  onChange={(e) => setDurationMs(Math.max(1, parseInt(e.target.value) || 1) * 1000)}
                  min="1"
                  max="60"
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>
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
            disabled={!name.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            {editing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
