"use client";

import { createStoryElementLayer, deleteStoryElementLayer, getStoryElementLayers, updateStoryElementLayer } from "@/lib/api-storymap";
import { AnimationEasingType, CreateStoryElementLayerRequest, StoryElementDisplayMode, StoryElementLayer, StoryElementType, UpdateStoryElementLayerRequest } from "@/types";
import { useState, useEffect } from "react";


interface Props {
  elementId: string;
  availableLayers?: Array<{ id: string; name: string }>;
  availableZones?: Array<{ id: string; name: string }>;
  onClose?: () => void;
}

type StoryElementLayerForm = {
  elementType: StoryElementType;
  layerId: string;
  zoneId?: string;
  expandToZone: boolean;
  highlightZoneBoundary: boolean;
  displayOrder: number;
  delayMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  startOpacity: number;
  endOpacity: number;
  easing: AnimationEasingType;
  autoPlayAnimation: boolean;
  repeatCount: number;
  isVisible: boolean;
  opacity: number;
  displayMode: StoryElementDisplayMode;
};

const defaultForm: StoryElementLayerForm = {
  elementType: "Map",
  layerId: "",
  expandToZone: false,
  highlightZoneBoundary: false,
  displayOrder: 0,
  delayMs: 0,
  fadeInMs: 400,
  fadeOutMs: 400,
  startOpacity: 0,
  endOpacity: 1,
  easing: "EaseInOut",
  autoPlayAnimation: true,
  repeatCount: 1,
  isVisible: true,
  opacity: 1,
  displayMode: "Normal",
};

