import { HoldToTalk, type Recorder } from './holdToTalk';
import { WhisperTranscriber, type TranscribeCall } from './whisper';
import { ExclusiveModels, type EngineJob } from '../reader/exclusiveModels';
import { deferred } from '../reader/testing';

/**
 * A synthetic WAV: a quiet 440 Hz tone, `ms` long. `extraChunk` adds an
 * iOS-style FLLR padding chunk before the samples.
 */
export function makeWav(ms: number, opts: { rate?: number; channels?: number; float?: boolean; extraChunk?: boolean } = {}): Uint8Array {
  const rate = opts.rate ?? 16000;
  const channels = opts.channels ?? 1;
  const bytesPer = opts.float ? 4 : 2;
  const frames = Math.round((rate * ms) / 1000);
  const dataLen = frames * channels * bytesPer;
  const fllr = opts.extraChunk ? 8 + 6 : 0;
  const buf = new Uint8Array(12 + 24 + fllr + 8 + dataLen);
  const v = new DataView(buf.buffer);
  const put = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  put(0, 'RIFF');
  v.setUint32(4, buf.length - 8, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, opts.float ? 3 : 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * channels * bytesPer, true);
  v.setUint16(32, channels * bytesPer, true);
  v.setUint16(34, bytesPer * 8, true);
  let at = 36;
  if (opts.extraChunk) {
    put(at, 'FLLR');
    v.setUint32(at + 4, 6, true);
    at += 14;
  }
  put(at, 'data');
  v.setUint32(at + 4, dataLen, true);
  at += 8;
  for (let f = 0; f < frames; f++) {
    const s = 0.25 * Math.sin((2 * Math.PI * 440 * f) / rate);
    for (let c = 0; c < channels; c++) {
      if (opts.float) v.setFloat32(at, s, true);
      else v.setInt16(at, Math.round(s * 32767), true);
      at += bytesPer;
    }
  }
  return buf;
}

/** The phone's microphone, driven by the test. */
export class FakeRecorder implements Recorder {
  granted: boolean | Error = true;
  startError: unknown = null;
  stopError: unknown = null;
  wav: Uint8Array = makeWav(1500);
  /** When set, start() waits for it (a slow audio session). */
  startGate: Promise<void> | null = null;
  recording = false;
  permissionAsks = 0;
  starts = 0;
  discards = 0;

  async requestPermission() {
    this.permissionAsks++;
    if (this.granted instanceof Error) throw this.granted;
    return this.granted;
  }
  async start() {
    this.starts++;
    if (this.startGate) await this.startGate;
    if (this.startError) throw this.startError;
    this.recording = true;
  }
  async stop() {
    this.recording = false;
    if (this.stopError) throw this.stopError;
    return this.wav;
  }
  async discard() {
    this.discards++;
    this.recording = false;
  }
}

/**
 * QVAC as the reader sees it: a model loader for ExclusiveModels plus
 * Whisper's transcribe()/cancel(). Every load and transcription waits for the
 * test unless `auto` is set; everything that is loaded is tracked.
 */
export class FakeQvac {
  cached = true;
  auto = true;
  transcript = 'Hii ni ya saa ngapi?';
  transcribeError: unknown = null;
  loadError: unknown = null;
  loaded = new Set<string>();
  maxLoaded = 0;
  log: string[] = [];
  files = new Set<string>();
  /** Every audioChunk transcribe() was given. */
  audio: string[] = [];
  private n = 0;
  private loads: { job: EngineJob; d: ReturnType<typeof deferred<string>> }[] = [];
  private runs = new Map<string, ReturnType<typeof deferred<string>>>();

  readonly loader = {
    load: async (job: EngineJob) => {
      this.log.push(`load ${job}`);
      if (!this.auto) {
        const d = deferred<string>();
        this.loads.push({ job, d });
        await d.promise;
      } else {
        await Promise.resolve();
      }
      if (this.loadError) throw this.loadError;
      const id = `${job}-${++this.n}`;
      this.loaded.add(id);
      this.maxLoaded = Math.max(this.maxLoaded, this.loaded.size);
      return id;
    },
    unload: async (id: string) => {
      await Promise.resolve();
      this.loaded.delete(id);
      this.log.push(`unload ${id}`);
    },
  };

  transcribe = (params: { modelId: string; audioChunk: string }): TranscribeCall => {
    const requestId = `req-${++this.n}`;
    this.log.push(`transcribe ${params.modelId}`);
    this.audio.push(params.audioChunk);
    const d = deferred<string>();
    this.runs.set(requestId, d);
    if (this.auto) {
      queueMicrotask(() => (this.transcribeError ? d.reject(this.transcribeError) : d.resolve(this.transcript)));
    }
    return Object.assign(
      d.promise.finally(() => this.runs.delete(requestId)),
      { requestId },
    );
  };

  cancel = async ({ requestId }: { requestId: string }) => {
    this.log.push(`cancel ${requestId}`);
    // Like whisper.cpp's hard cancel: the running call ends with an error.
    this.runs.get(requestId)?.reject(new Error('cancelled'));
  };

  cancelLoad = async () => {
    this.log.push('cancel load');
    const l = this.loads.shift();
    l?.d.reject(new Error('load cancelled'));
  };

  /** Finishes the oldest pending model load. */
  finishLoad() {
    const l = this.loads.shift();
    if (!l) throw new Error('no load pending');
    l.d.resolve(l.job);
  }

  get pendingLoads() {
    return this.loads.length;
  }

  get pendingTranscriptions() {
    return this.runs.size;
  }

  /** Ends the oldest running transcription with `text` (or an error). */
  finishTranscription(text: string | Error = this.transcript) {
    const [id, d] = [...this.runs][0] ?? [];
    if (!id || !d) throw new Error('no transcription running');
    if (text instanceof Error) d.reject(text);
    else d.resolve(text);
  }
}

/**
 * The real HoldToTalk + WhisperTranscriber + ExclusiveModels, with only the
 * microphone and QVAC faked: what the app runs, minus the native modules.
 */
export function createTestListen() {
  const recorder = new FakeRecorder();
  const qvac = new FakeQvac();
  const models = new ExclusiveModels(qvac.loader);
  const logs: string[] = [];
  let clock = 0;
  const transcriber = new WhisperTranscriber({
    isCached: async () => qvac.cached,
    models,
    cancelLoad: qvac.cancelLoad,
    transcribe: qvac.transcribe,
    cancel: qvac.cancel,
    writePcm: (pcm) => {
      const path = `/cache/soma-asr/q-${qvac.files.size}-${pcm.length}.pcm`;
      qvac.files.add(path);
      return path;
    },
    removeFile: (path) => void qvac.files.delete(path),
    log: (m) => logs.push(m),
  });
  const listen = new HoldToTalk({
    recorder,
    transcriber,
    now: () => (clock += 1000),
    log: (m) => logs.push(m),
  });
  return { listen, recorder, qvac, models, logs };
}
