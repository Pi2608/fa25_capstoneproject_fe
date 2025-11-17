import { useState, useCallback, useEffect, useRef } from "react";
import type {
  UndoStackEntry,
  UndoActionType,
  FeatureData,
  AutoSaveQueueItem,
  UndoEventPayload,
} from "@/types";
import {
  createUndoEntry,
  undoEntryToSaveItem,
  validateUndoEntry,
  pruneUndoStack,
  formatUndoDescription,
} from "@/utils/undoStack";

export interface UseUndoStackOptions {
  maxStackSize?: number;
  enableKeybinds?: boolean;
  enableMerging?: boolean;
  mergeWindowMs?: number;
  onSaveRequired?: (item: AutoSaveQueueItem) => void;
  onUndoRedo?: (payload: UndoEventPayload) => void;
}

export interface UseUndoStackReturn {
  push: (
    featureId: string,
    action: UndoActionType,
    previousData: FeatureData | null,
    newData: FeatureData | null,
    description?: string
  ) => void;

  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoStackSize: number;
  redoStackSize: number;
  getUndoDescription: () => string | null;
  getRedoDescription: () => string | null;
}

export function useUndoStack(
  options: UseUndoStackOptions = {}
): UseUndoStackReturn {
  const {
    maxStackSize = 50,
    enableKeybinds = true,
    enableMerging = false,
    mergeWindowMs = 1000,
    onSaveRequired,
    onUndoRedo,
  } = options;

  const [undoStack, setUndoStack] = useState<UndoStackEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoStackEntry[]>([]);

  const onSaveRequiredRef = useRef(onSaveRequired);
  const onUndoRedoRef = useRef(onUndoRedo);

  useEffect(() => {
    onSaveRequiredRef.current = onSaveRequired;
    onUndoRedoRef.current = onUndoRedo;
  }, [onSaveRequired, onUndoRedo]);

  const push = useCallback(
    (
      featureId: string,
      action: UndoActionType,
      previousData: FeatureData | null,
      newData: FeatureData | null,
      description?: string
    ) => {
      const entry = createUndoEntry(
        featureId,
        action,
        previousData,
        newData,
        description
      );

      if (!validateUndoEntry(entry)) {
        console.warn("[useUndoStack] Invalid undo entry, skipping:", entry);
        return;
      }

      setUndoStack((prev) => {
        let newStack = [...prev, entry];

        if (newStack.length > maxStackSize) {
          newStack = pruneUndoStack(newStack, maxStackSize);
        }

        return newStack;
      });

      setRedoStack([]);

      console.log(`[useUndoStack] Pushed: ${formatUndoDescription(entry)}`);
    },
    [maxStackSize]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) {
      console.warn("[useUndoStack] Nothing to undo");
      return;
    }

    const entry = undoStack[undoStack.length - 1];

    if (onSaveRequiredRef.current) {
      const saveItem = undoEntryToSaveItem(entry, false);
      onSaveRequiredRef.current(saveItem);
    }

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, entry]);

    console.log(`[useUndoStack] Undone: ${formatUndoDescription(entry)}`);

    if (onUndoRedoRef.current) {
      onUndoRedoRef.current({
        entry,
        canUndo: undoStack.length > 1,
        canRedo: true,
      });
    }

    window.dispatchEvent(
      new CustomEvent("map:undo", {
        detail: { entry },
      })
    );
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) {
      console.warn("[useUndoStack] Nothing to redo");
      return;
    }

    const entry = redoStack[redoStack.length - 1];

    if (onSaveRequiredRef.current) {
      const saveItem = undoEntryToSaveItem(entry, true);
      onSaveRequiredRef.current(saveItem);
    }

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => {
      let newStack = [...prev, entry];

      if (newStack.length > maxStackSize) {
        newStack = pruneUndoStack(newStack, maxStackSize);
      }

      return newStack;
    });

    console.log(`[useUndoStack] Redone: ${formatUndoDescription(entry)}`);

    if (onUndoRedoRef.current) {
      onUndoRedoRef.current({
        entry,
        canUndo: true,
        canRedo: redoStack.length > 1,
      });
    }

    window.dispatchEvent(
      new CustomEvent("map:redo", {
        detail: { entry },
      })
    );
  }, [redoStack, maxStackSize]);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    console.log("[useUndoStack] Cleared all stacks");
  }, []);

  const getUndoDescription = useCallback(() => {
    if (undoStack.length === 0) return null;
    return formatUndoDescription(undoStack[undoStack.length - 1]);
  }, [undoStack]);

  const getRedoDescription = useCallback(() => {
    if (redoStack.length === 0) return null;
    return formatUndoDescription(redoStack[redoStack.length - 1]);
  }, [redoStack]);

  useEffect(() => {
    if (!enableKeybinds) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === "z") || e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableKeybinds, undo, redo]);

  return {
    push,
    undo,
    redo,
    clear,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoStackSize: undoStack.length,
    redoStackSize: redoStack.length,
    getUndoDescription,
    getRedoDescription,
  };
}
