import { ensureModels } from './ensureModels';
import { canRead, initialModelsState, modelsReducer, type ModelsAction, type ModelsState } from './modelsState';
import { FakeModelClient, flush, TEST_MANIFEST } from './testing';

function harness() {
  let state: ModelsState = initialModelsState(TEST_MANIFEST);
  const actions: ModelsAction[] = [];
  const dispatch = (a: ModelsAction) => {
    actions.push(a);
    state = modelsReducer(state, a);
  };
  return { dispatch, actions, get state() { return state; } };
}

describe('ensureModels', () => {
  it('is ready with no download when every model is already on the phone', async () => {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT', 'OCR_LATIN']);
    const h = harness();

    await ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: new AbortController().signal,
    });

    expect(client.started).toEqual([]);
    expect(h.state.phase).toBe('ready');
    expect(canRead(h.state)).toBe(true);
  });

  it('only checks, and waits for the user, when download is false', async () => {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT']);
    const h = harness();

    await ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: false,
      signal: new AbortController().signal,
    });

    expect(client.started).toEqual([]);
    expect(h.state.phase).toBe('needs-download');
    expect(h.state.models.OCR_CRAFT.status).toBe('ready');
    expect(h.state.models.OCR_LATIN.status).toBe('missing');
    expect(canRead(h.state)).toBe(false);
  });

  it('downloads only the missing models, one at a time, then is ready', async () => {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT']);
    const h = harness();

    const run = ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: new AbortController().signal,
    });
    await flush(20);

    expect(client.started).toEqual(['OCR_LATIN']);
    expect(h.state.phase).toBe('downloading');
    expect(canRead(h.state)).toBe(false);

    client.current().onProgress(25, 50);
    expect(h.state.models.OCR_LATIN.downloaded).toBe(25);
    expect(canRead(h.state)).toBe(false);

    client.finish();
    await run;

    expect(h.state.phase).toBe('ready');
    expect(canRead(h.state)).toBe(true);
  });

  it('downloads sequentially: the second starts only after the first finishes', async () => {
    const client = new FakeModelClient();
    const h = harness();

    const run = ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: new AbortController().signal,
    });
    await flush(20);
    expect(client.started).toEqual(['OCR_CRAFT']);

    client.finish();
    await flush(20);
    expect(client.started).toEqual(['OCR_CRAFT', 'OCR_LATIN']);
    expect(canRead(h.state)).toBe(false);

    client.finish();
    await run;
    expect(canRead(h.state)).toBe(true);
  });

  it('stops at a failed download, is not ready, and keeps the real error message', async () => {
    const client = new FakeModelClient();
    const h = harness();

    const run = ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: new AbortController().signal,
    });
    await flush(20);
    client.fail(new Error('Hyperswarm: no peers for blob'));
    await run;

    expect(client.started).toEqual(['OCR_CRAFT']);
    expect(h.state.phase).toBe('error');
    expect(h.state.error).toBe('Hyperswarm: no peers for blob');
    expect(h.state.models.OCR_CRAFT.status).toBe('error');
    expect(canRead(h.state)).toBe(false);
  });

  it('a retry after a failure skips models that finished and resumes', async () => {
    const client = new FakeModelClient();
    const h = harness();
    const signal = new AbortController().signal;

    const first = ensureModels(client, TEST_MANIFEST, h.dispatch, { download: true, signal });
    await flush(20);
    client.finish(); // OCR_CRAFT ok
    await flush(20);
    client.fail(new Error('timeout')); // OCR_LATIN fails
    await first;
    expect(h.state.phase).toBe('error');

    const retry = ensureModels(client, TEST_MANIFEST, h.dispatch, { download: true, signal });
    await flush(20);
    expect(client.started).toEqual(['OCR_CRAFT', 'OCR_LATIN', 'OCR_LATIN']);
    expect(h.state.phase).toBe('downloading');
    expect(h.state.error).toBeUndefined();

    client.finish();
    await retry;
    expect(canRead(h.state)).toBe(true);
  });

  it('reports a failed check (for example the worker did not start) as an error', async () => {
    const client = new FakeModelClient();
    client.isCachedError = new Error('RPC_INIT_TIMEOUT');
    const h = harness();

    await ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: new AbortController().signal,
    });

    expect(client.started).toEqual([]);
    expect(h.state.phase).toBe('error');
    expect(h.state.error).toBe('RPC_INIT_TIMEOUT');
    expect(canRead(h.state)).toBe(false);
  });

  it('cancels the in-flight download on abort and dispatches nothing afterwards', async () => {
    const client = new FakeModelClient();
    const h = harness();
    const controller = new AbortController();

    const run = ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: controller.signal,
    });
    await flush(20);
    const inFlight = client.current();
    const before = h.actions.length;

    controller.abort();
    await run;

    expect(inFlight.cancelled).toBe(true);
    expect(client.started).toEqual(['OCR_CRAFT']); // never moved on to the next model
    expect(h.actions.length).toBe(before);
    expect(canRead(h.state)).toBe(false);

    // A late progress event from the cancelled download changes nothing.
    inFlight.onProgress(100, 100);
    expect(h.actions.length).toBe(before);
  });

  it('dispatches nothing when aborted while checking', async () => {
    const client = new FakeModelClient();
    client.holdChecks();
    const h = harness();
    const controller = new AbortController();

    const run = ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: controller.signal,
    });
    await flush();
    const before = h.actions.length;
    controller.abort();
    client.releaseChecks();
    await run;

    expect(h.actions.length).toBe(before);
    expect(client.started).toEqual([]);
  });

  it('throttles progress to whole-percent changes', async () => {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT']);
    const h = harness();

    const run = ensureModels(client, TEST_MANIFEST, h.dispatch, {
      download: true,
      signal: new AbortController().signal,
    });
    await flush(20);
    const d = client.current();
    d.onProgress(1, 1000);
    d.onProgress(2, 1000);
    d.onProgress(9, 1000); // still 0%
    d.onProgress(10, 1000); // 1%
    const progress = h.actions.filter((a) => a.type === 'model-progress');
    expect(progress).toHaveLength(2);

    client.finish();
    await run;
  });
});
