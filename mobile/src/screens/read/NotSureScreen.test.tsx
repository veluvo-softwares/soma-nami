import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { NotSureScreen } from './NotSureScreen';
import { flush } from '../../model-store/testing';
import { FakeSpeechBackend } from '../../reader/testing';
import { SettingsProvider } from '../../settings/SettingsContext';
import { MemorySettingsStorage } from '../../settings/settings';
import { SpeechSession } from '../../speech/session';

async function show(saved: unknown) {
  const backend = new FakeSpeechBackend();
  backend.autoFinish = true;
  const speech = new SpeechSession(backend, () => undefined);
  const onTryAgain = jest.fn();
  const onBack = jest.fn();
  render(
    <SettingsProvider storage={new MemorySettingsStorage(saved)}>
      <NotSureScreen speech={speech} onTryAgain={onTryAgain} onBack={onBack} />
    </SettingsProvider>,
  );
  await act(async () => {
    await flush(20);
  });
  return { speech, onTryAgain, onBack };
}

describe('NotSureScreen', () => {
  it('says plainly it will not guess, and tells the person to ask the pharmacist', async () => {
    await show(null);
    expect(screen.getByText('Sitakisia dozi.')).toBeTruthy();
    expect(screen.getByText('Muulize mfamasia au daktari.')).toBeTruthy();
    expect(screen.getByTestId('not-sure-screen').findByProps({ accessibilityRole: 'header' }).props.accessibilityLabel).toContain(
      'Muulize mfamasia',
    );
  });

  it('English interface: the English words come first and are what the screen reader says', async () => {
    await show({ language: 'en' });
    expect(screen.getByText("I won't guess a dose.")).toBeTruthy();
    const header = screen.getByTestId('not-sure-screen').findByProps({ accessibilityRole: 'header' });
    expect(header.props.accessibilityLabel).toContain('Ask your pharmacist or doctor.');
  });

  it('hides "Mpigie msaidizi" when no helper number was set, or it is too short to dial', async () => {
    await show({ helperNumber: '12' });
    expect(screen.queryByTestId('not-sure-call-helper')).toBeNull();
  });

  it('"Mpigie msaidizi" dials the helper, and a dialler that cannot open is not silent', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { speech } = await show({ helperNumber: '+254 700 000 000' });
    const say = jest.spyOn(speech, 'say');
    fireEvent.press(screen.getByTestId('not-sure-call-helper'));
    expect(open).toHaveBeenCalledWith('tel:+254700000000');

    open.mockRejectedValueOnce(new Error('no dialler'));
    fireEvent.press(screen.getByTestId('not-sure-call-helper'));
    await act(async () => {
      await flush(5);
    });
    expect(say).toHaveBeenCalledWith('error');
  });

  it('every button keeps its Try again / Back handlers', async () => {
    const { onTryAgain, onBack } = await show(null);
    fireEvent.press(screen.getByTestId('not-sure-try-again'));
    fireEvent.press(screen.getByTestId('not-sure-back'));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
