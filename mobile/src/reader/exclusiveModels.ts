/**
 * The iPhone 12 has 4 GB and iOS kills an app well before that, so the reader
 * keeps at most one model loaded: OCR for a photo, then the English voice for
 * reading it out (docs/scope.md §5, spike report §1c). The translation model
 * (Tafsiri, C11) is loaded only while a label is being translated and the
 * reader releases it straight after.
 */
export type EngineJob = 'ocr' | 'tts' | 'translate';

/** Thrown when a job outlives its time limit. The job's late result is dropped. */
export class JobTimeoutError extends Error {
  constructor(
    readonly job: EngineJob,
    readonly ms: number,
  ) {
    super(`${job} did not finish in ${ms} ms`);
    this.name = 'JobTimeoutError';
  }
}

export interface UseOptions {
  /** Give up on the work after this long (the engine has no cancel). */
  timeoutMs?: number;
  /** How long to wait for the stuck model to unload before abandoning it. Default 10 s. */
  unloadGraceMs?: number;
}

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

  use<T>(job: EngineJob, work: (modelId: string) => Promise<T>, opts: UseOptions = {}): Promise<T> {
    return this.enqueue(async () => {
      if (this.current?.job !== job) {
        await this.unloadCurrent();
        const id = await this.loader.load(job);
        this.current = { job, id };
      }
      let timedOut = false;
      try {
        return await this.withTimeout(job, work(this.current!.id), opts.timeoutMs, () => {
          timedOut = true;
        });
      } catch (e) {
        // The worker may have left the model unusable: unload it so the next
        // call starts from a fresh load instead of failing the same way.
        if (timedOut) await this.unloadStuck(opts.unloadGraceMs ?? 10_000);
        else await this.unloadCurrent().catch(() => undefined);
        throw e;
      }
    });
  }

  /**
   * Rejects with JobTimeoutError when `work` outlives `ms`. The work itself
   * can't be cancelled, so its late result or error is swallowed here.
   */
  private withTimeout<T>(job: EngineJob, work: Promise<T>, ms: number | undefined, onTimeout: () => void): Promise<T> {
    if (ms === undefined) return work;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        onTimeout();
        reject(new JobTimeoutError(job, ms));
      }, ms);
      work.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  /**
   * After a timeout the model may be busy or wedged, so unloading it can hang
   * too. Wait a bounded time; past that, stop tracking it so the queue (and
   * the voice behind it) is not stuck forever. A model abandoned this way is
   * the engine's to free; the next job loads a fresh one.
   */
  private async unloadStuck(graceMs: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const grace = new Promise<'grace'>((r) => {
      timer = setTimeout(() => r('grace'), graceMs);
    });
    try {
      const out = await Promise.race([
        this.unloadCurrent().then(
          () => 'done' as const,
          () => 'failed' as const,
        ),
        grace,
      ]);
      if (out === 'grace') {
        console.warn('[soma] stuck model did not unload in time; abandoning it');
        this.current = null;
      }
    } finally {
      clearTimeout(timer);
    }
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
