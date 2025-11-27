import type { LayerDTO } from "@/lib/api-maps";
import type { FeatureData } from "@/utils/mapUtils";
import type { LayerTreeNode } from "@/types/layers";

/**
 * Build a hierarchical tree structure from layers and features
 * @param layers - Array of layer DTOs
 * @param features - Array of feature data
 * @param layerVisibility - Record of layer visibility states
 * @param featureVisibility - Record of feature visibility states
 * @param collapsedLayers - Set of collapsed layer IDs
 * @returns Array of layer tree nodes
 */
export function buildLayerTree(
  layers: LayerDTO[],
  features: FeatureData[],
  layerVisibility: Record<string, boolean>,
  featureVisibility: Record<string, boolean>,
  collapsedLayers: Set<string>
): LayerTreeNode[] {
  const tree: LayerTreeNode[] = [];

  // Create layer nodes
  for (const layer of layers) {
    const layerNode: LayerTreeNode = {
      id: layer.id,
      name: layer.layerName,
      type: 'layer',
      isVisible: layerVisibility[layer.id] ?? layer.isPublic,
      isCollapsed: collapsedLayers.has(layer.id),
      children: [],
      data: layer,
    };

    // Find features that belong to this layer
    const layerFeatures = features.filter((f) => f.layerId === layer.id);

    // Create feature nodes for this layer
    for (const feature of layerFeatures) {
      const featureNode: LayerTreeNode = {
        id: feature.featureId || feature.id,
        name: feature.name,
        type: 'feature',
        isVisible: featureVisibility[feature.featureId || feature.id] ?? feature.isVisible,
        data: feature,
        layerId: layer.id,
      };

      layerNode.children!.push(featureNode);
    }

    tree.push(layerNode);
  }

  // Handle features without a layer (null layerId)
  const orphanFeatures = features.filter((f) => !f.layerId);
  if (orphanFeatures.length > 0) {
    // Find or create a "Default Layer" or handle orphans
    // For now, we'll attach them to the first layer or create a virtual "Unassigned" group
    for (const feature of orphanFeatures) {
      const featureNode: LayerTreeNode = {
        id: feature.featureId || feature.id,
        name: feature.name,
        type: 'feature',
        isVisible: featureVisibility[feature.featureId || feature.id] ?? feature.isVisible,
        data: feature,
        layerId: null,
      };

      // Add to first layer if it exists, otherwise create standalone
      if (tree.length > 0) {
        tree[0].children!.push(featureNode);
      }
    }
  }

  return tree;
}

/**
 * Search/filter layer tree nodes by query
 * @param tree - Array of layer tree nodes
 * @param query - Search query string
 * @returns Filtered tree nodes
 */
export function filterLayerTree(
  tree: LayerTreeNode[],
  query: string
): LayerTreeNode[] {
  if (!query.trim()) {
    return tree;
  }

  const lowerQuery = query.toLowerCase();
  const filteredTree: LayerTreeNode[] = [];

  for (const node of tree) {
    // Check if layer matches
    const layerMatches = node.name.toLowerCase().includes(lowerQuery);

    // Check if any child features match
    const matchingChildren = (node.children || []).filter((child) =>
      child.name.toLowerCase().includes(lowerQuery)
    );

    // Include layer if it matches or has matching children
    if (layerMatches || matchingChildren.length > 0) {
      const newNode: LayerTreeNode = {
        ...node,
        children: layerMatches ? node.children : matchingChildren,
      };
      filteredTree.push(newNode);
    }
  }

  return filteredTree;
}

/**
 * Find a node in the tree by ID
 * @param tree - Array of layer tree nodes
 * @param nodeId - ID to search for
 * @returns Found node or undefined
 */
export function findNodeById(
  tree: LayerTreeNode[],
  nodeId: string
): LayerTreeNode | undefined {
  for (const node of tree) {
    if (node.id === nodeId) {
      return node;
    }

    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

/**
 * Get parent layer for a feature node
 * @param tree - Array of layer tree nodes
 * @param featureId - Feature ID to find parent for
 * @returns Parent layer node or undefined
 */
export function getParentLayer(
  tree: LayerTreeNode[],
  featureId: string
): LayerTreeNode | undefined {
  for (const node of tree) {
    if (node.type === 'layer' && node.children) {
      const hasFeature = node.children.some((child) => child.id === featureId);
      if (hasFeature) {
        return node;
      }
    }
  }

  return undefined;
}

/**
 * Update tree after a feature is moved to a different layer
 * @param tree - Array of layer tree nodes
 * @param featureId - Feature ID that was moved
 * @param targetLayerId - Target layer ID (null for default layer)
 * @returns Updated tree
 */
export function updateTreeAfterMove(
  tree: LayerTreeNode[],
  featureId: string,
  targetLayerId: string | null
): LayerTreeNode[] {
  // Create a deep copy of the tree
  const newTree = JSON.parse(JSON.stringify(tree)) as LayerTreeNode[];

  // Find and remove the feature from its current location
  let movedFeature: LayerTreeNode | undefined;

  for (const layer of newTree) {
    if (layer.type === 'layer' && layer.children) {
      const featureIndex = layer.children.findIndex((child) => child.id === featureId);
      if (featureIndex !== -1) {
        movedFeature = layer.children[featureIndex];
        layer.children.splice(featureIndex, 1);
        break;
      }
    }
  }

  if (!movedFeature) {
    return newTree; // Feature not found
  }

  // Update the feature's layerId
  movedFeature.layerId = targetLayerId;

  // Add the feature to the target layer
  if (targetLayerId) {
    const targetLayer = newTree.find((layer) => layer.id === targetLayerId);
    if (targetLayer && targetLayer.children) {
      targetLayer.children.push(movedFeature);
    }
  } else {
    // If no target layer, add to first layer (default behavior)
    if (newTree.length > 0 && newTree[0].children) {
      newTree[0].children.push(movedFeature);
    }
  }

  return newTree;
}

/**
 * Get all feature IDs that belong to a layer
 * @param tree - Array of layer tree nodes
 * @param layerId - Layer ID
 * @returns Array of feature IDs
 */
export function getLayerFeatureIds(
  tree: LayerTreeNode[],
  layerId: string
): string[] {
  const layer = tree.find((node) => node.id === layerId);
  if (!layer || !layer.children) {
    return [];
  }

  return layer.children.map((child) => child.id);
}

/**
 * Check if a layer is empty (has no features)
 * @param tree - Array of layer tree nodes
 * @param layerId - Layer ID
 * @returns True if layer has no features
 */
export function isLayerEmpty(
  tree: LayerTreeNode[],
  layerId: string
): boolean {
  const layer = tree.find((node) => node.id === layerId);
  return !layer || !layer.children || layer.children.length === 0;
}
