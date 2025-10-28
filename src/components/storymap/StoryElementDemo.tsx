"use client";

import { useState, useEffect } from "react";
import {
  getStoryElementLayers,
  createStoryElementLayer,
  updateStoryElementLayer,
  deleteStoryElementLayer,
  type StoryElementLayer,
  type CreateStoryElementLayerRequest,
  type UpdateStoryElementLayerRequest,
} from "@/lib/api";

/**
 * Demo component showing how to use Story Element Layer APIs
 * This is for testing and demonstration purposes
 */
export default function StoryElementDemo() {
  const [layers, setLayers] = useState<StoryElementLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo element ID - replace with actual element ID
  const demoElementId = "demo-element-123";

  const loadLayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStoryElementLayers(demoElementId);
      setLayers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load layers");
    } finally {
      setLoading(false);
    }
  };

  const createDemoLayer = async () => {
    try {
      setError(null);
      const request: CreateStoryElementLayerRequest = {
        elementId: demoElementId,
        elementType: "Map",
        layerId: "demo-layer-456",
        expandToZone: false,
        highlightZoneBoundary: true,
        displayOrder: 1,
        delayMs: 0,
        fadeInMs: 500,
        fadeOutMs: 300,
        startOpacity: 0,
        endOpacity: 1,
        easing: "EaseInOut",
        autoPlayAnimation: true,
        repeatCount: 1,
        isVisible: true,
        opacity: 1,
        displayMode: "Normal",
      };
      
      const newLayer = await createStoryElementLayer(request);
      setLayers(prev => [...prev, newLayer]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create layer");
    }
  };

  const updateDemoLayer = async (layerId: string) => {
    try {
      setError(null);
      const request: UpdateStoryElementLayerRequest = {
        elementType: "Map",
        layerId: "demo-layer-456",
        expandToZone: false,
        highlightZoneBoundary: false,
        displayOrder: 2,
        delayMs: 100,
        fadeInMs: 400,
        fadeOutMs: 400,
        startOpacity: 0.2,
        endOpacity: 0.8,
        easing: "EaseOut",
        autoPlayAnimation: false,
        repeatCount: 2,
        isVisible: true,
        opacity: 0.9,
        displayMode: "Highlight",
      };
      
      const updatedLayer = await updateStoryElementLayer(layerId, request);
      setLayers(prev => prev.map(l => 
        l.storyElementLayerId === layerId ? updatedLayer : l
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update layer");
    }
  };

  const deleteDemoLayer = async (layerId: string) => {
    try {
      setError(null);
      await deleteStoryElementLayer(layerId);
      setLayers(prev => prev.filter(l => l.storyElementLayerId !== layerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete layer");
    }
  };

  useEffect(() => {
    loadLayers();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Story Element Layer API Demo
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Test the Story Element Layer CRUD operations
          </p>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              Error: {error}
            </div>
          )}

          <div className="flex space-x-4 mb-6">
            <button
              onClick={loadLayers}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Reload Layers'}
            </button>
            <button
              onClick={createDemoLayer}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Create Demo Layer
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Story Element Layers ({layers.length})
            </h3>

            {layers.length === 0 ? (
              <p className="text-gray-500">No layers found. Create a demo layer to get started.</p>
            ) : (
              <div className="grid gap-4">
                {layers.map((layer) => (
                  <div
                    key={layer.storyElementLayerId}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <span className="font-medium text-gray-900">
                            {layer.elementType}
                          </span>
                          <span className="text-sm text-gray-600">
                            Layer: {layer.layerId}
                          </span>
                          <span className="text-sm text-gray-600">
                            Display: {layer.displayMode}
                          </span>
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            layer.isVisible 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {layer.isVisible ? 'Visible' : 'Hidden'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500">
                          <div>Order: {layer.displayOrder}</div>
                          <div>Delay: {layer.delayMs}ms</div>
                          <div>Fade In: {layer.fadeInMs}ms</div>
                          <div>Fade Out: {layer.fadeOutMs}ms</div>
                          <div>Start Opacity: {layer.startOpacity}</div>
                          <div>End Opacity: {layer.endOpacity}</div>
                          <div>Easing: {layer.easing}</div>
                          <div>Repeat: {layer.repeatCount}x</div>
                        </div>

                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <div>Expand to Zone: {layer.expandToZone ? 'Yes' : 'No'}</div>
                          <div>Highlight Boundary: {layer.highlightZoneBoundary ? 'Yes' : 'No'}</div>
                          <div>Auto Play: {layer.autoPlayAnimation ? 'Yes' : 'No'}</div>
                        </div>

                        <div className="mt-2 text-xs text-gray-400">
                          ID: {layer.storyElementLayerId}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateDemoLayer(layer.storyElementLayerId)}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => deleteDemoLayer(layer.storyElementLayerId)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">API Usage Examples:</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Get Layers:</strong> <code>getStoryElementLayers(elementId)</code></p>
              <p><strong>Create Layer:</strong> <code>createStoryElementLayer(request)</code></p>
              <p><strong>Update Layer:</strong> <code>updateStoryElementLayer(layerId, request)</code></p>
              <p><strong>Delete Layer:</strong> <code>deleteStoryElementLayer(layerId)</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
