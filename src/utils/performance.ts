/**
 * Performance optimization utilities for map editor
 */

/**
 * Debounce function to limit how often a function can be called
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit function execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * RequestAnimationFrame-based throttle for smooth animations
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  return function executedFunction(...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

/**
 * Batch state updates to reduce re-renders
 */
export class BatchUpdater<T> {
  private updates: Map<string, T> = new Map();
  private timeoutId: NodeJS.Timeout | null = null;
  private callback: (updates: Map<string, T>) => void;
  private delay: number;

  constructor(
    callback: (updates: Map<string, T>) => void,
    delay: number = 16
  ) {
    this.callback = callback;
    this.delay = delay;
  }

  add(key: string, value: T) {
    this.updates.set(key, value);
    if (this.timeoutId === null) {
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.delay);
    }
  }

  flush() {
    if (this.updates.size > 0) {
      this.callback(new Map(this.updates));
      this.updates.clear();
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Efficient event listener manager with delegation
 */
export class EventDelegation {
  private handlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  add(eventType: string, handler: (...args: any[]) => void) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  remove(eventType: string, handler: (...args: any[]) => void) {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  clear() {
    this.handlers.clear();
  }
}

