import type {
  UndoStackEntry,
  UndoActionType,
  FeatureData,
  AutoSaveQueueItem,
} from "@/types";

export function createUndoEntry(
  featureId: string,
  action: UndoActionType,
  previousData: FeatureData | null,
  newData: FeatureData | null,
  description?: string
): UndoStackEntry {
  return {
    featureId,
    action,
    previousData: previousData ? deepClone(previousData) : null,
    newData: newData ? deepClone(newData) : null,
    timestamp: Date.now(),
    description,
  };
}

export function undoEntryToSaveItem(
  entry: UndoStackEntry,
  isRedo: boolean = false
): AutoSaveQueueItem {
  // When undoing: use previousData
  // When redoing: use newData
  const dataToSave = isRedo ? entry.newData : entry.previousData;

  let operation: "create" | "update" | "delete";

  if (isRedo) {
    // Redoing the original action
    operation = entry.action === "create" ? "create" : entry.action === "delete" ? "delete" : "update";
  } else {
    // Undoing: reverse the action
    if (entry.action === "create") {
      operation = "delete"; // Undo create = delete
    } else if (entry.action === "delete") {
      operation = "create"; // Undo delete = recreate
    } else {
      operation = "update"; // Undo update = update with previous data
    }
  }

  return {
    id: `undo-${entry.featureId}-${Date.now()}`,
    featureId: entry.featureId,
    operation,
    data: dataToSave || {},
    queuedAt: Date.now(),
    priority: 100, // High priority for undo operations
    retryCount: 0,
  };
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as any;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map((item) => deepClone(item))) as any;
  }

  if (obj instanceof Map) {
    const clonedMap = new Map();
    obj.forEach((value, key) => {
      clonedMap.set(deepClone(key), deepClone(value));
    });
    return clonedMap as any;
  }

  if (typeof obj === "object") {
    const clonedObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

export function validateUndoEntry(entry: UndoStackEntry): boolean {
  if (!entry.featureId || !entry.action || !entry.timestamp) {
    return false;
  }

  // Create action must have newData
  if (entry.action === "create" && !entry.newData) {
    return false;
  }

  // Delete action must have previousData
  if (entry.action === "delete" && !entry.previousData) {
    return false;
  }

  // Update actions should have both
  if (entry.action === "update" && (!entry.previousData || !entry.newData)) {
    return false;
  }

  return true;
}

export function mergeUndoEntries(
  entries: UndoStackEntry[],
  mergeWindowMs: number = 1000
): UndoStackEntry[] {
  if (entries.length === 0) return [];

  const merged: UndoStackEntry[] = [];
  let current = entries[0];

  for (let i = 1; i < entries.length; i++) {
    const next = entries[i];

    // Check if entries can be merged
    const canMerge =
      current.featureId === next.featureId &&
      current.action === next.action &&
      next.timestamp - current.timestamp <= mergeWindowMs;

    if (canMerge) {
      // Merge: keep the original previousData and the latest newData
      current = {
        ...current,
        newData: next.newData,
        timestamp: next.timestamp,
        description: current.description
          ? `${current.description} + ${next.description || "change"}`
          : next.description,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

export function formatUndoDescription(entry: UndoStackEntry): string {
  if (entry.description) {
    return entry.description;
  }

  const actionLabels: Record<UndoActionType, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    style: "Styled",
    geometry: "Modified geometry of",
  };

  const action = actionLabels[entry.action] || "Modified";
  return `${action} feature ${entry.featureId.substring(0, 8)}...`;
}

export function calculateStackSize(entries: UndoStackEntry[]): number {
  return JSON.stringify(entries).length;
}

export function pruneUndoStack(
  entries: UndoStackEntry[],
  maxSize: number
): UndoStackEntry[] {
  if (entries.length <= maxSize) {
    return entries;
  }

  // Keep the most recent entries
  return entries.slice(entries.length - maxSize);
}
