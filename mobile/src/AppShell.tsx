import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { ModelClient } from './model-store/ensureModels';
import type { ModelEntry } from './model-store/manifest';
import { canRead } from './model-store/modelsState';
import { useModels } from './model-store/useModels';
import { ModelsScreen } from './screens/ModelsScreen';
import { ReadScreen } from './screens/ReadScreen';
import { ThemeProvider, usePalette, type ThemeName } from './theme';

interface Props {
  client: ModelClient;
  manifest: readonly ModelEntry[];
  /** Dark by default; caregiver setup (C6) will make this a saved choice. */
  theme?: ThemeName;
}

/** Keeps the screen on during a long download so the phone doesn't sleep and suspend the app. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * The read gate: the read screen is only reachable when every model is on the
 * phone. Until then the models screen is all there is.
 */
export function AppShell({ client, manifest, theme = 'dark' }: Props) {
  return (
    <ThemeProvider name={theme}>
      <Shell client={client} manifest={manifest} theme={theme} />
    </ThemeProvider>
  );
}

function Shell({ client, manifest, theme }: Required<Props>) {
  const { state, startDownload } = useModels(client, manifest);
  const palette = usePalette();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        {state.phase === 'downloading' ? <KeepAwake /> : null}
        {canRead(state) ? (
          <ReadScreen />
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
