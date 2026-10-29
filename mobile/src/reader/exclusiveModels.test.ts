import { ExclusiveModels, JobTimeoutError, type EngineJob } from './exclusiveModels';
import { deferred } from './testing';
import { flush } from '../model-store/testing';

class FakeLoader {
  loaded = new Set<string>();
  maxLoaded = 0;
  log: string[] = [];
  failLoad: EngineJob | null = null;
  failUnloadOnce = false;
  private n = 0;

  async load(job: EngineJob) {
    await Promise.resolve();
    if (this.failLoad === job) throw new Error(`load ${job} failed`);
    const id = `${job}-${++this.n}`;
    this.loaded.add(id);
    this.maxLoaded = Math.max(this.maxLoaded, this.loaded.size);
    this.log.push(`load ${id}`);
    return id;
  }

  async unload(id: string) {
    await Promise.resolve();
    if (this.failUnloadOnce) {
      this.failUnloadOnce = false;
      throw new Error('unload failed');
    }
    this.loaded.delete(id);
    this.log.push(`unload ${id}`);
  }
}

describe('ExclusiveModels', () => {
  it('unloads OCR before loading the voice, and reuses a model that is already loaded', async () => {
    const loader = new FakeLoader();
    const models = new ExclusiveModels(loader);
    await models.use('ocr', async (id) => id);
    await models.use('ocr', async (id) => id);
    await models.use('tts', async (id) => id);
    await models.use('tts', async (id) => id);
    expect(loader.log).toEqual(['load ocr-1', 'unload ocr-1', 'load tts-2']);
    expect(loader.maxLoaded).toBe(1);
    expect(models.loadedJob).toBe('tts');
  });

  it('queues a voice request behind running OCR instead of loading both at once', async () => {
    const loader = new FakeLoader();
    const models = new ExclusiveModels(loader);
    const ocrDone = deferred<string>();
    const ocr = models.use('ocr', () => ocrDone.promise);
    const tts = models.use('tts', async (id) => id);
    await flush(20);
    expect(loader.log).toEqual(['load ocr-1']);

    ocrDone.resolve('blocks');
    await expect(ocr).resolves.toBe('blocks');
    await expect(tts).resolves.toBe('tts-2');
    expect(loader.maxLoaded).toBe(1);
  });

  it('a failed load leaves nothing loaded and the next call works', async () => {
    const loader = new FakeLoader();
    const models = new ExclusiveModels(loader);
    loader.failLoad = 'ocr';
    await expect(models.use('ocr', async () => 'x')).rejects.toThrow('load ocr failed');
    expect(models.loadedJob).toBeNull();
    loader.failLoad = null;
    await expect(models.use('ocr', async (id) => id)).resolves.toBe('ocr-1');
  });

  it('a failed job unloads its model so the next photo starts from a fresh load, and the queue moves on', async () => {
    const loader = new FakeLoader();
    const models = new ExclusiveModels(loader);
    await expect(
      models.use('ocr', async () => {
        throw new Error('ocr crashed');
      }),
    ).rejects.toThrow('ocr crashed');
    expect(models.loadedJob).toBeNull();
    expect(loader.loaded.size).toBe(0);
    await expect(models.use('ocr', async (id) => id)).resolves.toBe('ocr-2');
  });

  it('if unloading fails it never loads a second model next to the first; the next call retries', async () => {
    const loader = new FakeLoader();
    const models = new ExclusiveModels(loader);
    await models.use('ocr', async (id) => id);
    loader.failUnloadOnce = true;
    await expect(models.use('tts', async (id) => id)).rejects.toThrow('unload failed');
    expect(loader.maxLoaded).toBe(1);
    expect(models.loadedJob).toBe('ocr');
    await expect(models.use('tts', async (id) => id)).resolves.toBe('tts-2');
    expect(loader.maxLoaded).toBe(1);
  });

  it('release() unloads everything, after work in progress', async () => {
    const loader = new FakeLoader();
    const models = new ExclusiveModels(loader);
    const done = deferred<void>();
    const work = models.use('tts', () => done.promise);
    const released = models.release();
    await flush(20);
    expect(loader.loaded.size).toBe(1);
    done.resolve();
    await work;
    await released;
    expect(loader.loaded.size).toBe(0);
    expect(models.loadedJob).toBeNull();
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('gives up on stuck work, unloads the model, drops the late result, and the next call loads fresh', async () => {
      const loader = new FakeLoader();
      const models = new ExclusiveModels(loader);
      const stuck = deferred<string>();
      const caught = models.use('ocr', () => stuck.promise, { timeoutMs: 1000 }).catch((e) => e);
      await jest.advanceTimersByTimeAsync(1000);
      expect(await caught).toBeInstanceOf(JobTimeoutError);
      expect(models.loadedJob).toBeNull();
      expect(loader.loaded.size).toBe(0);

      // The engine finishes after all (or fails): nothing happens, nothing is thrown.
      stuck.resolve('late');
      await jest.advanceTimersByTimeAsync(0);

      await expect(models.use('ocr', async (id) => id, { timeoutMs: 1000 })).resolves.toBe('ocr-2');
      expect(loader.maxLoaded).toBe(1);
    });

    it('a late failure after the timeout is swallowed', async () => {
      const loader = new FakeLoader();
      const models = new ExclusiveModels(loader);
      const stuck = deferred<string>();
      const caught = models.use('ocr', () => stuck.promise, { timeoutMs: 1000 }).catch((e) => e);
      await jest.advanceTimersByTimeAsync(1000);
      expect(await caught).toBeInstanceOf(JobTimeoutError);
      stuck.reject(new Error('model was unloaded under it'));
      await jest.advanceTimersByTimeAsync(0); // an unhandled rejection would fail the test
    });

    it('a stuck unload does not block the voice queued behind it', async () => {
      const loader = new FakeLoader();
      const models = new ExclusiveModels(loader);
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const realUnload = loader.unload.bind(loader);
      loader.unload = (id: string) => (id.startsWith('ocr') ? new Promise<void>(() => undefined) : realUnload(id));
      const caught = models
        .use('ocr', () => new Promise<string>(() => undefined), { timeoutMs: 1000, unloadGraceMs: 500 })
        .catch((e) => e);
      const tts = models.use('tts', async (id) => id);
      await jest.advanceTimersByTimeAsync(1500);
      expect(await caught).toBeInstanceOf(JobTimeoutError);
      await expect(tts).resolves.toBe('tts-2');
      warn.mockRestore();
    });

    it('work that finishes in time is untouched and leaves no timer behind', async () => {
      const loader = new FakeLoader();
      const models = new ExclusiveModels(loader);
      await expect(models.use('ocr', async () => 'ok', { timeoutMs: 1000 })).resolves.toBe('ok');
      expect(jest.getTimerCount()).toBe(0);
      expect(models.loadedJob).toBe('ocr');
    });
  });
});