export default function StoryElementLayerPanel({
  elementId,
  availableLayers = [],
  availableZones = [],
  onClose,
}: Props) {
  const [layers, setLayers] = useState<StoryElementLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLayer, setEditingLayer] = useState<StoryElementLayer | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<StoryElementLayerForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (elementId) {
      loadLayers();
    }
  }, [elementId]);

  const loadLayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStoryElementLayers(elementId);
      setLayers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load layers");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      setError(null);
      
      const request: CreateStoryElementLayerRequest = {
        elementId,
        ...form,
        zoneId: form.zoneId || null,
      };
      
      await createStoryElementLayer(request);
      await loadLayers();
      setShowAddForm(false);
      setForm(defaultForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create layer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingLayer) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      const request: UpdateStoryElementLayerRequest = {
        ...form,
        zoneId: form.zoneId || null,
      };
      
      await updateStoryElementLayer(editingLayer.storyElementLayerId, request);
      await loadLayers();
      setEditingLayer(null);
      setForm(defaultForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update layer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (layerId: string) => {
    if (!confirm("Are you sure you want to delete this layer?")) return;
    
    try {
      setError(null);
      await deleteStoryElementLayer(layerId);
      await loadLayers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete layer");
    }
  };

  const openEditForm = (layer: StoryElementLayer) => {
    setEditingLayer(layer);
    setForm({
      elementType: layer.elementType,
      layerId: layer.layerId,
      zoneId: layer.zoneId || "",
      expandToZone: layer.expandToZone,
      highlightZoneBoundary: layer.highlightZoneBoundary,
      displayOrder: layer.displayOrder,
      delayMs: layer.delayMs,
      fadeInMs: layer.fadeInMs,
      fadeOutMs: layer.fadeOutMs,
      startOpacity: layer.startOpacity,
      endOpacity: layer.endOpacity,
      easing: layer.easing,
      autoPlayAnimation: layer.autoPlayAnimation,
      repeatCount: layer.repeatCount,
      isVisible: layer.isVisible,
      opacity: layer.opacity,
      displayMode: layer.displayMode,
    });
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingLayer(null);
    setForm(defaultForm);
    setError(null);
  };

  const updateFormField = <K extends keyof StoryElementLayerForm>(
    key: K,
    value: StoryElementLayerForm[K]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const getLayerName = (layerId: string) => {
    const layer = availableLayers.find(l => l.id === layerId);
    return layer?.name || layerId;
  };

  const getZoneName = (zoneId: string) => {
    const zone = availableZones.find(z => z.id === zoneId);
    return zone?.name || zoneId;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Story Element Layers
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Layers ({layers.length})</h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Layer
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading layers...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {layers.map((layer) => (
                <div
                  key={layer.storyElementLayerId}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-900">
                          {layer.elementType}
                        </span>
                        <span className="text-sm text-gray-600">
                          Layer: {getLayerName(layer.layerId)}
                        </span>
                        {layer.zoneId && (
                          <span className="text-sm text-gray-600">
                            Zone: {getZoneName(layer.zoneId)}
                          </span>
                        )}
                        <span className="text-sm text-gray-600">
                          Display: {layer.displayMode}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span>Order: {layer.displayOrder}</span>
                        <span>Delay: {layer.delayMs}ms</span>
                        <span>Fade In: {layer.fadeInMs}ms</span>
                        <span>Fade Out: {layer.fadeOutMs}ms</span>
                        <span>Opacity: {layer.startOpacity} → {layer.endOpacity}</span>
                        <span>Visible: {layer.isVisible ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditForm(layer)}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(layer.storyElementLayerId)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {layers.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  No layers found. Add your first layer to get started.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingLayer ? 'Edit Layer' : 'Add New Layer'}
                </h3>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Element Type
                    </label>
                    <select
                      value={form.elementType}
                      onChange={(e) => updateFormField('elementType', e.target.value as StoryElementType)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {["Text", "Image", "Video", "Audio", "Map", "Chart", "Timeline", "Interactive", "Embed", "Custom"].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Layer
                    </label>
                    <select
                      value={form.layerId}
                      onChange={(e) => updateFormField('layerId', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a layer</option>
                      {availableLayers.map(layer => (
                        <option key={layer.id} value={layer.id}>{layer.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zone (Optional)
                    </label>
                    <select
                      value={form.zoneId}
                      onChange={(e) => updateFormField('zoneId', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No zone</option>
                      {availableZones.map(zone => (
                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Mode
                    </label>
                    <select
                      value={form.displayMode}
                      onChange={(e) => updateFormField('displayMode', e.target.value as StoryElementDisplayMode)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {["Normal", "Highlight", "Dimmed", "Hidden", "Outline", "Fade", "Popup", "Overlay", "Custom"].map(mode => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={form.displayOrder}
                      onChange={(e) => updateFormField('displayOrder', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Animation Easing
                    </label>
                    <select
                      value={form.easing}
                      onChange={(e) => updateFormField('easing', e.target.value as AnimationEasingType)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {["Linear", "EaseIn", "EaseOut", "EaseInOut", "Bounce", "Elastic", "Custom"].map(easing => (
                        <option key={easing} value={easing}>{easing}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delay (ms)
                    </label>
                    <input
                      type="number"
                      value={form.delayMs}
                      onChange={(e) => updateFormField('delayMs', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fade In (ms)
                    </label>
                    <input
                      type="number"
                      value={form.fadeInMs}
                      onChange={(e) => updateFormField('fadeInMs', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fade Out (ms)
                    </label>
                    <input
                      type="number"
                      value={form.fadeOutMs}
                      onChange={(e) => updateFormField('fadeOutMs', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Opacity
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={form.startOpacity}
                      onChange={(e) => updateFormField('startOpacity', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Opacity
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={form.endOpacity}
                      onChange={(e) => updateFormField('endOpacity', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Repeat Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.repeatCount}
                      onChange={(e) => updateFormField('repeatCount', parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.expandToZone}
                      onChange={(e) => updateFormField('expandToZone', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Expand to Zone</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.highlightZoneBoundary}
                      onChange={(e) => updateFormField('highlightZoneBoundary', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Highlight Zone Boundary</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.autoPlayAnimation}
                      onChange={(e) => updateFormField('autoPlayAnimation', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Auto Play Animation</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.isVisible}
                      onChange={(e) => updateFormField('isVisible', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Visible</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={closeForm}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={editingLayer ? handleUpdate : handleCreate}
                  disabled={submitting || !form.layerId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : editingLayer ? 'Update Layer' : 'Create Layer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
