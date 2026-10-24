import type { ModelEntry, ModelName } from './manifest';

/**
 * Pure state for the models screen and the read gate.
 *
 * Phases:
 *   checking        asking the SDK which models are already on the phone
 *   needs-download  at least one model is missing; waiting for the user to start
 *   downloading     fetching missing models, one at a time
 *   ready           every model is on the phone; reading is allowed
 *   error           a check or a download failed; the user can retry
 */
export type Phase = 'checking' | 'needs-download' | 'downloading' | 'ready' | 'error';

export type ModelStatus = 'unknown' | 'missing' | 'downloading' | 'ready' | 'error';

export interface ModelState {
  status: ModelStatus;
  downloaded: number;
  total: number;
  error?: string;
}

export interface ModelsState {
  phase: Phase;
  models: Record<ModelName, ModelState>;
  error?: string;
}

export type ModelsAction =
  | { type: 'check-start' }
  | { type: 'check-result'; name: ModelName; cached: boolean }
  | { type: 'check-done' }
  | { type: 'download-start' }
  | { type: 'model-download-start'; name: ModelName }
  | { type: 'model-progress'; name: ModelName; downloaded: number; total: number }
  | { type: 'model-done'; name: ModelName }
  | { type: 'model-failed'; name: ModelName; error: string }
  | { type: 'failed'; error: string };

export function initialModelsState(manifest: readonly ModelEntry[]): ModelsState {
  const models = {} as Record<ModelName, ModelState>;
  for (const m of manifest) {
    models[m.name] = { status: 'unknown', downloaded: 0, total: m.approxBytes };
  }
  return { phase: 'checking', models };
}

function allReady(models: Record<ModelName, ModelState>): boolean {
  const list = Object.values(models);
  return list.length > 0 && list.every((m) => m.status === 'ready');
}

function setModel(
  state: ModelsState,
  name: ModelName,
  patch: Partial<ModelState>,
): Record<ModelName, ModelState> {
  const current = state.models[name];
  if (!current) return state.models;
  return { ...state.models, [name]: { ...current, ...patch } };
}

export function modelsReducer(state: ModelsState, action: ModelsAction): ModelsState {
  switch (action.type) {
    case 'check-start':
      return { phase: 'checking', models: state.models };
    case 'check-result': {
      const current = state.models[action.name];
      if (!current) return state;
      return {
        ...state,
        models: setModel(state, action.name, {
          status: action.cached ? 'ready' : 'missing',
          downloaded: action.cached ? current.total : 0,
          error: undefined,
        }),
      };
    }
    case 'check-done':
      return {
        phase: allReady(state.models) ? 'ready' : 'needs-download',
        models: state.models,
      };
    case 'download-start':
      return { phase: 'downloading', models: state.models };
    case 'model-download-start':
      return {
        ...state,
        models: setModel(state, action.name, { status: 'downloading', downloaded: 0, error: undefined }),
      };
    case 'model-progress': {
      const current = state.models[action.name];
      if (!current || current.status !== 'downloading') return state;
      return {
        ...state,
        models: setModel(state, action.name, {
          downloaded: action.downloaded,
          total: action.total > 0 ? action.total : current.total,
        }),
      };
    }
    case 'model-done': {
      const current = state.models[action.name];
      if (!current) return state;
      const models = setModel(state, action.name, { status: 'ready', downloaded: current.total });
      return { ...state, models, phase: allReady(models) ? 'ready' : state.phase };
    }
    case 'model-failed':
      return {
        phase: 'error',
        error: action.error,
        models: setModel(state, action.name, { status: 'error', error: action.error }),
      };
    case 'failed':
      return { ...state, phase: 'error', error: action.error };
    default:
      return state;
  }
}

/** The read gate. Nothing may start a read unless this is true. */
export function canRead(state: ModelsState): boolean {
  return state.phase === 'ready' && allReady(state.models);
}

/** Overall download progress, 0..1, weighted by model size. */
export function overallProgress(state: ModelsState): number {
  let done = 0;
  let total = 0;
  for (const m of Object.values(state.models)) {
    total += m.total;
    if (m.status === 'ready') done += m.total;
    else if (m.status === 'downloading') done += Math.min(m.downloaded, m.total);
  }
  return total > 0 ? done / total : 0;
}

export function missingBytes(state: ModelsState): number {
  return Object.values(state.models)
    .filter((m) => m.status !== 'ready')
    .reduce((sum, m) => sum + m.total, 0);
}
