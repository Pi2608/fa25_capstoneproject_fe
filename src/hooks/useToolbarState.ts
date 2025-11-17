import { useState, useCallback, useEffect, useRef } from "react";
import type {
  ToolbarState,
  DrawToolType,
  ToolConfig,
  ToolbarEventPayload,
  GeomanEventData,
} from "@/types";

export interface UseToolbarStateOptions {
  exclusiveMode?: boolean;
  autoDeactivate?: boolean;
  onToolActivate?: (tool: DrawToolType) => void;
  onToolDeactivate?: (tool: DrawToolType) => void;
  onShapeComplete?: (tool: DrawToolType, data: any) => void;
  onShapeCancelled?: (tool: DrawToolType) => void;
}

export interface UseToolbarStateReturn {
  state: ToolbarState;
  activateTool: (tool: DrawToolType) => void;
  deactivateTool: () => void;
  toggleTool: (tool: DrawToolType) => void;
  isToolActive: (tool: DrawToolType) => boolean;
  getToolConfig: (tool: DrawToolType) => ToolConfig | null;
  handleShapeCreated: (event: GeomanEventData) => void;
  handleDrawingStart: () => void;
  handleDrawingEnd: () => void;
  toolConfigs: ToolConfig[];
}

const DEFAULT_TOOL_CONFIGS: ToolConfig[] = [
  {
    type: "Marker",
    label: "Marker",
    icon: "mdi:map-marker",
    autoCompletes: true,
    defaultOptions: {
      continueDrawing: false,
      markerStyle: {
        draggable: true,
      },
    },
  },
  {
    type: "Text",
    label: "Text",
    icon: "mdi:text",
    autoCompletes: true,
    enableTextInput: true,
    defaultOptions: {
      continueDrawing: false,
      textOptions: {
        text: "New Text",
        style: {
          fontSize: "14px",
          color: "#000000",
        },
      },
    },
  },
  {
    type: "Line",
    label: "Line",
    icon: "mdi:vector-line",
    autoCompletes: false,
    defaultOptions: {
      continueDrawing: false,
      pathOptions: {
        color: "#3388ff",
        weight: 3,
      },
    },
  },
  {
    type: "Polygon",
    label: "Polygon",
    icon: "mdi:vector-polygon",
    autoCompletes: true,
    defaultOptions: {
      continueDrawing: false,
      pathOptions: {
        color: "#3388ff",
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      },
    },
  },
  {
    type: "Rectangle",
    label: "Rectangle",
    icon: "mdi:vector-rectangle",
    autoCompletes: true,
    defaultOptions: {
      continueDrawing: false,
      pathOptions: {
        color: "#3388ff",
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      },
    },
  },
  {
    type: "Circle",
    label: "Circle",
    icon: "mdi:vector-circle",
    autoCompletes: true,
    defaultOptions: {
      continueDrawing: false,
      pathOptions: {
        color: "#3388ff",
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      },
    },
  },
  {
    type: "CircleMarker",
    label: "Circle Marker",
    icon: "mdi:checkbox-blank-circle",
    autoCompletes: true,
    defaultOptions: {
      continueDrawing: false,
      pathOptions: {
        color: "#3388ff",
        fillColor: "#3388ff",
        fillOpacity: 0.8,
        radius: 10,
      },
    },
  },
];

