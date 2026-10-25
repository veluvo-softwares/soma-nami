/**
 * The iPhone 12 has 4 GB and iOS kills an app well before that, so the reader
 * keeps at most one model loaded: OCR for a photo, then the English voice for
 * reading it out (docs/scope.md §5, spike report §1c).
 */
export type EngineJob = 'ocr' | 'tts';

export interface ModelLoader {
  load(job: EngineJob): Promise<string>;
  unload(modelId: string): Promise<void>;
}

/**
 * Runs work with one model loaded and every other model unloaded first.
 * Calls are queued, so a voice request that arrives while OCR runs waits for
 * it instead of loading a second model alongside.
 */
export class ExclusiveModels {
  private current: { job: EngineJob; id: string } | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly loader: ModelLoader) {}

  get loadedJob(): EngineJob | null {
    return this.current?.job ?? null;
  }

  use<T>(job: EngineJob, work: (modelId: string) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      if (this.current?.job !== job) {
        await this.unloadCurrent();
        const id = await this.loader.load(job);
        this.current = { job, id };
      }
      try {
        return await work(this.current!.id);
      } catch (e) {
        // The worker may have left the model unusable: unload it so the next
        // call starts from a fresh load instead of failing the same way.
        await this.unloadCurrent().catch(() => undefined);
        throw e;
      }
    });
  }

  /** Unloads whatever is loaded (e.g. when the reader screen goes away). */
  release(): Promise<void> {
    return this.enqueue(() => this.unloadCurrent());
  }

  private async unloadCurrent() {
    if (!this.current) return;
    // If unload fails the model is still loaded: keep tracking it so the next
    // call tries again instead of loading a second model next to it.
    await this.loader.unload(this.current.id);
    this.current = null;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
