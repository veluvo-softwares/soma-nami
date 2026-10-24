import type { ModelEntry, ModelName } from './manifest';
import type { ModelsAction } from './modelsState';

/** What the controller needs from QVAC. The real one is in qvacClient.ts. */
export interface ModelClient {
  /** True when every file of the model is already on the phone. */
  isCached(name: ModelName): Promise<boolean>;
  /** Starts a download. `cancel` stops it; the promise then rejects. */
  download(
    name: ModelName,
    onProgress: (downloaded: number, total: number) => void,
  ): { done: Promise<void>; cancel: () => void };
}

export interface EnsureOptions {
  /** false: only check what is on the phone. true: also fetch what is missing. */
  download: boolean;
  signal: AbortSignal;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return 'Unknown error';
}

/**
 * Checks which models are on the phone and, if asked, downloads the missing
 * ones one at a time (keeps memory and bandwidth predictable on a 4 GB phone).
 *
 * After `signal` aborts, nothing more is dispatched and an in-flight download
 * is cancelled. Models already cached are never downloaded again, so a retry
 * resumes from the first missing model.
 */
export async function ensureModels(
  client: ModelClient,
  manifest: readonly ModelEntry[],
  dispatch: (action: ModelsAction) => void,
  { download, signal }: EnsureOptions,
): Promise<void> {
  const emit = (action: ModelsAction) => {
    if (!signal.aborted) dispatch(action);
  };

  emit({ type: 'check-start' });
  const missing: ModelName[] = [];
  try {
    for (const m of manifest) {
      if (signal.aborted) return;
      const cached = await client.isCached(m.name);
      if (signal.aborted) return;
      emit({ type: 'check-result', name: m.name, cached });
      if (!cached) missing.push(m.name);
    }
  } catch (e) {
    emit({ type: 'failed', error: errorMessage(e) });
    return;
  }
  emit({ type: 'check-done' });

  if (!download || missing.length === 0 || signal.aborted) return;

  emit({ type: 'download-start' });
  for (const name of missing) {
    if (signal.aborted) return;
    emit({ type: 'model-download-start', name });

    let lastPct = -1;
    const job = client.download(name, (downloaded, total) => {
      // Progress can fire hundreds of times a second; re-render on whole percents only.
      const pct = total > 0 ? Math.floor((downloaded / total) * 100) : -1;
      if (pct === lastPct) return;
      lastPct = pct;
      emit({ type: 'model-progress', name, downloaded, total });
    });
    const onAbort = () => job.cancel();
    signal.addEventListener('abort', onAbort);
    try {
      await job.done;
    } catch (e) {
      if (signal.aborted) return;
      emit({ type: 'model-failed', name, error: errorMessage(e) });
      return;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
    if (signal.aborted) return;
    emit({ type: 'model-done', name });
  }
}
