import { PHRASES, type PhraseId } from './phrases';
import type { SpeechStep } from './plan';
import type { Language } from '../settings/settings';

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

/** How the session adapts to the caregiver's setup and to a screen reader. Read on every call. */
export interface SpeechOptions {
  /** Interface language. In English the app's own phrases are spoken by the on-device English voice instead of the Swahili clips. */
  language?: () => Language;
  /** Multiplies every playback rate (the caregiver's voice speed). */
  speed?: () => number;
  /** True while VoiceOver or TalkBack is on. */
  screenReader?: () => boolean;
  /** Sends text to the screen reader as an announcement. */
  announce?: (text: string) => void;
}

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
    private readonly options: SpeechOptions = {},
  ) {}

  get current(): SpeechState {
    return this.state;
  }

  private emit(run: number, state: SpeechState) {
    if (run !== this.run) return;
    this.state = state;
    this.onChange(state);
  }

  async speak(input: readonly SpeechStep[], baseRate = 1): Promise<SpeechStatus> {
    const run = ++this.run;
    this.backend.stop();
    const english = this.options.language?.() === 'en';
    const rate = baseRate * (this.options.speed?.() ?? 1);

    // With a screen reader on, the app's own fixed phrases go to it as an
    // announcement instead of being spoken over it (docs/ui.md rule 7).
    if (this.options.screenReader?.() && this.options.announce && input.every((s) => s.kind === 'clip')) {
      const text = input.map((s) => (s.kind === 'clip' ? PHRASES[s.phrase][english ? 'en' : 'sw'] : '')).join(' ');
      this.options.announce(text);
      this.emit(run, { status: 'done', line: null });
      return 'done';
    }

    // English interface: there is no English clip set, so the phrase's English
    // text is read by the on-device voice. Like a clip, it only frames the
    // reading: if it fails the label lines are still read.
    const frame = new Set<number>();
    const plan: SpeechStep[] = input.map((step, i) => {
      if (english && step.kind === 'clip') {
        frame.add(i);
        return { kind: 'tts', text: PHRASES[step.phrase].en, line: step.line };
      }
      return step;
    });
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
        let audio: AudioRef;
        try {
          audio = step.kind === 'clip' ? { kind: 'clip', phrase: step.phrase } : await synth.get(i)!;
        } catch (e) {
          if (run !== this.run) return 'stopped';
          if (!frame.has(i)) throw e;
          console.warn(`[soma] phrase skipped: ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        if (run !== this.run) return 'stopped';
        prepare(nextTts(i + 1));
        this.emit(run, { status: 'speaking', line: step.line ?? null });
        if (frame.has(i)) {
          try {
            await this.backend.play(audio, rate);
          } catch (e) {
            if (run !== this.run) return 'stopped';
            console.warn(`[soma] phrase skipped: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (step.kind === 'clip') {
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
