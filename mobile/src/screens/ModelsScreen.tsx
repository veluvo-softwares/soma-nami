import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes, type ModelEntry } from '../model-store/manifest';
import {
  missingBytes,
  overallProgress,
  type ModelState,
  type ModelsState,
} from '../model-store/modelsState';

interface Props {
  manifest: readonly ModelEntry[];
  state: ModelsState;
  onDownload: () => void;
}

const STATUS_TEXT: Record<ModelState['status'], string> = {
  unknown: 'Checking…',
  missing: 'Not downloaded',
  downloading: 'Downloading',
  ready: 'ready',
  error: 'Failed',
};

export function ModelsScreen({ manifest, state, onDownload }: Props) {
  const pct = Math.round(overallProgress(state) * 100);
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const showButton = state.phase === 'needs-download' || state.phase === 'error';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Models
      </Text>
      <Text style={styles.body}>
        Soma Nami reads on the phone, with no internet. It needs its models first. Download them
        once, on Wi-Fi, before you switch to airplane mode.
      </Text>

      <Text style={styles.phase} testID="models-phase">
        {phaseText(state, pct)}
      </Text>

      {state.phase === 'downloading' ? (
        <View
          style={styles.bar}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      ) : null}

      {state.phase === 'error' && state.error ? (
        <Text style={styles.error} testID="models-error">
          {state.error}
        </Text>
      ) : null}

      {showButton ? (
        <Pressable
          style={styles.button}
          onPress={onDownload}
          disabled={busy}
          accessibilityRole="button"
          testID="models-download"
        >
          <Text style={styles.buttonText}>
            {state.phase === 'error'
              ? 'Try again'
              : `Download models (${formatBytes(missingBytes(state))})`}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {manifest.map((m) => {
          const s = state.models[m.name];
          const detail =
            s.status === 'downloading'
              ? `${formatBytes(s.downloaded)} / ${formatBytes(s.total)}`
              : formatBytes(s.total);
          return (
            <View key={m.name} style={styles.row} testID={`model-${m.name}`}>
              <Text style={styles.rowLabel}>{m.label}</Text>
              <Text style={styles.rowStatus}>
                {STATUS_TEXT[s.status]} · {detail}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function phaseText(state: ModelsState, pct: number): string {
  switch (state.phase) {
    case 'checking':
      return 'Checking models on this phone…';
    case 'needs-download':
      return 'Models are missing. Connect to Wi-Fi and download them.';
    case 'downloading':
      return `Downloading… ${pct}%. Keep the app open.`;
    case 'ready':
      return 'All models ready';
    case 'error':
      return 'Download stopped.';
  }
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700' },
  body: { fontSize: 20, lineHeight: 28 },
  phase: { fontSize: 22, fontWeight: '600' },
  error: { fontSize: 18, color: '#b00020' },
  bar: { height: 16, borderRadius: 8, backgroundColor: '#ddd', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1b7f3b' },
  button: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: '#1b4f9c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  list: { gap: 12 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#999' },
  rowLabel: { fontSize: 20 },
  rowStatus: { fontSize: 16, color: '#444' },
});
