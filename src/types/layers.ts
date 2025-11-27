import type { LayerDTO } from "@/lib/api-maps";
import type { FeatureData } from "@/utils/mapUtils";

export interface LayerTreeNode {
  id: string;
  name: string;
  type: 'layer' | 'feature';
  isVisible: boolean;
  isCollapsed?: boolean; // Only for layers
  children?: LayerTreeNode[]; // Features nested under layer
  data: LayerDTO | FeatureData; // Original data
  layerId?: string | null; // For features - parent layer ID
}

export interface DragItem {
  type: 'feature';
  featureId: string;
  currentLayerId: string | null;
}

export interface DeleteLayerOptions {
  action: 'delete-features' | 'move-to-default';
  targetLayerId?: string; // Default Layer ID for move-to-default option
}
