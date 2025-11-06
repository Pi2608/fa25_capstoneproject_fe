"use client";

import { useState, useEffect } from "react";
import { TimelineTransition, Segment, CreateTransitionRequest, getTimelineTransitions, createTimelineTransition, generateTransition, deleteTimelineTransition } from "@/lib/api-storymap";

type TimelineTransitionsDialogProps = {
  mapId: string;
  segments: Segment[];
  onClose: () => void;
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
      alert("Please select both from and to segments");
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
      alert("Failed to create transition");
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
      alert("Failed to generate transition");
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
      alert("Failed to delete transition");
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Timeline Transitions</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && !showCreateForm ? (
            <div className="text-center text-zinc-500 py-8">Loading...</div>
          ) : (
            <>
              {/* Create button */}
              {!showCreateForm && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                  >
                    + Create Transition
                  </button>
                </div>
              )}

              {/* Create form */}
              {showCreateForm && (
                <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
                  <h3 className="text-white font-medium mb-4">Create New Transition</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* From Segment */}
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">From Segment</label>
                      <select
                        value={formData.fromSegmentId}
                        onChange={(e) => setFormData({ ...formData, fromSegmentId: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Select segment</option>
                        {segments.map(seg => (
                          <option key={seg.segmentId} value={seg.segmentId}>{seg.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* To Segment */}
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">To Segment</label>
                      <select
                        value={formData.toSegmentId}
                        onChange={(e) => setFormData({ ...formData, toSegmentId: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Select segment</option>
                        {segments.map(seg => (
                          <option key={seg.segmentId} value={seg.segmentId}>{seg.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Transition Name */}
                    <div className="col-span-2">
                      <label className="block text-sm text-zinc-400 mb-1">Transition Name (optional)</label>
                      <input
                        type="text"
                        value={formData.transitionName}
                        onChange={(e) => setFormData({ ...formData, transitionName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                        placeholder="e.g., 'Smooth transition to overview'"
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Duration (ms)</label>
                      <input
                        type="number"
                        value={formData.durationMs}
                        onChange={(e) => setFormData({ ...formData, durationMs: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                        min={100}
                        step={100}
                      />
                    </div>

                    {/* Transition Type */}
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Transition Type</label>
                      <select
                        value={formData.transitionType}
                        onChange={(e) => setFormData({ ...formData, transitionType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="Jump">Jump</option>
                        <option value="Ease">Ease</option>
                        <option value="Linear">Linear</option>
                      </select>
                    </div>

                    {/* Animate Camera */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.animateCamera}
                        onChange={(e) => setFormData({ ...formData, animateCamera: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label className="text-sm text-zinc-400">Animate Camera</label>
                    </div>

                    {/* Camera Animation Type */}
                    {formData.animateCamera && (
                      <>
                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">Camera Animation Type</label>
                          <select
                            value={formData.cameraAnimationType}
                            onChange={(e) => setFormData({ ...formData, cameraAnimationType: e.target.value as any })}
                            className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="Jump">Jump</option>
                            <option value="Ease">Ease</option>
                            <option value="Fly">Fly</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">Camera Animation Duration (ms)</label>
                          <input
                            type="number"
                            value={formData.cameraAnimationDurationMs}
                            onChange={(e) => setFormData({ ...formData, cameraAnimationDurationMs: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                            min={100}
                            step={100}
                          />
                        </div>
                      </>
                    )}

                    {/* Show Overlay */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.showOverlay}
                        onChange={(e) => setFormData({ ...formData, showOverlay: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label className="text-sm text-zinc-400">Show Overlay</label>
                    </div>

                    {/* Overlay Content */}
                    {formData.showOverlay && (
                      <div className="col-span-2">
                        <label className="block text-sm text-zinc-400 mb-1">Overlay Content</label>
                        <textarea
                          value={formData.overlayContent}
                          onChange={(e) => setFormData({ ...formData, overlayContent: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 focus:border-emerald-500 focus:outline-none"
                          rows={3}
                          placeholder="Content to show during transition"
                        />
                      </div>
                    )}

                    {/* Auto Trigger */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.autoTrigger}
                        onChange={(e) => setFormData({ ...formData, autoTrigger: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label className="text-sm text-zinc-400">Auto Trigger</label>
                    </div>

                    {/* Require User Action */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.requireUserAction}
                        onChange={(e) => setFormData({ ...formData, requireUserAction: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label className="text-sm text-zinc-400">Require User Action</label>
                    </div>
                  </div>

                  {/* Form actions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleCreate}
                      disabled={loading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        resetForm();
                      }}
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Transitions list */}
              <div className="space-y-3">
                {transitions.length === 0 ? (
                  <div className="text-center text-zinc-500 py-8">
                    No transitions created yet
                  </div>
                ) : (
                  transitions.map((transition) => (
                    <div key={transition.timelineTransitionId} className="p-4 bg-zinc-800 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-white font-medium">
                              {transition.transitionName || "Unnamed Transition"}
                            </span>
                            <span className="px-2 py-1 bg-zinc-700 text-xs text-zinc-400 rounded">
                              {transition.transitionType}
                            </span>
                            {transition.animateCamera && (
                              <span className="px-2 py-1 bg-blue-600/20 text-xs text-blue-400 rounded">
                                Camera: {transition.cameraAnimationType}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-sm text-zinc-400 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400">{getSegmentName(transition.fromSegmentId)}</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span className="text-blue-400">{getSegmentName(transition.toSegmentId)}</span>
                            </div>
                            <div>Duration: {transition.durationMs}ms</div>
                            {transition.showOverlay && (
                              <div className="text-amber-400">Overlay enabled</div>
                            )}
                            {transition.requireUserAction && (
                              <div className="text-purple-400">Requires user action: "{transition.triggerButtonText}"</div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(transition.timelineTransitionId)}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded"
                          title="Delete transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
