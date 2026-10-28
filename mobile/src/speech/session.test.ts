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

describe('SpeechSession with setup and a screen reader', () => {
  const FRAME: SpeechStep[] = [{ kind: 'clip', phrase: 'label_says' }, { kind: 'tts', text: 'PARACETAMOL', line: 0 }];

  it('English interface: the app phrase is spoken by the voice, not the Swahili clip; label text is untouched', async () => {
    const backend = new FakeSpeechBackend();
    backend.autoFinish = true;
    const session = new SpeechSession(backend, () => undefined, { language: () => 'en' });
    await expect(session.speak(FRAME)).resolves.toBe('done');
    expect(backend.synthesized).toEqual(['The label says:', 'PARACETAMOL']);
    expect(backend.playedNames().includes('label_says')).toBe(false);
  });

  it('English interface: a phrase that fails to speak is skipped and the label is still read', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const backend = new FakeSpeechBackend();
    backend.autoFinish = true;
    const real = backend.synthesize.bind(backend);
    backend.synthesize = (text: string) => (text === 'The label says:' ? Promise.reject(new Error('no voice')) : real(text));
    const session = new SpeechSession(backend, () => undefined, { language: () => 'en' });
    await expect(session.speak(FRAME)).resolves.toBe('done');
    expect(backend.played).toHaveLength(1);
  });

  it('a failing label line is still an error, not skipped', async () => {
    const backend = new FakeSpeechBackend();
    const session = new SpeechSession(backend, () => undefined, { language: () => 'en' });
    const result = session.speak([{ kind: 'tts', text: 'X', line: 0 }]);
    await flush();
    backend.failSynth(new Error('boom'));
    await expect(result).resolves.toBe('error');
  });

  it('the caregiver speed multiplies every playback rate', async () => {
    const backend = new FakeSpeechBackend();
    backend.autoFinish = true;
    const session = new SpeechSession(backend, () => undefined, { speed: () => 0.8 });
    await session.speak(FRAME, 1);
    expect(backend.rates.length).toBeGreaterThan(0);
    expect(backend.rates.every((r) => r === 0.8)).toBe(true);
  });

  it('with a screen reader on, fixed phrases are announced to it and not played over it', async () => {
    const backend = new FakeSpeechBackend();
    const announced: string[] = [];
    const session = new SpeechSession(backend, () => undefined, { screenReader: () => true, announce: (t) => announced.push(t) });
    await expect(session.speak([{ kind: 'clip', phrase: 'home_open' }])).resolves.toBe('done');
    expect(announced).toEqual(['Gusa popote kusoma.']);
    expect(backend.played).toEqual([]);
    expect(session.current).toEqual({ status: 'done', line: null });
  });

  it('with a screen reader on, a label reading is still spoken aloud', async () => {
    const backend = new FakeSpeechBackend();
    backend.autoFinish = true;
    const announced: string[] = [];
    const session = new SpeechSession(backend, () => undefined, { screenReader: () => true, announce: (t) => announced.push(t) });
    await session.speak(FRAME);
    expect(announced).toEqual([]);
    expect(backend.synthesized).toEqual(['PARACETAMOL']);
  });
});
