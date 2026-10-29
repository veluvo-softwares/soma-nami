import type { ListenService } from '../reader/types';
import { wavToPcm16k } from './pcm';

/**
 * Why a hold-to-talk attempt gave no transcript. The Ask screen turns each
 * kind into what the user hears and sees (AskScreen.tsx):
 * - `too-short`: under MIN_SPEECH_MS of audio ("Sijaelewa, jaribu tena").
 * - `permission`: the phone won't give us the microphone; buttons only.
 * - `model-missing`: Whisper isn't on the phone; buttons only.
 * - `failed`: recording or transcription went wrong; try again or use buttons.
 * - `cancelled`: the user's press was dropped (screen left); nothing to say.
 */
export type ListenErrorKind = 'too-short' | 'permission' | 'model-missing' | 'failed' | 'cancelled';

export class ListenError extends Error {
  constructor(
    readonly kind: ListenErrorKind,
    readonly cause?: unknown,
  ) {
    super(`listen ${kind}${cause instanceof Error ? `: ${cause.message}` : ''}`);
    this.name = 'ListenError';
  }
}

export function listenErrorKind(e: unknown): ListenErrorKind {
  return e instanceof ListenError ? e.kind : 'failed';
}

export const MIN_SPEECH_MS = 500;

/** The phone's microphone (expoRecorder.ts in the app, a fake in tests). */
export interface Recorder {
  /** Asks for the microphone if iOS hasn't been asked yet. */
  requestPermission(): Promise<boolean>;
  /** Switches the audio session to recording and starts writing a WAV file. */
  start(): Promise<void>;
  /** Stops recording, returns the WAV's bytes and deletes the file. */
  stop(): Promise<Uint8Array>;
  /** Stops recording and throws the audio away. Safe to call when not recording. */
  discard(): Promise<void>;
}

/** Whisper (qvacListen.ts in the app, a fake in tests). */
export interface Transcriber {
  /** False when the Whisper model was never downloaded. */
  isAvailable(): Promise<boolean>;
  /**
   * Loads Whisper (with every other model unloaded first), transcribes 16 kHz
   * mono s16le PCM, and unloads Whisper again before it settles, whatever
   * happens.
   */
  transcribe(pcm: Uint8Array): Promise<string>;
  /** Asks a running transcription to stop early. transcribe() still settles. */
  cancel(): Promise<void>;
}

interface Session {
  cancelled: boolean;
  starting: Promise<void>;
  /** Set once finish() runs: settles after the mic is off and the model is unloaded. */
  finishing: Promise<unknown> | null;
  transcribing: boolean;
}

interface Deps {
  recorder: Recorder;
  transcriber: Transcriber;
  now?: () => number;
  log?: (msg: string) => void;
}

/**
 * Hold-to-talk for the Ask screen (C5b). Press: check Whisper is there, get
 * the microphone, record. Release: stop, convert to 16 kHz PCM, refuse
 * anything shorter than half a second, run Whisper once and unload it. One
 * press at a time; cancel() (screen left) ends whatever stage the press is in
 * and only resolves once the microphone is off and Whisper is unloaded.
 */
export class HoldToTalk implements ListenService {
  private session: Session | null = null;
  private readonly recorder: Recorder;
  private readonly transcriber: Transcriber;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;

  constructor(deps: Deps) {
    this.recorder = deps.recorder;
    this.transcriber = deps.transcriber;
    this.now = deps.now ?? Date.now;
    this.log = deps.log ?? ((m) => console.log(m));
  }

  async start(): Promise<void> {
    if (this.session) await this.cancel();
    const s: Session = { cancelled: false, starting: Promise.resolve(), finishing: null, transcribing: false };
    this.session = s;
    s.starting = this.begin(s);
    try {
      await s.starting;
    } catch (e) {
      if (this.session === s && !s.finishing) this.session = null;
      throw e;
    }
  }

  private async begin(s: Session): Promise<void> {
    let available: boolean;
    try {
      available = await this.transcriber.isAvailable();
    } catch (e) {
      throw new ListenError('failed', e);
    }
    if (!available) throw new ListenError('model-missing');
    if (s.cancelled) throw new ListenError('cancelled');

    let granted: boolean;
    try {
      granted = await this.recorder.requestPermission();
    } catch (e) {
      throw new ListenError('failed', e);
    }
    if (!granted) throw new ListenError('permission');
    if (s.cancelled) throw new ListenError('cancelled');

    try {
      await this.recorder.start();
    } catch (e) {
      await this.recorder.discard().catch(() => undefined);
      throw new ListenError('failed', e);
    }
    // Released or left while the recorder was starting: don't leave it on.
    if (s.cancelled) {
      await this.recorder.discard().catch(() => undefined);
      throw new ListenError('cancelled');
    }
  }

  finish(): Promise<string> {
    const s = this.session;
    if (!s) return Promise.reject(new ListenError('cancelled'));
    if (s.finishing) return Promise.reject(new ListenError('failed', new Error('finish called twice')));
    const run = this.complete(s);
    s.finishing = run.catch(() => undefined);
    return run.finally(() => {
      if (this.session === s) this.session = null;
    });
  }

  private async complete(s: Session): Promise<string> {
    // A quick tap can let go before the recorder has even started.
    await s.starting;
    if (s.cancelled) throw new ListenError('cancelled');

    let wav: Uint8Array;
    try {
      wav = await this.recorder.stop();
    } catch (e) {
      await this.recorder.discard().catch(() => undefined);
      throw new ListenError('failed', e);
    }
    if (s.cancelled) throw new ListenError('cancelled');

    let pcm;
    try {
      pcm = wavToPcm16k(wav);
    } catch (e) {
      throw new ListenError('failed', e);
    }
    if (pcm.durationMs < MIN_SPEECH_MS) throw new ListenError('too-short');

    s.transcribing = true;
    const t0 = this.now();
    let text: string;
    try {
      text = await this.transcriber.transcribe(pcm.bytes);
    } catch (e) {
      if (s.cancelled) throw new ListenError('cancelled', e);
      throw new ListenError('failed', e);
    } finally {
      s.transcribing = false;
    }
    this.log(`[soma] asr ${this.now() - t0} ms, ${pcm.durationMs} ms of audio`);
    if (s.cancelled) throw new ListenError('cancelled');
    return text.trim();
  }

  async cancel(): Promise<void> {
    const s = this.session;
    if (!s) return;
    this.session = null;
    s.cancelled = true;
    if (s.transcribing) await this.transcriber.cancel().catch(() => undefined);
    if (s.finishing) {
      // finish() owns the recorder and the model from here; wait for it to let go.
      await s.finishing;
      return;
    }
    await s.starting.catch(() => undefined);
    await this.recorder.discard().catch(() => undefined);
  }
}
