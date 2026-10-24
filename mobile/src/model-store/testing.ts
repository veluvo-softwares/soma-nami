import type { ModelClient } from './ensureModels';
import type { ModelEntry, ModelName } from './manifest';

/** A tiny synthetic manifest so tests don't depend on the real model list. */
export const TEST_MANIFEST: readonly ModelEntry[] = [
  { name: 'OCR_CRAFT', label: 'Text detector', job: 'ocr', approxBytes: 100 },
  { name: 'OCR_LATIN', label: 'Text reader', job: 'ocr', approxBytes: 50 },
];

interface PendingDownload {
  name: ModelName;
  onProgress: (downloaded: number, total: number) => void;
  resolve: () => void;
  reject: (e: unknown) => void;
  cancelled: boolean;
}

/**
 * A fake QVAC client the test drives by hand: it decides which models are
 * cached, and completes, fails or progresses each download explicitly.
 */
export class FakeModelClient implements ModelClient {
  cached = new Set<ModelName>();
  isCachedError: unknown = null;
  checks: ModelName[] = [];
  started: ModelName[] = [];
  pending: PendingDownload[] = [];
  private checkGate: Promise<void> | null = null;
  private releaseCheck: (() => void) | null = null;

  /** Makes the next isCached calls wait until `releaseChecks()`. */
  holdChecks() {
    this.checkGate = new Promise((r) => (this.releaseCheck = r));
  }

  releaseChecks() {
    this.releaseCheck?.();
    this.checkGate = null;
  }

  async isCached(name: ModelName): Promise<boolean> {
    this.checks.push(name);
    if (this.checkGate) await this.checkGate;
    if (this.isCachedError) throw this.isCachedError;
    return this.cached.has(name);
  }

  download(name: ModelName, onProgress: (downloaded: number, total: number) => void) {
    this.started.push(name);
    let entry!: PendingDownload;
    const done = new Promise<void>((resolve, reject) => {
      entry = { name, onProgress, resolve, reject, cancelled: false };
    });
    this.pending.push(entry);
    return {
      done,
      cancel: () => {
        entry.cancelled = true;
        entry.reject(new Error('cancelled'));
      },
    };
  }

  current(): PendingDownload {
    const p = this.pending[this.pending.length - 1];
    if (!p) throw new Error('no download in flight');
    return p;
  }

  /** Finishes the in-flight download and marks the model cached, like the SDK. */
  finish() {
    const p = this.current();
    this.cached.add(p.name);
    p.resolve();
  }

  fail(error: unknown) {
    this.current().reject(error);
  }
}

/** Lets pending promise callbacks run. */
export async function flush(times = 5) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}
