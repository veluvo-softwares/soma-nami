import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { flush } from '../../model-store/testing';
import { createIpcLink, type LinkEvent, type PearsLink, type Transport } from '../../pears/link';
import { FakeSpeechBackend } from '../../reader/testing';
import { ThemeProvider } from '../../theme';
import { PearsFlow } from './PearsFlow';

/** A link whose far end the test plays by hand. */
class FakeWorklet implements Transport {
  commands: Record<string, unknown>[] = [];
  private handler: (d: string) => void = () => undefined;
  write(data: string) {
    this.commands.push(JSON.parse(data));
  }
  onData(h: (d: string) => void) {
    this.handler = h;
  }
  emit(event: LinkEvent) {
    act(() => this.handler(JSON.stringify(event) + '\n'));
  }
  last(cmd: string) {
    return [...this.commands].reverse().find((c) => c.cmd === cmd);
  }
}

function setup() {
  const worklet = new FakeWorklet();
  const speech = new FakeSpeechBackend();
  const created: PearsLink[] = [];
  const onExit = jest.fn();
  render(
    <ThemeProvider name="dark">
      <PearsFlow
        createLink={() => {
          const l = createIpcLink(worklet);
          created.push(l);
          return l;
        }}
        speech={speech}
        onExit={onExit}
      />
    </ThemeProvider>,
  );
  return { worklet, speech, created, onExit };
}

async function settle() {
  await act(async () => {
    await flush(10);
  });
}

