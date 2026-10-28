import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { ModelClient } from './model-store/ensureModels';
import type { ModelEntry } from './model-store/manifest';
import { canRead } from './model-store/modelsState';
import { useModels } from './model-store/useModels';
import type { ReaderServices } from './reader/types';
import { SettingsProvider, useSettings } from './settings/SettingsContext';
import { MemorySettingsStorage, type SettingsStorage } from './settings/settings';
import { ModelsScreen } from './screens/ModelsScreen';
import { ReadFlow } from './screens/read/ReadFlow';
import { SetupScreen } from './screens/SetupScreen';
import { ThemeProvider, usePalette, type ThemeName } from './theme';

interface Props {
  client: ModelClient;
  manifest: readonly ModelEntry[];
  /** OCR, voice and photos: QVAC on the phone, fakes in tests. */
  reader: ReaderServices;
  /** Where the caregiver's choices are saved. The app passes a file on the phone. */
  settingsStorage?: SettingsStorage;
  /** Forces a theme over the saved choice (tests and previews). */
  theme?: ThemeName;
}

/** Keeps the screen on during a long download so the phone doesn't sleep and suspend the app. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * The read gate: the reader is only reachable when every model is on the
 * phone. Until then the models screen is all there is. Caregiver setup
 * (language, voice speed, theme, helper's number, models) opens from Home.
 */
export function AppShell({ client, manifest, reader, settingsStorage, theme }: Props) {
  // Without storage (tests) choices last until the app closes.
  const [fallback] = useState(() => new MemorySettingsStorage());
  return (
    <SettingsProvider storage={settingsStorage ?? fallback} override={theme ? { theme } : undefined}>
      <Themed>
        <Shell client={client} manifest={manifest} reader={reader} />
      </Themed>
    </SettingsProvider>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  return <ThemeProvider name={settings.theme}>{children}</ThemeProvider>;
}

function Shell({ client, manifest, reader }: Omit<Props, 'theme' | 'settingsStorage'>) {
  const { state, startDownload } = useModels(client, manifest);
  const { settings } = useSettings();
  const palette = usePalette();
  const [setup, setSetup] = useState(false);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
        {state.phase === 'downloading' ? <KeepAwake /> : null}
        {setup ? (
          <SetupScreen manifest={manifest} state={state} onDownload={startDownload} onDone={() => setSetup(false)} />
        ) : canRead(state) ? (
          <ReadFlow services={reader} onOpenSetup={() => setSetup(true)} />
        ) : (
          <ModelsScreen manifest={manifest} state={state} onDownload={startDownload} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
