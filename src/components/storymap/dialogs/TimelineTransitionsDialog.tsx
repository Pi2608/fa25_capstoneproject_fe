"use client";

import { useState, useEffect, useRef } from "react";
import {
  TimelineTransition,
  Segment,
  CreateTransitionRequest,
  getTimelineTransitions,
  createTimelineTransition,
  generateTransition,
  deleteTimelineTransition,
} from "@/lib/api-storymap";

type TimelineTransitionsDialogProps = {
  mapId: string;
  segments: Segment[];
  onClose: () => void;
};

type DragState = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export default function TimelineTransitionsDialog({ mapId, segments, onClose }: TimelineTransitionsDialogProps) {
  const [transitions, setTransitions] = useState<TimelineTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateTransitionRequest>({
    fromSegmentId: "",
    toSegmentId: "",
    transitionName: "",
    durationMs: 3000,
    transitionType: "Ease",
    animateCamera: true,
    cameraAnimationType: "Fly",
    cameraAnimationDurationMs: 2000,
    showOverlay: false,
    overlayContent: "",
    autoTrigger: true,
    requireUserAction: false,
  });

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    const h = typeof window !== "undefined" ? window.innerHeight : 0;
    const dialogWidth = Math.min(1024, w - 40);
    const dialogHeight = Math.min(580, h - 80);
    const x = Math.max((w - dialogWidth) / 2, 20);
    const y = Math.max((h - dialogHeight) / 2, 20);
    setPosition({ x, y });
  }, []);

  useEffect(() => {
    loadTransitions();
  }, [mapId]);

  const loadTransitions = async () => {
    try {
      setLoading(true);
      const data = await getTimelineTransitions(mapId);
      setTransitions(data);
    } catch (error) {
      console.error("Failed to load transitions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.fromSegmentId || !formData.toSegmentId) {
      alert("Please select both FROM and TO segments.");
      return;
    }

    try {
      setLoading(true);
      const newTransition = await createTimelineTransition(mapId, formData);
      setTransitions([...transitions, newTransition]);
      setShowCreateForm(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create transition:", error);
      alert("Failed to create transition.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTransition = async (fromId: string, toId: string) => {
    try {
      setLoading(true);
      const newTransition = await generateTransition(mapId, fromId, toId);
      setTransitions([...transitions, newTransition]);
    } catch (error) {
      console.error("Failed to generate transition:", error);
      alert("Failed to generate transition.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (transitionId: string) => {
    if (!confirm("Delete this transition?")) return;

    try {
      setLoading(true);
      await deleteTimelineTransition(mapId, transitionId);
      setTransitions(transitions.filter(t => t.timelineTransitionId !== transitionId));
    } catch (error) {
      console.error("Failed to delete transition:", error);
      alert("Failed to delete transition.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fromSegmentId: "",
      toSegmentId: "",
      transitionName: "",
      durationMs: 3000,
      transitionType: "Ease",
      animateCamera: true,
      cameraAnimationType: "Fly",
      cameraAnimationDurationMs: 2000,
      showOverlay: false,
      overlayContent: "",
      autoTrigger: true,
      requireUserAction: false,
    });
  };

  const getSegmentName = (segmentId: string) => {
    const segment = segments.find(s => s.segmentId === segmentId);
    return segment?.name || "Unknown";
  };

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dialogRef.current) return;
    const rect = dialogRef.current.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current) return;
      const { offsetX, offsetY, width, height } = dragStateRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let nextX = e.clientX - offsetX;
      let nextY = e.clientY - offsetY;

      const margin = 16;
      const maxX = vw - width - margin;
      const maxY = vh - height - margin;

      if (nextX < margin) nextX = margin;
      if (nextY < margin) nextY = margin;
      if (nextX > maxX) nextX = maxX;
      if (nextY > maxY) nextY = maxY;

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const handleOverlayClick = () => {
    onClose();
  };

  const handleDialogClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const hasSegmentsForAuto = segments.length >= 2;
  const first = hasSegmentsForAuto ? segments[0] : undefined;
  const second = hasSegmentsForAuto ? segments[1] : undefined;

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className="absolute w-full max-w-5xl max-h-[90vh] bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
        style={{ left: position.x, top: position.y }}
        onClick={handleDialogClick}
      >
        <div
          className="px-5 py-3 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800/90 flex items-center justify-between gap-3 cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <h2 className="text-base sm:text-lg font-semibold text-white">Timeline Transitions</h2>
            </div>
            <p className="mt-1 text-[11px] sm:text-xs text-zinc-400">
              Connect segments with smooth camera moves and optional overlays.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-[46%] border-b md:border-b-0 md:border-r border-zinc-800/70 bg-zinc-950/40 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-300 uppercase tracking-[0.14em]">
                  Transitions
                </span>
                <span className="text-[11px] text-zinc-500">
                  {loading
                    ? "Loading..."
                    : transitions.length === 0
                      ? "No transitions yet"
                      : `${transitions.length} transition${transitions.length > 1 ? "s" : ""}`}
                </span>
              </div>
              {hasSegmentsForAuto && (
                <button
                  onClick={() => first && second && handleGenerateTransition(first.segmentId, second.segmentId)}
                  disabled={loading}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-sky-600/90 hover:bg-sky-500 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4zM13 13h7v7h-7zM14 4l6 6M4 14l6 6" />
                  </svg>
                  Auto-generate first pair
                </button>
              )}
            </div>

            <div className="px-4 pb-3 border-b border-zinc-800/60 md:border-b-0">
              {/* <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-medium text-white shadow-sm"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/90 text-[11px]">
                  +
                </span>
                New transition
              </button> */}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              {transitions.length === 0 && !loading && (
                <div className="mt-4 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/60 px-4 py-5 text-center text-xs text-zinc-400">
                  No transitions created yet.
                  <br />
                  Use <span className="text-emerald-400 font-medium">“New transition”</span> to get started.
                </div>
              )}

              {transitions.map(transition => (
                <div
                  key={transition.timelineTransitionId}
                  className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 px-3.5 py-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium text-white">
                          {transition.transitionName || "Unnamed transition"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                          {transition.transitionType}
                        </span>
                        {transition.animateCamera && (
                          <span className="inline-flex items-center rounded-full bg-sky-700/30 px-2 py-0.5 text-[11px] text-sky-300">
                            Camera: {transition.cameraAnimationType}
                          </span>
                        )}
                        {transition.showOverlay && (
                          <span className="inline-flex items-center rounded-full bg-amber-700/30 px-2 py-0.5 text-[11px] text-amber-300">
                            Overlay
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-300">{getSegmentName(transition.fromSegmentId)}</span>
                          <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sky-300">{getSegmentName(transition.toSegmentId)}</span>
                        </div>
                        <div>Duration: {transition.durationMs} ms</div>
                        {transition.animateCamera && (
                          <div>Camera: {transition.cameraAnimationDurationMs} ms</div>
                        )}
                        {transition.requireUserAction && (
                          <div className="text-purple-300">
                            Requires user action
                            {transition.triggerButtonText
                              ? `: "${transition.triggerButtonText}"`
                              : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(transition.timelineTransitionId)}
                      className="p-1.5 rounded-full text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-[54%] bg-zinc-950/60 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-300 uppercase tracking-[0.14em]">
                  Transition Settings
                </span>
                <span className="text-[11px] text-zinc-500">
                  Choose segments, timing and overlay behavior.
                </span>
              </div>
              {showCreateForm && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
                  Editing new transition
                </span>
              )}
            </div>

            {!showCreateForm && (
              <div className="px-4 pb-4">
                <div className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/70 px-4 py-4 text-[11px] text-zinc-400 space-y-2">
                  <p>
                    Use the panel on the left to view and manage existing transitions. When you create a new
                    transition, its settings will appear here.
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <span className="text-sm">+</span>
                    Create new transition
                  </button>
                </div>
              </div>
            )}

            {showCreateForm && (
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">From segment</label>
                      <select
                        value={formData.fromSegmentId}
                        onChange={e => setFormData({ ...formData, fromSegmentId: e.target.value })}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Select segment</option>
                        {segments.map(seg => (
                          <option key={seg.segmentId} value={seg.segmentId}>
                            {seg.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">To segment</label>
                      <select
                        value={formData.toSegmentId}
                        onChange={e => setFormData({ ...formData, toSegmentId: e.target.value })}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Select segment</option>
                        {segments.map(seg => (
                          <option key={seg.segmentId} value={seg.segmentId}>
                            {seg.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs text-zinc-400 mb-1.5">Transition name (optional)</label>
                      <input
                        type="text"
                        value={formData.transitionName}
                        onChange={e => setFormData({ ...formData, transitionName: e.target.value })}
                        placeholder="e.g. Smooth zoom to city overview"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Duration (ms)</label>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={formData.durationMs}
                        onChange={e =>
                          setFormData({ ...formData, durationMs: parseInt(e.target.value || "0", 10) })
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Transition curve</label>
                      <select
                        value={formData.transitionType}
                        onChange={e =>
                          setFormData({ ...formData, transitionType: e.target.value as any })
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Jump">Jump (instant)</option>
                        <option value="Ease">Ease</option>
                        <option value="Linear">Linear</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-4 mt-2 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        id="animateCamera"
                        type="checkbox"
                        checked={formData.animateCamera}
                        onChange={e => setFormData({ ...formData, animateCamera: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800"
                      />
                      <label htmlFor="animateCamera" className="text-xs text-zinc-300">
                        Animate camera between segments
                      </label>
                    </div>

                    {formData.animateCamera && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5">Camera animation type</label>
                          <select
                            value={formData.cameraAnimationType}
                            onChange={e =>
                              setFormData({ ...formData, cameraAnimationType: e.target.value as any })
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="Jump">Jump</option>
                            <option value="Ease">Ease</option>
                            <option value="Fly">Fly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5">
                            Camera animation duration (ms)
                          </label>
                          <input
                            type="number"
                            min={100}
                            step={100}
                            value={formData.cameraAnimationDurationMs}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                cameraAnimationDurationMs: parseInt(e.target.value || "0", 10),
                              })
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-zinc-800 pt-4 mt-2 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        id="showOverlay"
                        type="checkbox"
                        checked={formData.showOverlay}
                        onChange={e => setFormData({ ...formData, showOverlay: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800"
                      />
                      <label htmlFor="showOverlay" className="text-xs text-zinc-300">
                        Show overlay text during transition
                      </label>
                    </div>

                    {formData.showOverlay && (
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Overlay content</label>
                        <textarea
                          value={formData.overlayContent}
                          onChange={e => setFormData({ ...formData, overlayContent: e.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                          placeholder="Explain what's happening or guide the viewer..."
                        />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-zinc-800 pt-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        id="autoTrigger"
                        type="checkbox"
                        checked={formData.autoTrigger}
                        onChange={e => setFormData({ ...formData, autoTrigger: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800"
                      />
                      <label htmlFor="autoTrigger" className="text-xs text-zinc-300">
                        Auto trigger when previous segment finishes
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="requireUserAction"
                        type="checkbox"
                        checked={formData.requireUserAction}
                        onChange={e =>
                          setFormData({ ...formData, requireUserAction: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800"
                      />
                      <label htmlFor="requireUserAction" className="text-xs text-zinc-300">
                        Require user action to continue
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                    <div className="text-[11px] text-zinc-500">
                      Tip: start simple with an{" "}
                      <span className="text-emerald-300 font-medium">Ease + Fly</span> camera animation.
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowCreateForm(false);
                          resetForm();
                        }}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700/80"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={loading}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        Save transition
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-zinc-800/80 bg-zinc-950/80 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-850 px-3.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