export function useToolbarState(
  options: UseToolbarStateOptions = {}
): UseToolbarStateReturn {
  const {
    exclusiveMode = true,
    autoDeactivate = true,
    onToolActivate,
    onToolDeactivate,
    onShapeComplete,
    onShapeCancelled,
  } = options;

  // Toolbar state
  const [state, setState] = useState<ToolbarState>({
    activeTool: null,
    isDrawing: false,
    previousTool: null,
    autoDeactivate,
  });

  // Refs for callbacks
  const onToolActivateRef = useRef(onToolActivate);
  const onToolDeactivateRef = useRef(onToolDeactivate);
  const onShapeCompleteRef = useRef(onShapeComplete);
  const onShapeCancelledRef = useRef(onShapeCancelled);

  useEffect(() => {
    onToolActivateRef.current = onToolActivate;
    onToolDeactivateRef.current = onToolDeactivate;
    onShapeCompleteRef.current = onShapeComplete;
    onShapeCancelledRef.current = onShapeCancelled;
  }, [onToolActivate, onToolDeactivate, onShapeComplete, onShapeCancelled]);

  const activateTool = useCallback(
    (tool: DrawToolType) => {
      if (tool === null) {
        deactivateTool();
        return;
      }

      setState((prev) => {
        if (exclusiveMode && prev.activeTool === tool) {
          return prev; // handled by toggleTool
        }

        const newState: ToolbarState = {
          activeTool: tool,
          isDrawing: false,
          previousTool: prev.activeTool,
          autoDeactivate,
        };

        // Notify callback
        if (onToolActivateRef.current) {
          onToolActivateRef.current(tool);
        }

        // Dispatch window event
        window.dispatchEvent(
          new CustomEvent<ToolbarEventPayload>("toolbar:toolActivate", {
            detail: {
              tool,
              action: "activate",
              previousTool: prev.activeTool,
            },
          })
        );

        console.log(`[useToolbarState] Activated tool: ${tool}`);

        return newState;
      });
    },
    [exclusiveMode, autoDeactivate]
  );

  const deactivateTool = useCallback(() => {
    setState((prev) => {
      if (prev.activeTool === null) return prev;

      const deactivatedTool = prev.activeTool;

      const newState: ToolbarState = {
        activeTool: null,
        isDrawing: false,
        previousTool: deactivatedTool,
        autoDeactivate,
      };

      // Notify callback
      if (onToolDeactivateRef.current) {
        onToolDeactivateRef.current(deactivatedTool);
      }

      // Dispatch window event
      window.dispatchEvent(
        new CustomEvent<ToolbarEventPayload>("toolbar:toolDeactivate", {
          detail: {
            tool: null,
            action: "deactivate",
            previousTool: deactivatedTool,
          },
        })
      );

      console.log(`[useToolbarState] Deactivated tool: ${deactivatedTool}`);

      return newState;
    });
  }, [autoDeactivate]);

  const toggleTool = useCallback(
    (tool: DrawToolType) => {
      setState((prev) => {
        // If same tool, deactivate it
        if (prev.activeTool === tool) {
          const newState: ToolbarState = {
            activeTool: null,
            isDrawing: false,
            previousTool: tool,
            autoDeactivate,
          };

          // Notify callback
          if (onToolDeactivateRef.current) {
            onToolDeactivateRef.current(tool);
          }

          // Dispatch event
          window.dispatchEvent(
            new CustomEvent<ToolbarEventPayload>("toolbar:toolDeactivate", {
              detail: {
                tool: null,
                action: "toggle",
                previousTool: tool,
              },
            })
          );

          console.log(`[useToolbarState] Toggled off tool: ${tool}`);

          return newState;
        }

        // Different tool, activate it
        activateTool(tool);
        return prev; // activateTool will update state
      });
    },
    [autoDeactivate, activateTool]
  );

  const isToolActive = useCallback(
    (tool: DrawToolType): boolean => {
      return state.activeTool === tool;
    },
    [state.activeTool]
  );

  const getToolConfig = useCallback((tool: DrawToolType): ToolConfig | null => {
    if (tool === null) return null;
    return DEFAULT_TOOL_CONFIGS.find((config) => config.type === tool) || null;
  }, []);

  const handleShapeCreated = useCallback(
    (event: GeomanEventData) => {
      const { shape, layer } = event;

      console.log(`[useToolbarState] Shape created: ${shape}`, event);

      // Notify callback
      if (onShapeCompleteRef.current && state.activeTool) {
        onShapeCompleteRef.current(state.activeTool, event);
      }

      // Check if tool should auto-deactivate
      const config = getToolConfig(state.activeTool);
      if (autoDeactivate && config?.autoCompletes) {
        console.log(`[useToolbarState] Auto-deactivating tool after completion`);
        deactivateTool();
      }

      // Update drawing state
      setState((prev) => ({
        ...prev,
        isDrawing: false,
      }));

      // For Text tool, enable text input modal
      if (state.activeTool === "Text" && config?.enableTextInput) {
        window.dispatchEvent(
          new CustomEvent("map:enableTextInput", {
            detail: {
              layer,
              shape,
            },
          })
        );
      }
    },
    [state.activeTool, autoDeactivate, getToolConfig, deactivateTool]
  );

  const handleDrawingStart = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDrawing: true,
    }));

    console.log(`[useToolbarState] Drawing started`);
  }, []);

  const handleDrawingEnd = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDrawing: false,
    }));

    console.log(`[useToolbarState] Drawing ended`);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.activeTool !== null) {
        // Cancel drawing and deactivate tool
        if (onShapeCancelledRef.current) {
          onShapeCancelledRef.current(state.activeTool);
        }

        deactivateTool();

        // Dispatch event for map to cancel geoman drawing
        window.dispatchEvent(new CustomEvent("map:cancelDrawing"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.activeTool, deactivateTool]);

  return {
    state,
    activateTool,
    deactivateTool,
    toggleTool,
    isToolActive,
    getToolConfig,
    handleShapeCreated,
    handleDrawingStart,
    handleDrawingEnd,
    toolConfigs: DEFAULT_TOOL_CONFIGS,
  };
}
