import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { AskScreen } from './AskScreen';
import { flush } from '../../model-store/testing';
import { toLines } from '../../reader/ocrLines';
import { deferred, FakeSpeechBackend } from '../../reader/testing';
import type { ListenService } from '../../reader/types';
import { IDLE, SpeechSession } from '../../speech/session';

const rows = [
  'Paracetamol Tablets BP 500 mg',
  'Take 2 tablets 3 times a day with food',
  '~Keep in a cool dry place',
  'Exp: 08/2028',
];
const lines = toLines(
  rows.map((r, i) => ({
    text: r.replace(/^~/, ''),
    confidence: r.startsWith('~') ? 0.3 : 0.95,
    bbox: [10, 20 + i * 40, 400, 50 + i * 40] as [number, number, number, number],
  })),
);

class FakeListen implements ListenService {
  started = 0;
  cancelled = 0;
  transcript = deferred<string>();
  startError: unknown = null;
  async start() {
    this.started++;
    if (this.startError) throw this.startError;
  }
  finish() {
    return this.transcript.promise;
  }
  async cancel() {
    this.cancelled++;
  }
}

function setup(listen?: ListenService) {
  const backend = new FakeSpeechBackend();
  backend.autoFinish = true;
  const speech = new SpeechSession(backend, () => undefined);
  const onBackToLabel = jest.fn();
  render(<AskScreen speech={speech} speechState={IDLE} lines={lines} listen={listen} onBackToLabel={onBackToLabel} />);
  return { backend, onBackToLabel };
}

const settle = () => act(async () => void (await flush(20)));
const noteHas = (re: RegExp) => within(screen.getByTestId('ask-note')).getByText(re);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('AskScreen buttons', () => {
  it('shows every question as a button, and no mic when there is no listening service', async () => {
    setup();
    await settle();
    for (const id of ['time_of_day', 'times_a_day', 'how_many', 'with_food', 'what_is_it', 'expiry', 'read_again']) {
      expect(screen.getByTestId(`ask-q-${id}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('ask-mic')).toBeNull();
  });

  it('answers with the quoted label line and speaks the question, "Lebo inasema", and the line as printed', async () => {
    const { backend } = setup();
    await settle();
    fireEvent.press(screen.getByTestId('ask-q-how_many'));
    await settle();
    expect(screen.getByText('Take 2 tablets 3 times a day with food')).toBeTruthy();
    expect(backend.playedNames()).toContain('q_how_many');
    expect(backend.playedNames()).toContain('label_says');
    expect(backend.synthesized).toEqual(['Take 2 tablets 3 times a day with food']);
  });

  it('refuses and points to the pharmacist when a dose question meets an unreadable line; reads no label text', async () => {
    const { backend } = setup();
    await settle();
    fireEvent.press(screen.getByTestId('ask-q-time_of_day'));
    await settle();
    expect(screen.getByTestId('ask-refusal-unsure')).toBeTruthy();
    expect(backend.synthesized).toEqual([]);
    expect(backend.playedNames()).toContain('ask_unsure');
  });

  it('Soma tena goes back to the label', async () => {
    const { onBackToLabel } = setup();
    await settle();
    fireEvent.press(screen.getByTestId('ask-q-read_again'));
    expect(onBackToLabel).toHaveBeenCalledTimes(1);
  });
});

describe('AskScreen hold-to-talk', () => {
  it('a rough Swahili transcript is matched to the list and answered from the label', async () => {
    const listen = new FakeListen();
    const { backend } = setup(listen);
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressIn');
    await settle();
    expect(listen.started).toBe(1);
    fireEvent(screen.getByTestId('ask-mic'), 'pressOut');
    listen.transcript.resolve('Inaisha lini?');
    await settle();
    expect(screen.getByText('Exp: 08/2028')).toBeTruthy();
    expect(backend.playedNames()).toContain('q_expiry');
  });

  it('a transcript that matches nothing says "Sijaelewa, jaribu tena" and answers nothing', async () => {
    const listen = new FakeListen();
    const { backend } = setup(listen);
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressIn');
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressOut');
    listen.transcript.resolve('Habari ya asubuhi');
    await settle();
    expect(noteHas(/Sijaelewa/)).toBeTruthy();
    expect(screen.queryByTestId('ask-result')).toBeNull();
    expect(backend.synthesized).toEqual([]);
  });

  it('a question about alcohol or children goes to the pharmacist', async () => {
    const listen = new FakeListen();
    setup(listen);
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressIn');
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressOut');
    listen.transcript.resolve('Naweza kunywa pombe?');
    await settle();
    expect(noteHas(/Muulize mfamasia/)).toBeTruthy();
  });

  it('a microphone that fails to start tells the user to use the buttons', async () => {
    const listen = new FakeListen();
    listen.startError = new Error('permission denied');
    setup(listen);
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressIn');
    await settle();
    expect(noteHas(/Tumia vitufe/)).toBeTruthy();
  });

  it('a failed transcription tells the user to use the buttons, and the mic works again', async () => {
    const listen = new FakeListen();
    setup(listen);
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressIn');
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressOut');
    listen.transcript.reject(new Error('whisper crashed'));
    await settle();
    expect(noteHas(/Tumia vitufe/)).toBeTruthy();
    fireEvent(screen.getByTestId('ask-mic'), 'pressIn');
    await settle();
    expect(listen.started).toBe(2);
  });

  it('leaving the screen while recording cancels the recording', async () => {
    const listen = new FakeListen();
    setup(listen);
    await settle();
    fireEvent(screen.getByTestId('ask-mic'), 'pressIn');
    await settle();
    screen.unmount();
    expect(listen.cancelled).toBe(1);
  });
});
