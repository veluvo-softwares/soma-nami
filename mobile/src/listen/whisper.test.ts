import { whisperPrompt } from './prompt';
import { FakeQvac } from './testing';
import { WhisperTranscriber } from './whisper';
import { matchQuestion } from '../ask/match';
import { QUESTIONS } from '../ask/questions';
import { ExclusiveModels } from '../reader/exclusiveModels';

function setup() {
  const qvac = new FakeQvac();
  const models = new ExclusiveModels(qvac.loader);
  const logs: string[] = [];
  let failUnloads = 0;
  const realRelease = models.release.bind(models);
  const t = new WhisperTranscriber({
    isCached: async () => qvac.cached,
    models: {
      use: (job, work, opts) => models.use(job, work, opts),
      release: () => (failUnloads-- > 0 ? Promise.reject(new Error('unload failed')) : realRelease()),
    },
    cancelLoad: qvac.cancelLoad,
    transcribe: qvac.transcribe,
    cancel: qvac.cancel,
    writePcm: (pcm) => {
      const p = `/tmp/q${pcm.length}.pcm`;
      qvac.files.add(p);
      return p;
    },
    removeFile: (p) => void qvac.files.delete(p),
    log: (m) => logs.push(m),
  });
  return { t, qvac, models, logs, failUnloadsNext: (n: number) => (failUnloads = n) };
}

describe('WhisperTranscriber', () => {
  it('hands Whisper a raw .pcm file, never a .wav, and deletes it afterwards', async () => {
    const { t, qvac } = setup();
    await t.transcribe(new Uint8Array(32000));
    expect(qvac.audio).toEqual(['/tmp/q32000.pcm']);
    expect(qvac.files.size).toBe(0);
  });

  it('retries a failed unload once, and logs it', async () => {
    const { t, qvac, logs, failUnloadsNext } = setup();
    failUnloadsNext(1);
    await expect(t.transcribe(new Uint8Array(32000))).resolves.toBe('Hii ni ya saa ngapi?');
    expect(qvac.loaded.size).toBe(0);
    expect(logs).toEqual(['[soma] asr unload failed: unload failed']);
  });

  it('an unload that keeps failing leaves Whisper tracked, so the next model load unloads it first', async () => {
    const { t, qvac, models, failUnloadsNext } = setup();
    failUnloadsNext(2);
    await t.transcribe(new Uint8Array(32000));
    expect(models.loadedJob).toBe('asr');
    await models.use('ocr', async () => undefined);
    expect(qvac.maxLoaded).toBe(1);
    expect(qvac.log).toContain('unload asr-1');
  });

  it('isAvailable() is the model cache check: no download, no network', async () => {
    const { t, qvac } = setup();
    await expect(t.isAvailable()).resolves.toBe(true);
    qvac.cached = false;
    await expect(t.isAvailable()).resolves.toBe(false);
    expect(qvac.log).toEqual([]);
  });

  it('cancelled while queued behind OCR: Whisper is never loaded', async () => {
    const { t, qvac, models } = setup();
    let finishOcr!: () => void;
    const ocr = models.use('ocr', () => new Promise<void>((r) => (finishOcr = r)));
    await Promise.resolve();
    const text = t.transcribe(new Uint8Array(32000));
    await t.cancel();
    finishOcr();
    await ocr;
    await expect(text).rejects.toThrow(/skipped/);
    expect(qvac.log.filter((l) => l === 'load asr')).toEqual([]);
    expect(qvac.loaded.size).toBe(0);
    expect(qvac.files.size).toBe(0);
  });

  it('cancel() with nothing running is harmless', async () => {
    const { t, qvac } = setup();
    await t.cancel();
    expect(qvac.log).toEqual([]);
  });
});

describe('whisperPrompt', () => {
  it('is the full spoken form of every list question, as in the C2 spike', () => {
    const prompt = whisperPrompt();
    for (const q of QUESTIONS) expect(prompt).toContain(q.variants[0]);
  });

  it('if Whisper echoes the prompt back (it can on silence), the matcher answers nothing', () => {
    expect(matchQuestion(whisperPrompt()).kind).not.toBe('match');
  });
});
