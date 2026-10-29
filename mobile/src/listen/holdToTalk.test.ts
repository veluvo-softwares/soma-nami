import { MIN_SPEECH_MS, ListenError, listenErrorKind } from './holdToTalk';
import { createTestListen, makeWav } from './testing';
import { flush } from '../model-store/testing';
import { deferred } from '../reader/testing';

/** Every exit must end with the mic off, no model loaded and no audio file left. */
function expectAllReleased(t: ReturnType<typeof createTestListen>) {
  expect(t.recorder.recording).toBe(false);
  expect(t.qvac.loaded.size).toBe(0);
  expect(t.models.loadedJob).toBeNull();
  expect(t.qvac.files.size).toBe(0);
}

async function kindOf(p: Promise<unknown>) {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return listenErrorKind(e);
  }
}

describe('HoldToTalk with Whisper', () => {
  it('press, speak, release: transcribes once, logs [soma] asr, and unloads Whisper', async () => {
    const t = createTestListen();
    await t.listen.start();
    expect(t.recorder.recording).toBe(true);
    await expect(t.listen.finish()).resolves.toBe('Hii ni ya saa ngapi?');
    expect(t.qvac.log).toEqual(['load asr', 'transcribe asr-1', 'unload asr-1']);
    expect(t.logs.some((l) => /^\[soma\] asr \d+ ms, 1500 ms of audio$/.test(l))).toBe(true);
    expectAllReleased(t);
  });

  it('unloads OCR and the voice before Whisper loads: never two models at once', async () => {
    const t = createTestListen();
    await t.models.use('tts', async () => undefined);
    expect(t.qvac.loaded.size).toBe(1);
    await t.listen.start();
    await t.listen.finish();
    expect(t.qvac.log).toEqual(['load tts', 'unload tts-1', 'load asr', 'transcribe asr-2', 'unload asr-2']);
    expect(t.qvac.maxLoaded).toBe(1);
    expectAllReleased(t);
  });

  it(`a press under ${MIN_SPEECH_MS} ms is "too-short" and never loads Whisper`, async () => {
    const t = createTestListen();
    t.recorder.wav = makeWav(300);
    await t.listen.start();
    expect(await kindOf(t.listen.finish())).toBe('too-short');
    expect(t.qvac.log).toEqual([]);
    expectAllReleased(t);
  });

  it('microphone permission denied: "permission", nothing recorded, nothing loaded', async () => {
    const t = createTestListen();
    t.recorder.granted = false;
    expect(await kindOf(t.listen.start())).toBe('permission');
    expect(t.recorder.starts).toBe(0);
    // The release that follows reports nothing new.
    expect(await kindOf(t.listen.finish())).toBe('cancelled');
    expectAllReleased(t);
  });

  it('Whisper not downloaded: "model-missing" before the mic is even asked for', async () => {
    const t = createTestListen();
    t.qvac.cached = false;
    expect(await kindOf(t.listen.start())).toBe('model-missing');
    expect(t.recorder.permissionAsks).toBe(0);
    expectAllReleased(t);
  });

  it('a transcription error is "failed", and Whisper is still unloaded', async () => {
    const t = createTestListen();
    t.qvac.transcribeError = new Error('whisper crashed');
    await t.listen.start();
    expect(await kindOf(t.listen.finish())).toBe('failed');
    expect(t.qvac.log.at(-1)).toBe('unload asr-1');
    expectAllReleased(t);
    // And the next press works.
    t.qvac.transcribeError = null;
    await t.listen.start();
    await expect(t.listen.finish()).resolves.toBe('Hii ni ya saa ngapi?');
    expectAllReleased(t);
  });

  it('a Whisper load that fails is "failed", with nothing left loaded', async () => {
    const t = createTestListen();
    t.qvac.loadError = new Error('out of memory');
    await t.listen.start();
    expect(await kindOf(t.listen.finish())).toBe('failed');
    expectAllReleased(t);
  });

  it('a recorder that fails to start or stop is "failed", with the mic off', async () => {
    const t = createTestListen();
    t.recorder.startError = new Error('audio session busy');
    expect(await kindOf(t.listen.start())).toBe('failed');
    expectAllReleased(t);

    t.recorder.startError = null;
    t.recorder.stopError = new Error('write failed');
    await t.listen.start();
    expect(await kindOf(t.listen.finish())).toBe('failed');
    expectAllReleased(t);
  });

  it('a recording that is not a WAV is "failed" and never reaches Whisper', async () => {
    const t = createTestListen();
    t.recorder.wav = new Uint8Array([1, 2, 3, 4]);
    await t.listen.start();
    expect(await kindOf(t.listen.finish())).toBe('failed');
    expect(t.qvac.log).toEqual([]);
    expectAllReleased(t);
  });

  it('cancel while recording drops the audio', async () => {
    const t = createTestListen();
    await t.listen.start();
    await t.listen.cancel();
    expect(t.recorder.discards).toBe(1);
    expect(await kindOf(t.listen.finish())).toBe('cancelled');
    expect(t.qvac.log).toEqual([]);
    expectAllReleased(t);
  });

  it('let go before the recorder has started: waits for it, then transcribes', async () => {
    const t = createTestListen();
    const gate = deferred<void>();
    t.recorder.startGate = gate.promise;
    const started = t.listen.start();
    const text = t.listen.finish();
    gate.resolve();
    await started;
    await expect(text).resolves.toBe('Hii ni ya saa ngapi?');
    expectAllReleased(t);
  });

  it('screen left while the recorder is starting: the mic is switched off once it is on', async () => {
    const t = createTestListen();
    const gate = deferred<void>();
    t.recorder.startGate = gate.promise;
    const started = t.listen.start();
    await flush(5);
    const cancelled = t.listen.cancel();
    gate.resolve();
    expect(await kindOf(started)).toBe('cancelled');
    await cancelled;
    expectAllReleased(t);
  });

  it('screen left while Whisper loads: the load is cancelled, cancel() resolves only after unload', async () => {
    const t = createTestListen();
    t.qvac.auto = false;
    await t.listen.start();
    const text = t.listen.finish();
    await flush(10);
    expect(t.qvac.pendingLoads).toBe(1);
    await t.listen.cancel();
    expect(await kindOf(text)).toBe('cancelled');
    expect(t.qvac.log).toContain('cancel load');
    expect(t.qvac.log).not.toContain('transcribe asr-1');
    expectAllReleased(t);
  });

  it('screen left mid-transcription: Whisper is cancelled and unloaded before cancel() resolves', async () => {
    const t = createTestListen();
    t.qvac.auto = false;
    await t.listen.start();
    const text = t.listen.finish();
    await flush(10);
    t.qvac.finishLoad();
    await flush(10);
    expect(t.qvac.pendingTranscriptions).toBe(1);
    expect(t.qvac.loaded.size).toBe(1);
    await t.listen.cancel();
    expect(t.qvac.log).toEqual(['load asr', 'transcribe asr-1', 'cancel req-2', 'unload asr-1']);
    expect(await kindOf(text)).toBe('cancelled');
    expectAllReleased(t);
  });

  it('a transcript that lands after the screen was left is dropped', async () => {
    const t = createTestListen();
    t.qvac.auto = false;
    await t.listen.start();
    const text = t.listen.finish();
    await flush(10);
    t.qvac.finishLoad();
    await flush(10);
    // Whisper finishes in the same tick as the cancel.
    t.qvac.finishTranscription('Nimeze ngapi?');
    await t.listen.cancel();
    expect(await kindOf(text)).toBe('cancelled');
    expectAllReleased(t);
  });

  it('a new press while one is in flight cancels the old one first', async () => {
    const t = createTestListen();
    await t.listen.start();
    await t.listen.start();
    expect(t.recorder.discards).toBe(1);
    await expect(t.listen.finish()).resolves.toBe('Hii ni ya saa ngapi?');
    expectAllReleased(t);
  });

  it('finish() twice for one press is refused without touching the model twice', async () => {
    const t = createTestListen();
    await t.listen.start();
    const first = t.listen.finish();
    expect(await kindOf(t.listen.finish())).toBe('failed');
    await expect(first).resolves.toBe('Hii ni ya saa ngapi?');
    expect(t.qvac.log.filter((l) => l.startsWith('load'))).toHaveLength(1);
    expectAllReleased(t);
  });

  it('ListenError keeps its kind; anything else counts as failed', () => {
    expect(listenErrorKind(new ListenError('too-short'))).toBe('too-short');
    expect(listenErrorKind(new Error('x'))).toBe('failed');
  });
});
