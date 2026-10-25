import { createExpoAudioBackend } from './expoAudioBackend';
import { flush } from '../model-store/testing';

type Status = { isLoaded: boolean; duration: number; didJustFinish: boolean; currentTime: number; playing: boolean };
type Listener = (status: Status) => void;

interface FakePlayer {
  source: unknown;
  listener: Listener | null;
  played: boolean;
  paused: boolean;
  removed: boolean;
  rate: number | null;
  emit: (s: Partial<Status>) => void;
}

const mockPlayers: FakePlayer[] = [];
let mockAudioMode: Promise<void> = Promise.resolve();

jest.mock('expo-audio', () => ({
  setAudioModeAsync: () => mockAudioMode,
  createAudioPlayer: (source: unknown) => {
    const p: FakePlayer = {
      source,
      listener: null,
      played: false,
      paused: false,
      removed: false,
      rate: null,
      emit(s) {
        this.listener?.({ isLoaded: true, duration: 0, didJustFinish: false, currentTime: 0, playing: false, ...s });
      },
    };
    mockPlayers.push(p);
    return {
      addListener: (_: string, l: Listener) => {
        p.listener = l;
        return { remove: () => (p.listener = null) };
      },
      setPlaybackRate: (r: number) => (p.rate = r),
      play: () => (p.played = true),
      pause: () => (p.paused = true),
      remove: () => (p.removed = true),
    };
  },
}));

jest.mock('./phraseAssets', () => ({ PHRASE_ASSETS: { home_open: 101, label_says: 102 } }));

const synth = jest.fn();

beforeEach(() => {
  mockPlayers.length = 0;
  mockAudioMode = Promise.resolve();
  jest.useRealTimers();
});

describe('expo-audio speech backend', () => {
  it('plays a bundled clip at the given rate and resolves when it finishes, releasing the player', async () => {
    const backend = createExpoAudioBackend(synth);
    let done = false;
    const p = backend.play({ kind: 'clip', phrase: 'home_open' }, 0.8).then(() => (done = true));
    await flush();
    const player = mockPlayers[0]!;
    expect(player.source).toBe(101);
    expect(player.rate).toBe(0.8);
    expect(player.played).toBe(true);
    expect(done).toBe(false);

    player.emit({ didJustFinish: true });
    await p;
    expect(player.removed).toBe(true);
    expect(player.listener).toBeNull();
  });

  it('plays a synthesised file by uri', async () => {
    const backend = createExpoAudioBackend(synth);
    const p = backend.play({ kind: 'file', uri: 'file:///cache/line-0.wav' }, 1);
    await flush();
    expect(mockPlayers[0]!.source).toEqual({ uri: 'file:///cache/line-0.wav' });
    mockPlayers[0]!.emit({ didJustFinish: true });
    await p;
  });

  it('stop() pauses and releases the player and resolves the pending play', async () => {
    const backend = createExpoAudioBackend(synth);
    const p = backend.play({ kind: 'clip', phrase: 'home_open' }, 1);
    await flush();
    backend.stop();
    await p;
    expect(mockPlayers[0]!.paused).toBe(true);
    expect(mockPlayers[0]!.removed).toBe(true);
  });

  it('a new play() stops the one before it', async () => {
    const backend = createExpoAudioBackend(synth);
    const first = backend.play({ kind: 'clip', phrase: 'home_open' }, 1);
    await flush();
    const second = backend.play({ kind: 'clip', phrase: 'label_says' }, 1);
    await first;
    await flush();
    expect(mockPlayers[0]!.paused).toBe(true);
    expect(mockPlayers[1]!.played).toBe(true);
    mockPlayers[1]!.emit({ didJustFinish: true });
    await second;
  });

  it('stop() while the audio session is still being set up: no sound starts afterwards', async () => {
    let release!: () => void;
    mockAudioMode = new Promise<void>((r) => (release = r));
    const backend = createExpoAudioBackend(synth);
    const p = backend.play({ kind: 'clip', phrase: 'home_open' }, 1);
    backend.stop();
    release();
    await p;
    expect(mockPlayers).toHaveLength(0);
  });

  it('skips a phrase whose clip has not been rendered yet instead of failing, with a warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const backend = createExpoAudioBackend(synth);
    await expect(backend.play({ kind: 'clip', phrase: 'not_sure' }, 1)).resolves.toBeUndefined();
    expect(mockPlayers).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith('[soma] no clip for phrase not_sure');
    warn.mockRestore();
  });

  it('rejects if the audio never loads, so the reader is not stuck waiting', async () => {
    jest.useFakeTimers();
    const backend = createExpoAudioBackend(synth);
    const p = backend.play({ kind: 'file', uri: 'file:///broken.wav' }, 1);
    const assertion = expect(p).rejects.toThrow('audio did not load');
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(8000);
    await assertion;
    expect(mockPlayers[0]!.removed).toBe(true);
  });

  it('ends on its own if the finish event never arrives', async () => {
    jest.useFakeTimers();
    const backend = createExpoAudioBackend(synth);
    const p = backend.play({ kind: 'clip', phrase: 'home_open' }, 2);
    await Promise.resolve();
    await Promise.resolve();
    mockPlayers[0]!.emit({ isLoaded: true, duration: 4, currentTime: 0, playing: true });
    jest.advanceTimersByTime(4999); // 4 s at 2x = 2 s, plus 3 s slack
    let done = false;
    void p.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    jest.advanceTimersByTime(2);
    await p;
  });

  it('does not skip ahead while playback is paused (an interruption)', async () => {
    jest.useFakeTimers();
    const backend = createExpoAudioBackend(synth);
    const p = backend.play({ kind: 'clip', phrase: 'home_open' }, 1);
    let done = false;
    void p.then(() => (done = true));
    await Promise.resolve();
    await Promise.resolve();
    mockPlayers[0]!.emit({ isLoaded: true, duration: 4, currentTime: 1, playing: true });
    mockPlayers[0]!.emit({ isLoaded: true, duration: 4, currentTime: 1.5, playing: false });
    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(done).toBe(false);
    mockPlayers[0]!.emit({ didJustFinish: true });
    await p;
  });
});
