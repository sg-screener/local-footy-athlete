export class DevE2EEntryRouteQueue<T> {
  private processor: ((route: T) => Promise<boolean>) | null = null;
  private readonly pending = new Map<string, T>();
  private readonly processing = new Set<string>();
  private readonly processed = new Set<string>();
  private flushing: Promise<void> | null = null;

  async enqueue(key: string, route: T): Promise<boolean> {
    if (this.processed.has(key) || this.processing.has(key) ||
      this.pending.has(key)) return true;
    this.pending.set(key, route);
    if (!this.processor) return true;
    await this.flush();
    return true;
  }

  async setReady(processor: (route: T) => Promise<boolean>): Promise<void> {
    this.processor = processor;
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (!this.processor) return;
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      while (this.pending.size > 0) {
        const next = this.pending.entries().next().value as
          [string, T] | undefined;
        if (!next) break;
        const [key, route] = next;
        await this.processOnce(key, route);
      }
    })().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async processOnce(key: string, route: T): Promise<boolean> {
    if (this.processed.has(key) || this.processing.has(key)) return true;
    const processor = this.processor;
    if (!processor) return true;
    this.processing.add(key);
    try {
      return await processor(route);
    } finally {
      this.processing.delete(key);
      this.processed.add(key);
      this.pending.delete(key);
    }
  }

  clear(): void {
    this.processor = null;
    this.pending.clear();
    this.processing.clear();
    this.processed.clear();
    this.flushing = null;
  }
}
