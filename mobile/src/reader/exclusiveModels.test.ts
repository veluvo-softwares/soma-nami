import { ExclusiveModels, type EngineJob } from './exclusiveModels';
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
});
