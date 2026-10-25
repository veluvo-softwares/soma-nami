import type { SpeechStep } from './plan';
import { SpeechSession, type SpeechState } from './session';
import { FakeSpeechBackend } from '../reader/testing';
import { flush } from '../model-store/testing';

const PLAN: SpeechStep[] = [
  { kind: 'clip', phrase: 'label_says' },
  { kind: 'tts', text: 'PARACETAMOL', line: 0 },
  { kind: 'clip', phrase: 'line_unsure', line: 1 },
  { kind: 'tts', text: 'Store below 30°C.', line: 2 },
  { kind: 'clip', phrase: 'reading_end' },
];

function setup() {
  const backend = new FakeSpeechBackend();
  const states: SpeechState[] = [];
  const session = new SpeechSession(backend, (s) => states.push(s));
  return { backend, states, session };
}

describe('SpeechSession', () => {
  it('plays every step in order, highlights the spoken line, and ends done with no highlight', async () => {
    const { backend, states, session } = setup();
    const result = session.speak(PLAN);
    await flush();

    expect(backend.playedNames()).toEqual(['label_says']);
    // The first label line is synthesised while the opening clip plays.
    expect(backend.synthesized).toEqual(['PARACETAMOL']);
    backend.finishSynth('file:///a.wav');
    backend.finishPlay();
    await flush();
    expect(backend.playedNames()).toEqual(['label_says', 'file:///a.wav']);
    expect(session.current).toEqual({ status: 'speaking', line: 0 });
    // ...and the next line is synthesised while this one plays.
    expect(backend.synthesized).toEqual(['PARACETAMOL', 'Store below 30°C.']);

    backend.finishPlay();
    await flush();
    expect(session.current).toEqual({ status: 'speaking', line: 1 });
    expect(backend.playedNames().at(-1)).toBe('line_unsure');

    backend.finishSynth('file:///b.wav');
    backend.finishPlay();
    await flush();
    expect(session.current).toEqual({ status: 'speaking', line: 2 });
    backend.finishPlay();
    await flush();
    expect(backend.playedNames().at(-1)).toBe('reading_end');
    backend.finishPlay();

    await expect(result).resolves.toBe('done');
    expect(session.current).toEqual({ status: 'done', line: null });
    expect(states.map((s) => s.line)).toEqual([null, null, 0, 1, 2, null, null]);
  });

  it('stop() mid-line: audio stops, no further steps play, highlight clears, and late synth results are ignored', async () => {
    const { backend, session } = setup();
    const result = session.speak(PLAN);
    await flush();
    backend.finishSynth();
    backend.finishPlay();
    await flush();
    expect(session.current.line).toBe(0);

    session.stop();
    await expect(result).resolves.toBe('stopped');
    expect(session.current).toEqual({ status: 'stopped', line: null });

    // The prefetched synthesis finishing after the stop must not restart anything.
    backend.finishSynth();
    await flush();
    expect(backend.playedNames()).toHaveLength(2);
    expect(backend.pendingPlays).toBe(0);
    expect(session.current).toEqual({ status: 'stopped', line: null });
  });

  it('stop() while waiting for the first synthesis: nothing plays after it arrives', async () => {
    const { backend, session } = setup();
    const result = session.speak([{ kind: 'tts', text: 'PARACETAMOL', line: 0 }]);
    await flush();
    session.stop();
    backend.finishSynth();
    await expect(result).resolves.toBe('stopped');
    expect(backend.played).toEqual([]);
    expect(session.current.status).toBe('stopped');
  });

  it('a new speak() supersedes the old run: the old one never reports again', async () => {
    const { backend, states, session } = setup();
    const first = session.speak(PLAN);
    await flush();
    const second = session.speak([{ kind: 'clip', phrase: 'btn_read_again' }]);
    await expect(first).resolves.toBe('stopped');
    await flush();
    expect(backend.playedNames()).toEqual(['label_says', 'btn_read_again']);

    const before = states.length;
    backend.finishSynth(); // the first run's prefetch
    await flush();
    expect(states.length).toBe(before);

    backend.finishPlay();
    await expect(second).resolves.toBe('done');
    expect(session.current).toEqual({ status: 'done', line: null });
  });

  it('a synthesis failure ends in error with the highlight cleared, and nothing else plays', async () => {
    const { backend, session } = setup();
    const result = session.speak(PLAN);
    await flush();
    backend.failSynth(new Error('tts worker crashed'));
    backend.finishPlay();
    await expect(result).resolves.toBe('error');
    expect(session.current).toEqual({ status: 'error', line: null, error: 'tts worker crashed' });
    expect(backend.playedNames()).toEqual(['label_says']);
  });

  it('a label line that fails to play ends in error with the highlight cleared', async () => {
    const { backend, session } = setup();
    const result = session.speak([{ kind: 'tts', text: 'PARACETAMOL', line: 3 }]);
    await flush();
    backend.finishSynth();
    await flush();
    backend.failPlay(new Error('audio did not load'));
    await expect(result).resolves.toBe('error');
    expect(session.current.line).toBeNull();
  });

  it('a clip that fails to load is skipped: the English lines are still spoken and the reading ends done', async () => {
    const { backend, session } = setup();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = session.speak(PLAN);
    await flush();
    // label_says can't load (a Debug build offline, Metro unreachable).
    backend.failPlay(new Error('audio did not load'));
    await flush();
    backend.finishSynth('file:///a.wav');
    await flush();
    expect(backend.playedNames()).toEqual(['label_says', 'file:///a.wav']);
    expect(session.current).toEqual({ status: 'speaking', line: 0 });
    backend.finishPlay();
    await flush();
    // line_unsure fails too: skipped, the line is still marked on screen.
    backend.failPlay(new Error('audio did not load'));
    await flush();
    backend.finishSynth('file:///b.wav');
    await flush();
    expect(session.current).toEqual({ status: 'speaking', line: 2 });
    backend.finishPlay();
    await flush();
    backend.finishPlay(); // reading_end
    await expect(result).resolves.toBe('done');
    expect(backend.playedNames()).toEqual(['label_says', 'file:///a.wav', 'line_unsure', 'file:///b.wav', 'reading_end']);
    expect(session.current).toEqual({ status: 'done', line: null });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a failed prefetch that is never reached does not raise an unhandled rejection', async () => {
    const { backend, session } = setup();
    const result = session.speak([
      { kind: 'tts', text: 'one', line: 0 },
      { kind: 'tts', text: 'two', line: 1 },
    ]);
    await flush();
    backend.finishSynth();
    await flush();
    session.stop();
    backend.failSynth(new Error('late failure'));
    await expect(result).resolves.toBe('stopped');
  });

  it('plays at the requested rate (Polepole)', async () => {
    const { backend, session } = setup();
    backend.autoFinish = true;
    await session.speak(PLAN, 0.8);
    expect(new Set(backend.rates)).toEqual(new Set([0.8]));
    expect(backend.played).toHaveLength(5);
  });
});