describe('PearsFlow: pharmacist', () => {
  it('starts nothing until a side is chosen, then hosts and shows the code to give the patient', () => {
    const { worklet, created } = setup();
    expect(created).toHaveLength(0);
    expect(worklet.commands).toEqual([]);

    fireEvent.press(screen.getByTestId('pears-role-pharmacist'));
    expect(worklet.last('host')).toMatchObject({ cmd: 'host', port: 49737 });
    expect(screen.queryByTestId('pears-invite')).toBeNull(); // no address until the worklet reports it

    worklet.emit({ ev: 'ready', host: '192.168.43.1' });
    expect(screen.getByTestId('pears-invite')).toBeTruthy();
    const code = (worklet.last('host') as { code: string }).code;
    expect(screen.getByText(`192.168.43.1-${code}`)).toBeTruthy();
  });

  it('sends the instruction once connected, exactly as typed, and shows when it arrived', () => {
    const { worklet } = setup();
    fireEvent.press(screen.getByTestId('pears-role-pharmacist'));
    worklet.emit({ ev: 'ready', host: '192.168.43.1' });

    // Not connected yet: the Send button does nothing.
    fireEvent.changeText(screen.getByTestId('pears-instruction'), 'Chukua 1 mara 3 baada ya chakula');
    fireEvent.press(screen.getByTestId('pears-send'));
    expect(worklet.last('send')).toBeUndefined();

    worklet.emit({ ev: 'peer' });
    fireEvent.press(screen.getByTestId('pears-send'));
    expect(worklet.last('send')).toEqual({ cmd: 'send', id: 'm1', text: 'Chukua 1 mara 3 baada ya chakula' });
    expect(screen.getByText('Inatuma…')).toBeTruthy();

    worklet.emit({ ev: 'delivered', id: 'm1' });
    expect(screen.getByText('Imefika kwa mgonjwa')).toBeTruthy();
  });

  it('asks for text instead of sending an empty instruction', () => {
    const { worklet } = setup();
    fireEvent.press(screen.getByTestId('pears-role-pharmacist'));
    worklet.emit({ ev: 'ready', host: '192.168.43.1' });
    worklet.emit({ ev: 'peer' });
    fireEvent.changeText(screen.getByTestId('pears-instruction'), '   ');
    fireEvent.press(screen.getByTestId('pears-send'));
    expect(screen.getByTestId('pears-empty')).toBeTruthy();
    expect(worklet.last('send')).toBeUndefined();
  });

  it('says so when the patient is gone and the send fails, and lets the pharmacist retry', () => {
    const { worklet } = setup();
    fireEvent.press(screen.getByTestId('pears-role-pharmacist'));
    worklet.emit({ ev: 'ready', host: '192.168.43.1' });
    worklet.emit({ ev: 'peer' });
    fireEvent.changeText(screen.getByTestId('pears-instruction'), 'Take 1 tablet');
    fireEvent.press(screen.getByTestId('pears-send'));
    worklet.emit({ ev: 'error', message: 'no-peer', id: 'm1' });
    expect(screen.getByText('Haikutumwa. Jaribu tena.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pears-send'));
    expect(worklet.last('send')).toMatchObject({ id: 'm2', text: 'Take 1 tablet' });
  });

  it('stops the worklet when leaving, and a second visit starts fresh', () => {
    const { worklet, onExit } = setup();
    fireEvent.press(screen.getByTestId('pears-role-pharmacist'));
    fireEvent.press(screen.getByTestId('pears-back'));
    expect(worklet.last('stop')).toBeTruthy();
    expect(screen.getByTestId('pears-choose')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pears-exit'));
    expect(onExit).toHaveBeenCalled();
  });

  it('shows the Wi-Fi hint when the phone has no local network', () => {
    const { worklet } = setup();
    fireEvent.press(screen.getByTestId('pears-role-pharmacist'));
    worklet.emit({ ev: 'error', message: 'no-local-network' });
    expect(screen.getByText('Washa Wi-Fi au hotspot')).toBeTruthy();
  });
});

describe('PearsFlow: patient', () => {
  it('refuses a public address and a malformed code without starting anything', () => {
    const { worklet } = setup();
    fireEvent.press(screen.getByTestId('pears-role-patient'));
    fireEvent.changeText(screen.getByTestId('pears-code'), '8.8.8.8-4821');
    fireEvent.press(screen.getByTestId('pears-connect'));
    expect(screen.getByTestId('pears-invalid')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('pears-code'), 'hello');
    fireEvent.press(screen.getByTestId('pears-connect'));
    expect(worklet.last('join')).toBeUndefined();
  });

  it('joins through the pharmacist, shows the instruction and reads it aloud, once', async () => {
    const { worklet, speech } = setup();
    speech.autoFinish = true;
    fireEvent.press(screen.getByTestId('pears-role-patient'));
    fireEvent.changeText(screen.getByTestId('pears-code'), '192.168.43.1-4821');
    fireEvent.press(screen.getByTestId('pears-connect'));
    expect(worklet.last('join')).toEqual({ cmd: 'join', host: '192.168.43.1', port: 49737, code: '4821' });
    worklet.emit({ ev: 'ready' });
    expect(screen.getByTestId('pears-waiting')).toBeTruthy();

    const text = 'Take 1 tablet three times a day after food.';
    worklet.emit({ ev: 'message', id: 'm1', text });
    await settle();
    expect(screen.getByTestId('pears-received')).toBeTruthy();
    expect(screen.getByText(text)).toBeTruthy();
    expect(speech.synthesized).toEqual([text]);

    // The same instruction arriving again (a resend) is not read a second time automatically...
    worklet.emit({ ev: 'message', id: 'm1', text });
    await settle();
    expect(speech.synthesized).toEqual([text]);
    // ...but Read again always works.
    fireEvent.press(screen.getByTestId('pears-read-again'));
    await settle();
    expect(speech.synthesized).toEqual([text, text]);
  });

  it('reads a newer instruction and keeps showing it after the pharmacist disconnects', async () => {
    const { worklet, speech } = setup();
    speech.autoFinish = true;
    fireEvent.press(screen.getByTestId('pears-role-patient'));
    fireEvent.changeText(screen.getByTestId('pears-code'), '192.168.43.1-4821');
    fireEvent.press(screen.getByTestId('pears-connect'));
    worklet.emit({ ev: 'ready' });
    worklet.emit({ ev: 'message', id: 'm1', text: 'First' });
    await settle();
    worklet.emit({ ev: 'message', id: 'm2', text: 'Second' });
    await settle();
    expect(speech.synthesized).toEqual(['First', 'Second']);
    worklet.emit({ ev: 'peer-left' });
    worklet.emit({ ev: 'error', message: 'x' });
    await settle();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('shows a connection error and allows another try', () => {
    const { worklet } = setup();
    fireEvent.press(screen.getByTestId('pears-role-patient'));
    fireEvent.changeText(screen.getByTestId('pears-code'), '192.168.43.1-4821');
    fireEvent.press(screen.getByTestId('pears-connect'));
    worklet.emit({ ev: 'error', message: 'timeout' });
    expect(screen.getByTestId('pears-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pears-connect'));
    expect(worklet.commands.filter((c) => c.cmd === 'join')).toHaveLength(2);
  });

  it('stops the worklet and the voice when leaving', () => {
    const { worklet, speech } = setup();
    fireEvent.press(screen.getByTestId('pears-role-patient'));
    fireEvent.press(screen.getByTestId('pears-back'));
    expect(worklet.last('stop')).toBeTruthy();
    expect(speech.stops).toBeGreaterThan(0);
  });
});
