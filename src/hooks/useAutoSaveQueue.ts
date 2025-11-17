import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AutoSaveQueueItem,
  SaveOperationType,
  FeatureData,
  SaveStatus,
} from "@/types";
import { AutoSaveQueue } from "@/utils/autoSaveQueue";
import type { AutoSaveQueueConfig } from "@/utils/autoSaveQueue";

export interface UseAutoSaveQueueOptions extends Omit<AutoSaveQueueConfig, 'onStatusChange' | 'onError'> {
  enabled?: boolean;
  showToasts?: boolean;
}

export interface UseAutoSaveQueueReturn {
  enqueueSave: (
    featureId: string,
    operation: SaveOperationType,
    data: FeatureData,
    priority?: number
  ) => void;
  saveNow: () => Promise<void>;
  clearQueue: () => void;
  removeFromQueue: (featureId: string) => boolean;
  isInQueue: (featureId: string) => boolean;
  status: SaveStatus;
  queueSize: number;
  lastError: Error | null;
  lastSavedAt: number | null;
}

export function useAutoSaveQueue(
  options: UseAutoSaveQueueOptions = {}
): UseAutoSaveQueueReturn {
  const {
    enabled = true,
    showToasts = false,
    debounceMs = 1000,
    maxQueueSize = 50,
    maxRetries = 3,
    retryDelayMs = 2000,
    onSave,
    onSuccess,
  } = options;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [queueSize, setQueueSize] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const queueRef = useRef<AutoSaveQueue | null>(null);

  const onSaveRef = useRef(onSave);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSaveRef.current = onSave;
    onSuccessRef.current = onSuccess;
  }, [onSave, onSuccess]);

  useEffect(() => {
    if (!enabled) return;

    const queue = new AutoSaveQueue({
      debounceMs,
      maxQueueSize,
      maxRetries,
      retryDelayMs,
      onSave: async (item) => {
        if (onSaveRef.current) {
          await onSaveRef.current(item);
        }
      },
      onSuccess: (item) => {
        setLastSavedAt(Date.now());
        setLastError(null);

        if (onSuccessRef.current) {
          onSuccessRef.current(item);
        }

        if (showToasts && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent("toast:show", {
              detail: {
                type: "success",
                message: "Changes saved",
              },
            })
          );
        }

        setQueueSize(queue.getQueueSize());
      },
      onError: (item, error) => {
        setLastError(error);

        console.error(`[useAutoSaveQueue] Save failed for ${item.featureId}:`, error);

        if (showToasts && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent("toast:show", {
              detail: {
                type: "error",
                message: `Failed to save changes: ${error.message}`,
              },
            })
          );
        }

        setQueueSize(queue.getQueueSize());
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
    });

    queueRef.current = queue;

    return () => {
      queue.dispose();
      queueRef.current = null;
    };
  }, [enabled, debounceMs, maxQueueSize, maxRetries, retryDelayMs, showToasts]);

  const enqueueSave = useCallback(
    (
      featureId: string,
      operation: SaveOperationType,
      data: FeatureData,
      priority: number = 0
    ) => {
      if (!enabled || !queueRef.current) {
        console.warn("[useAutoSaveQueue] Queue not enabled or not initialized");
        return;
      }

      queueRef.current.enqueue(featureId, operation, data, priority);
      setQueueSize(queueRef.current.getQueueSize());
    },
    [enabled]
  );

  const saveNow = useCallback(async () => {
    if (!queueRef.current) return;
    await queueRef.current.processQueueImmediate();
    setQueueSize(queueRef.current.getQueueSize());
  }, []);

  const clearQueue = useCallback(() => {
    if (!queueRef.current) return;
    queueRef.current.clear();
    setQueueSize(0);
    setLastError(null);
  }, []);

  const removeFromQueue = useCallback((featureId: string): boolean => {
    if (!queueRef.current) return false;
    const removed = queueRef.current.removeItem(featureId);
    if (removed) {
      setQueueSize(queueRef.current.getQueueSize());
    }
    return removed;
  }, []);

  const isInQueue = useCallback(
    (featureId: string): boolean => {
      if (!queueRef.current) return false;
      return queueRef.current.hasFeature(featureId);
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (queueSize > 0) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, queueSize]);

  return {
    enqueueSave,
    saveNow,
    clearQueue,
    removeFromQueue,
    isInQueue,
    status,
    queueSize,
    lastError,
    lastSavedAt,
  };
}
