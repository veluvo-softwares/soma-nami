import { formatBytes, MODEL_MANIFEST, totalBytes } from './manifest';
import {
  canRead,
  initialModelsState,
  missingBytes,
  modelsReducer,
  overallProgress,
  type ModelsState,
} from './modelsState';
import { TEST_MANIFEST } from './testing';

function apply(state: ModelsState, ...actions: Parameters<typeof modelsReducer>[1][]) {
  return actions.reduce(modelsReducer, state);
}

describe('modelsReducer and the read gate', () => {
  const start = initialModelsState(TEST_MANIFEST);

  it('starts checking, with reading not allowed', () => {
    expect(start.phase).toBe('checking');
    expect(canRead(start)).toBe(false);
  });

  it('is not ready if check-done arrives before every model was checked', () => {
    const s = apply(
      start,
      { type: 'check-result', name: 'OCR_CRAFT', cached: true },
      { type: 'check-done' },
    );
    expect(s.phase).toBe('needs-download');
    expect(canRead(s)).toBe(false);
  });

  it('a stray model-done for one model does not open the gate while others are missing', () => {
    const s = apply(
      start,
      { type: 'check-result', name: 'OCR_CRAFT', cached: false },
      { type: 'check-result', name: 'OCR_LATIN', cached: false },
      { type: 'check-done' },
      { type: 'download-start' },
      { type: 'model-download-start', name: 'OCR_CRAFT' },
      { type: 'model-done', name: 'OCR_CRAFT' },
    );
    expect(s.phase).toBe('downloading');
    expect(canRead(s)).toBe(false);
  });

  it('a later check that finds a model gone closes the gate again', () => {
    const ready = apply(
      start,
      { type: 'check-result', name: 'OCR_CRAFT', cached: true },
      { type: 'check-result', name: 'OCR_LATIN', cached: true },
      { type: 'check-done' },
    );
    expect(canRead(ready)).toBe(true);

    const recheck = apply(
      ready,
      { type: 'check-start' },
      { type: 'check-result', name: 'OCR_CRAFT', cached: true },
      { type: 'check-result', name: 'OCR_LATIN', cached: false },
      { type: 'check-done' },
    );
    expect(recheck.phase).toBe('needs-download');
    expect(canRead(recheck)).toBe(false);
  });

  it('ignores progress for a model that is not downloading', () => {
    const s = apply(start, { type: 'model-progress', name: 'OCR_CRAFT', downloaded: 10, total: 100 });
    expect(s).toBe(start);
  });

  it('weights overall progress by size and counts what is left', () => {
    const s = apply(
      start,
      { type: 'check-result', name: 'OCR_CRAFT', cached: false },
      { type: 'check-result', name: 'OCR_LATIN', cached: true },
      { type: 'check-done' },
      { type: 'download-start' },
      { type: 'model-download-start', name: 'OCR_CRAFT' },
      { type: 'model-progress', name: 'OCR_CRAFT', downloaded: 50, total: 100 },
    );
    // 50 of OCR_LATIN (ready) + 50 of 100 → 100 / 150
    expect(overallProgress(s)).toBeCloseTo(100 / 150);
    expect(missingBytes(s)).toBe(100);
  });
});

describe('manifest', () => {
  it('has unique names and a plausible total size', () => {
    const names = MODEL_MANIFEST.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(totalBytes(MODEL_MANIFEST)).toBeGreaterThan(2e9);
    expect(totalBytes(MODEL_MANIFEST)).toBeLessThan(3e9);
  });

  it('formats sizes for people', () => {
    expect(formatBytes(2_373_389_728)).toBe('2.4 GB');
    expect(formatBytes(84_658_368)).toBe('85 MB');
    expect(formatBytes(512)).toBe('512 B');
  });
});
