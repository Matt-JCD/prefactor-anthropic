/**
 * Error tracking for span operations
 */

interface SpanError {
  timestamp: number;
  operation: string;
  error: Error;
  retryCount: number;
}

class SpanErrorTracker {
  private errors: SpanError[] = [];
  private readonly maxErrors = 100;

  track(operation: string, error: Error, retryCount: number = 0): void {
    this.errors.push({
      timestamp: Date.now(),
      operation,
      error,
      retryCount,
    });

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
  }

  getRecentErrors(count: number = 10): SpanError[] {
    return this.errors.slice(-count);
  }

  getErrorCount(operation?: string, sinceMs?: number): number {
    const cutoff = sinceMs ? Date.now() - sinceMs : 0;
    return this.errors.filter(
      (e) => e.timestamp >= cutoff && (!operation || e.operation === operation),
    ).length;
  }

  clear(): void {
    this.errors = [];
  }

  getStats() {
    const total = this.errors.length;
    const byOperation: Record<string, number> = {};
    const recent5min = this.getErrorCount(undefined, 5 * 60 * 1000);

    for (const error of this.errors) {
      byOperation[error.operation] = (byOperation[error.operation] || 0) + 1;
    }

    return {
      total,
      recent5min,
      byOperation,
    };
  }
}

export const spanErrorTracker = new SpanErrorTracker();
