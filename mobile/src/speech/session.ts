import type { PhraseId } from './phrases';
import type { SpeechStep } from './plan';

/** Audio the backend can play: a bundled clip, or a file it synthesised. */
export type AudioRef = { kind: 'clip'; phrase: PhraseId } | { kind: 'file'; uri: string };

export interface SpeechBackend {
  /** Reads label text with the on-device voice and returns playable audio. */
  synthesize(text: string): Promise<AudioRef>;
  /** Plays to the end. Resolves when finished or when `stop()` is called; rejects on a playback error. */
  play(audio: AudioRef, rate: number): Promise<void>;
  /** Stops whatever is playing now. */
  stop(): void;
}

export type SpeechStatus = 'idle' | 'speaking' | 'done' | 'stopped' | 'error';

export interface SpeechState {
  status: SpeechStatus;
  /** The label line being spoken, for the highlight; null between lines. */
  line: number | null;
  error?: string;
}

export const IDLE: SpeechState = { status: 'idle', line: null };

/**
 * Speaks a plan step by step and reports which label line is being spoken.
 *
 * - A new `speak()` or a `stop()` supersedes the run in progress: it stops
 *   the audio, and the old run never reports again (no stale highlight).
 * - The next label line is synthesised while the current one plays, so there
 *   is no silent gap between lines once the first is ready.
 * - Every way out ends in `done`, `stopped` or `error` with `line: null`.
 */
export class SpeechSession {
  private run = 0;
  private state: SpeechState = IDLE;

  constructor(
    private readonly backend: SpeechBackend,
    private readonly onChange: (state: SpeechState) => void,
  ) {}

  get current(): SpeechState {
    return this.state;
  }

  private emit(run: number, state: SpeechState) {
    if (run !== this.run) return;
    this.state = state;
    this.onChange(state);
  }

  async speak(plan: readonly SpeechStep[], rate = 1): Promise<SpeechStatus> {
    const run = ++this.run;
    this.backend.stop();
    const synth = new Map<number, Promise<AudioRef>>();
    const prepare = (i: number) => {
      const step = plan[i];
      if (!step || step.kind !== 'tts' || synth.has(i)) return;
      const p = this.backend.synthesize(step.text);
      // Prefetched audio may never be awaited (stopped first): don't leave an unhandled rejection.
      p.catch(() => undefined);
      synth.set(i, p);
    };
    const nextTts = (from: number) => {
      for (let j = from; j < plan.length; j++) if (plan[j]?.kind === 'tts') return j;
      return -1;
    };

    this.emit(run, { status: 'speaking', line: null });
    try {
      for (let i = 0; i < plan.length; i++) {
        if (run !== this.run) return 'stopped';
        const step = plan[i]!;
        prepare(i);
        const audio: AudioRef =
          step.kind === 'clip' ? { kind: 'clip', phrase: step.phrase } : await synth.get(i)!;
        if (run !== this.run) return 'stopped';
        prepare(nextTts(i + 1));
        this.emit(run, { status: 'speaking', line: step.line ?? null });
        if (step.kind === 'clip') {
          // A Swahili clip is only a frame around the reading. If one fails to
          // load or play (a Debug build offline can't fetch it from Metro), skip
          // it and keep going, so the label lines are still spoken.
          try {
            await this.backend.play(audio, rate);
          } catch (e) {
            if (run !== this.run) return 'stopped';
            console.warn(`[soma] clip ${step.phrase} skipped: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else {
          await this.backend.play(audio, rate);
        }
      }
      if (run !== this.run) return 'stopped';
      this.emit(run, { status: 'done', line: null });
      return 'done';
    } catch (e) {
      if (run !== this.run) return 'stopped';
      this.emit(run, { status: 'error', line: null, error: e instanceof Error ? e.message : String(e) });
      return 'error';
    }
  }

  /** Speaks one pre-rendered phrase, replacing anything in progress. */
  say(phrase: PhraseId, rate = 1): Promise<SpeechStatus> {
    return this.speak([{ kind: 'clip', phrase }], rate);
  }

  stop() {
    this.run++;
    this.backend.stop();
    this.state = { status: 'stopped', line: null };
    this.onChange(this.state);
  }
}
