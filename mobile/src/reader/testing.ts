import type { OcrBlock } from './ocrLines';
import type { Photo, ReaderServices } from './types';
import type { AudioRef, SpeechBackend } from '../speech/session';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A speech backend the test drives by hand: every synthesis and every playback
 * waits until the test finishes (or fails) it, and everything is recorded.
 */
export class FakeSpeechBackend implements SpeechBackend {
  synthesized: string[] = [];
  played: AudioRef[] = [];
  rates: number[] = [];
  stops = 0;
  autoFinish = false;
  private synths: Deferred<AudioRef>[] = [];
  private plays: Deferred<void>[] = [];

  synthesize(text: string): Promise<AudioRef> {
    this.synthesized.push(text);
    const d = deferred<AudioRef>();
    this.synths.push(d);
    if (this.autoFinish) d.resolve({ kind: 'file', uri: `file:///tts/${this.synthesized.length}.wav` });
    return d.promise;
  }

  play(audio: AudioRef, rate: number): Promise<void> {
    this.played.push(audio);
    this.rates.push(rate);
    const d = deferred<void>();
    this.plays.push(d);
    if (this.autoFinish) d.resolve();
    return d.promise;
  }

  stop() {
    this.stops++;
    // Like the real backend: stopping ends the current playback normally.
    for (const d of this.plays.splice(0)) d.resolve();
  }

  /** Completes the oldest pending synthesis. */
  finishSynth(uri = `file:///tts/${this.synthesized.length}.wav`) {
    const d = this.synths.shift();
    if (!d) throw new Error('no synthesis pending');
    d.resolve({ kind: 'file', uri });
  }

  failSynth(error: unknown) {
    const d = this.synths.shift();
    if (!d) throw new Error('no synthesis pending');
    d.reject(error);
  }

  /** Ends the oldest playback, as if the audio reached its end. */
  finishPlay() {
    const d = this.plays.shift();
    if (!d) throw new Error('nothing playing');
    d.resolve();
  }

  failPlay(error: unknown) {
    const d = this.plays.shift();
    if (!d) throw new Error('nothing playing');
    d.reject(error);
  }

  get pendingPlays() {
    return this.plays.length;
  }

  /** Human-readable list of what was played: phrase ids and tts file uris. */
  playedNames(): string[] {
    return this.played.map((a) => (a.kind === 'clip' ? a.phrase : a.uri));
  }
}

export class FakeReaderServices implements ReaderServices {
  speech = new FakeSpeechBackend();
  recognized: string[] = [];
  prepared: Photo[] = [];
  released = 0;
  translated: string[] = [];
  /** What the fake translator returns for a line; set per test. */
  translateWith: (english: string) => Promise<string> = async (english) => `SW: ${english}`;
  pickResult: Photo | null = null;
  private ocr: Deferred<OcrBlock[]>[] = [];

  async preparePhoto(photo: Photo): Promise<Photo> {
    this.prepared.push(photo);
    return { ...photo, uri: `${photo.uri}#small` };
  }

  async pickPhoto(): Promise<Photo | null> {
    return this.pickResult;
  }

  recognize(photoUri: string): Promise<OcrBlock[]> {
    this.recognized.push(photoUri);
    const d = deferred<OcrBlock[]>();
    this.ocr.push(d);
    return d.promise;
  }

  translate = (english: string): Promise<string> => {
    this.translated.push(english);
    return this.translateWith(english);
  };

  release = async () => {
    this.released++;
  };

  finishOcr(blocks: OcrBlock[]) {
    const d = this.ocr.shift();
    if (!d) throw new Error('no OCR pending');
    d.resolve(blocks);
  }

  failOcr(error: unknown) {
    const d = this.ocr.shift();
    if (!d) throw new Error('no OCR pending');
    d.reject(error);
  }
}

/**
 * Builds OCR blocks for a synthetic label: one block per line, stacked down a
 * 1000 x 800 photo with a margin, so framing is fine unless a test moves them.
 */
export function blocksFor(
  lines: readonly (string | { text: string; confidence: number })[],
  opts: { left?: number; top?: number; width?: number; lineHeight?: number; gap?: number } = {},
): OcrBlock[] {
  const { left = 100, top = 100, width = 700, lineHeight = 40, gap = 16 } = opts;
  return lines.map((l, i) => {
    const text = typeof l === 'string' ? l : l.text;
    const confidence = typeof l === 'string' ? 0.9 : l.confidence;
    const y1 = top + i * (lineHeight + gap);
    return { text, confidence, bbox: [left, y1, left + width, y1 + lineHeight] };
  });
}

export const PHOTO_SIZE = { width: 1000, height: 800 };
