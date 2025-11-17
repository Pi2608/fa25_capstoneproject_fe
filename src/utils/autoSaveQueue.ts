import type {
  AutoSaveQueueItem,
  SaveOperationType,
  FeatureData,
  SaveStatus,
} from "@/types";

export interface AutoSaveQueueConfig {
  debounceMs?: number;
  maxQueueSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onSave?: (item: AutoSaveQueueItem) => Promise<void>;
  onSuccess?: (item: AutoSaveQueueItem) => void;
  onError?: (item: AutoSaveQueueItem, error: Error) => void;
  onStatusChange?: (status: SaveStatus) => void;
}

export class AutoSaveQueue {
  private queue: AutoSaveQueueItem[] = [];
  private isProcessing = false;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private currentStatus: SaveStatus = "idle";
  private config: Required<AutoSaveQueueConfig>;

  constructor(config: AutoSaveQueueConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 1000,
      maxQueueSize: config.maxQueueSize ?? 50,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 2000,
      onSave: config.onSave ?? (async () => {}),
      onSuccess: config.onSuccess ?? (() => {}),
      onError: config.onError ?? (() => {}),
      onStatusChange: config.onStatusChange ?? (() => {}),
    };
  }

  enqueue(
    featureId: string,
    operation: SaveOperationType,
    data: FeatureData,
    priority: number = 0
  ): void {
    const item: AutoSaveQueueItem = {
      id: `save-${featureId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      featureId,
      operation,
      data,
      queuedAt: Date.now(),
      priority,
      retryCount: 0,
    };

    const existingIndex = this.queue.findIndex(
      (q) => q.featureId === featureId && q.operation === operation
    );

    if (existingIndex !== -1) {
      // Replace existing item with newer data
      this.queue[existingIndex] = item;
      console.log(`[AutoSaveQueue] Updated existing queue item for ${featureId}`);
    } else {
      // Add new item
      this.queue.push(item);
      console.log(`[AutoSaveQueue] Enqueued ${operation} for ${featureId}`);
    }

    // Sort by priority (higher first)
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Check if queue is too large
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn("[AutoSaveQueue] Queue size exceeded, forcing immediate save");
      this.processQueueImmediate();
    } else {
      // Schedule debounced processing
      this.scheduleProcessing();
    }
  }

  private scheduleProcessing(): void {
    // Clear existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Schedule new processing
    this.debounceTimeout = setTimeout(() => {
      this.processQueue();
    }, this.config.debounceMs);
  }

  async processQueueImmediate(): Promise<void> {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log("[AutoSaveQueue] Already processing, skipping");
      return;
    }

    if (this.queue.length === 0) {
      this.updateStatus("idle");
      return;
    }

    this.isProcessing = true;
    this.updateStatus("saving");

    console.log(`[AutoSaveQueue] Processing ${this.queue.length} items...`);

    while (this.queue.length > 0) {
      const item = this.queue[0]; // Process in FIFO order (after priority sort)

      try {
        await this.config.onSave(item);

        // Success - remove from queue
        this.queue.shift();
        this.config.onSuccess(item);

        console.log(`[AutoSaveQueue] Saved ${item.operation} for ${item.featureId}`);
      } catch (error) {
        console.error(`[AutoSaveQueue] Error saving ${item.featureId}:`, error);

        // Handle retry logic
        if (item.retryCount! < this.config.maxRetries) {
          item.retryCount = (item.retryCount || 0) + 1;

          console.log(
            `[AutoSaveQueue] Retrying ${item.featureId} (attempt ${item.retryCount}/${this.config.maxRetries})`
          );

          // Move to end of queue for retry
          this.queue.shift();
          this.queue.push(item);

          // Wait before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelayMs)
          );
        } else {
          // Max retries exceeded - remove from queue and report error
          this.queue.shift();
          this.config.onError(item, error as Error);

          console.error(
            `[AutoSaveQueue] Failed to save ${item.featureId} after ${this.config.maxRetries} retries`
          );
        }
      }
    }

    this.isProcessing = false;
    this.updateStatus("saved");

    console.log("[AutoSaveQueue] Queue processing complete");

    // Auto-transition to idle after a delay
    setTimeout(() => {
      if (this.queue.length === 0 && !this.isProcessing) {
        this.updateStatus("idle");
      }
    }, 2000);
  }

  private updateStatus(status: SaveStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.config.onStatusChange(status);
    }
  }

  getStatus(): SaveStatus {
    return this.currentStatus;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getQueue(): AutoSaveQueueItem[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    this.updateStatus("idle");
    console.log("[AutoSaveQueue] Queue cleared");
  }

  removeItem(featureId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((item) => item.featureId !== featureId);
    return this.queue.length < initialLength;
  }

  hasFeature(featureId: string): boolean {
    return this.queue.some((item) => item.featureId === featureId);
  }

  dispose(): void {
    this.clear();
    this.isProcessing = false;
  }
}

export function createSaveItem(
  featureId: string,
  operation: SaveOperationType,
  data: FeatureData,
  priority: number = 0
): AutoSaveQueueItem {
  return {
    id: `save-${featureId}-${Date.now()}`,
    featureId,
    operation,
    data,
    queuedAt: Date.now(),
    priority,
    retryCount: 0,
  };
}
