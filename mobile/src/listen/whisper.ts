import type { Transcriber } from './holdToTalk';

/** Whatever QVAC's transcribe() returns: a promise with the id cancel() needs. */
export type TranscribeCall = Promise<string> & { requestId: string };

export interface WhisperDeps {
  /** True when WHISPER_SMALL_Q8_0 is in the phone's model cache. */
  isCached(): Promise<boolean>;
  /**
   * The reader's one-model-at-a-time slot (ExclusiveModels): `use('asr')`
   * unloads OCR or the voice before loading Whisper, `release()` unloads it.
   */
  models: {
    use<T>(job: 'asr', work: (modelId: string) => Promise<T>): Promise<T>;
    release(): Promise<void>;
  };
  /** Stops a Whisper load that is still running (no-op if none). */
  cancelLoad(): Promise<void>;
  transcribe(params: { modelId: string; audioChunk: string }): TranscribeCall;
  cancel(params: { requestId: string }): Promise<void>;
  /** Writes raw s16le PCM to a temporary `.pcm` file and returns its path. */
  writePcm(pcm: Uint8Array): string;
  removeFile(path: string): void;
  log?: (msg: string) => void;
}

export class TranscriptionCancelled extends Error {
  constructor() {
    super('transcription cancelled');
    this.name = 'TranscriptionCancelled';
  }
}

/**
 * QVAC Whisper for one hold-to-talk question. Each transcribe() loads
 * Whisper (every other model unloaded first), runs once and unloads it again
 * before settling, so on the 4 GB iPhone 12 Whisper is only in memory while a
 * question is being heard. The audio goes in as a raw PCM file: the SDK
 * would send a `.wav` through FFmpeg, which the app doesn't bundle.
 */
export class WhisperTranscriber implements Transcriber {
  private cancelled = false;
  private loading = false;
  private requestId: string | null = null;
  private readonly log: (msg: string) => void;

  constructor(private readonly deps: WhisperDeps) {
    this.log = deps.log ?? ((m) => console.warn(m));
  }

  isAvailable(): Promise<boolean> {
    return this.deps.isCached();
  }

  async transcribe(pcm: Uint8Array): Promise<string> {
    this.cancelled = false;
    const path = this.deps.writePcm(pcm);
    try {
      this.loading = true;
      return await this.deps.models.use('asr', async (modelId) => {
        this.loading = false;
        if (this.cancelled) throw new TranscriptionCancelled();
        const call = this.deps.transcribe({ modelId, audioChunk: path });
        this.requestId = call.requestId;
        try {
          const text = await call;
          if (this.cancelled) throw new TranscriptionCancelled();
          return text;
        } finally {
          this.requestId = null;
        }
      });
    } finally {
      this.loading = false;
      this.deps.removeFile(path);
      await this.unload();
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    const id = this.requestId;
    if (id) await this.deps.cancel({ requestId: id }).catch(() => undefined);
    else if (this.loading) await this.deps.cancelLoad().catch(() => undefined);
  }

  private async unload() {
    // One retry: an unload that fails twice leaves Whisper tracked by
    // ExclusiveModels, which unloads it before the next model loads.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.deps.models.release();
        return;
      } catch (e) {
        this.log(`[soma] asr unload failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
