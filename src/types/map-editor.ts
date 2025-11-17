export type UndoActionType = "create" | "update" | "delete" | "style" | "geometry";

export interface UndoStackEntry {
  featureId: string;
  action: UndoActionType;
  previousData: FeatureData | null;
  newData: FeatureData | null;
  timestamp: number;
  description?: string;
}

export interface FeatureData {
  properties?: Record<string, any>;
  geometry?: any;
  style?: FeatureStyle;
  type?: string;
  [key: string]: any;
}

export interface FeatureStyle {
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  color?: string;
  weight?: number;
  opacity?: number;
  [key: string]: any;
}

export type SaveOperationType = "create" | "update" | "delete";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutoSaveQueueItem {
  id: string;
  featureId: string;
  operation: SaveOperationType;
  data: FeatureData;
  queuedAt: number;
  priority?: number;
  retryCount?: number;
}

export interface AutoSaveState {
  status: SaveStatus;
  queue: AutoSaveQueueItem[];
  currentItem: AutoSaveQueueItem | null;
  lastError: Error | null;
  lastSavedAt: number | null;
}

export interface MultiSelectState {
  selectedIds: Set<string>;
  isActive: boolean;
  commonStyle: Partial<FeatureStyle> | null;
  hasConflictingStyles: boolean;
}

export interface MultiSelectStyleUpdate {
  featureIds: string[];
  style: Partial<FeatureStyle>;
  previousStyles: Record<string, FeatureStyle>;
}

export type DrawToolType =
  | "Marker"
  | "Text"
  | "Line"
  | "Polygon"
  | "Rectangle"
  | "Circle"
  | "CircleMarker"
  | null;

export interface ToolbarState {
  activeTool: DrawToolType;
  isDrawing: boolean;
  previousTool: DrawToolType;
  autoDeactivate: boolean;
}

export interface ToolConfig {
  type: DrawToolType;
  label: string;
  icon: string;
  autoCompletes: boolean;
  enableTextInput?: boolean;
  defaultOptions?: Record<string, any>;
}

export interface GeomanEventData {
  layer: any;
  shape: string;
  type: string;
  [key: string]: any;
}

export interface MapEditorConfig {
  undo: {
    maxStackSize: number;
    enableKeybind: boolean;
  };

  autoSave: {
    debounceMs: number;
    maxQueueSize: number;
    maxRetries: number;
    retryDelayMs: number;
  };

  multiSelect: {
    enableShiftClick: boolean;
    showSelectionIndicators: boolean;
    selectionColor: string;
  };
  
  toolbar: {
    exclusiveMode: boolean;
    autoDeactivate: boolean;
  };
}

export interface UndoEventPayload {
  entry: UndoStackEntry;
  canUndo: boolean;
  canRedo: boolean;
}

export interface SaveEventPayload {
  featureId: string;
  operation: SaveOperationType;
  status: SaveStatus;
  error?: Error;
}

export interface MultiSelectEventPayload {
  selectedIds: string[];
  action: "add" | "remove" | "clear" | "toggle";
}

export interface ToolbarEventPayload {
  tool: DrawToolType;
  action: "activate" | "deactivate" | "toggle";
  previousTool: DrawToolType;
}
