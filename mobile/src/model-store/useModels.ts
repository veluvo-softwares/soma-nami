import { useCallback, useEffect, useReducer, useRef } from 'react';

import { ensureModels, type ModelClient } from './ensureModels';
import type { ModelEntry } from './manifest';
import { initialModelsState, modelsReducer, type ModelsState } from './modelsState';

export interface UseModels {
  state: ModelsState;
  /** Download every missing model. Also the retry after an error. No-op while busy. */
  startDownload: () => void;
}

/**
 * Checks the models on mount; downloads only when the user asks (about 2.4 GB,
 * so it should be on Wi-Fi). Everything stops when the component unmounts.
 */
export function useModels(client: ModelClient, manifest: readonly ModelEntry[]): UseModels {
  const [state, dispatch] = useReducer(modelsReducer, manifest, initialModelsState);
  const controllerRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const run = useCallback(
    (download: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      ensureModels(client, manifest, dispatch, { download, signal: controller.signal }).finally(
        () => {
          // Only clear the flag for the run that set it; an aborted run must not
          // unlock a newer one.
          if (controllerRef.current === controller) busyRef.current = false;
        },
      );
    },
    [client, manifest],
  );

  useEffect(() => {
    run(false);
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      busyRef.current = false;
    };
  }, [run]);

  const startDownload = useCallback(() => run(true), [run]);

  return { state, startDownload };
}
