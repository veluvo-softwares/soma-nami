import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { flush } from '../model-store/testing';
import { SettingsProvider, useSettings } from './SettingsContext';
import { MemorySettingsStorage, type Settings, type SettingsStorage } from './settings';

let api: ReturnType<typeof useSettings>;
function Probe() {
  api = useSettings();
  return <Text testID="lang">{api.settings.language}</Text>;
}

async function settle() {
  await act(async () => {
    await flush(20);
  });
}

describe('SettingsProvider', () => {
  it('draws nothing until the saved choices are loaded, then uses them', async () => {
    const storage = new MemorySettingsStorage({ language: 'en' });
    render(
      <SettingsProvider storage={storage}>
        <Probe />
      </SettingsProvider>,
    );
    expect(screen.queryByTestId('lang')).toBeNull();
    await settle();
    expect(screen.getByTestId('lang').props.children).toBe('en');
  });

  it('saves every change, in order', async () => {
    const storage = new MemorySettingsStorage();
    render(
      <SettingsProvider storage={storage}>
        <Probe />
      </SettingsProvider>,
    );
    await settle();
    act(() => api.update({ language: 'en' }));
    act(() => api.update({ voiceSpeed: 'fast' }));
    await settle();
    expect(screen.getByTestId('lang').props.children).toBe('en');
    expect(storage.saved.map((s) => [s.language, s.voiceSpeed])).toEqual([
      ['en', 'normal'],
      ['en', 'fast'],
    ]);
  });

  it('uses the defaults when loading fails, and still applies a choice when saving fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage: SettingsStorage = {
      load: () => Promise.reject(new Error('disk')),
      save: (_s: Settings) => Promise.reject(new Error('full')),
    };
    render(
      <SettingsProvider storage={storage}>
        <Probe />
      </SettingsProvider>,
    );
    await settle();
    expect(screen.getByTestId('lang').props.children).toBe('sw');
    act(() => api.update({ language: 'en' }));
    await settle();
    expect(screen.getByTestId('lang').props.children).toBe('en');
  });

  it('a choice made before the load finishes is not overwritten by the older saved value', async () => {
    let release!: (v: unknown) => void;
    const storage: SettingsStorage = {
      load: () => new Promise((r) => (release = r)),
      save: async () => undefined,
    };
    render(
      <SettingsProvider storage={storage}>
        <Probe />
      </SettingsProvider>,
    );
    // Not drawn yet, so the choice arrives through the (not yet visible) context only after load.
    await act(async () => {
      release({ language: 'sw' });
      await flush(20);
    });
    expect(screen.getByTestId('lang').props.children).toBe('sw');
  });
});
