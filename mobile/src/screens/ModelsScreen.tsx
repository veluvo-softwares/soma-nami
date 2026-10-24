import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes, type ModelEntry } from '../model-store/manifest';
import {
  missingBytes,
  overallProgress,
  type ModelState,
  type ModelsState,
} from '../model-store/modelsState';
import { fonts, radius, space, touch, type, usePalette, type Palette } from '../theme';

interface Props {
  manifest: readonly ModelEntry[];
  state: ModelsState;
  onDownload: () => void;
}

/** Swahili first, English under it (docs/ui.md Rule 6). C6 adds the language switch. */
interface Bilingual {
  sw: string;
  en: string;
}

const STATUS_TEXT: Record<ModelState['status'], Bilingual> = {
  unknown: { sw: 'Inakagua…', en: 'Checking…' },
  missing: { sw: 'Haijapakuliwa', en: 'Not downloaded' },
  downloading: { sw: 'Inapakua', en: 'Downloading' },
  ready: { sw: 'Tayari', en: 'ready' },
  error: { sw: 'Imeshindwa', en: 'Failed' },
};

export function ModelsScreen({ manifest, state, onDownload }: Props) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const pct = Math.round(overallProgress(state) * 100);
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const showButton = state.phase === 'needs-download' || state.phase === 'error';
  const phase = phaseText(state, pct);
  const button: Bilingual =
    state.phase === 'error'
      ? { sw: 'Jaribu tena', en: 'Try again' }
      : { sw: 'Pakua', en: `Download models (${formatBytes(missingBytes(state))})` };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Mipangilio ya modeli
      </Text>
      <Text style={styles.subtitle}>Models</Text>
      <Text style={styles.body}>
        Soma Nami inasoma kwenye simu, bila intaneti. Pakua modeli mara moja, kwenye Wi-Fi.
      </Text>
      <Text style={styles.english}>
        Soma Nami reads on the phone, with no internet. Download the models once, on Wi-Fi, before
        you switch to airplane mode.
      </Text>

      <View accessible accessibilityLabel={phase.sw} accessibilityHint={phase.en}>
        <Text style={styles.phase} testID="models-phase">
          {phase.sw}
        </Text>
        <Text style={styles.english}>{phase.en}</Text>
      </View>

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
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={onDownload}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={button.sw}
          accessibilityHint={button.en}
          testID="models-download"
        >
          <Text style={styles.buttonText}>{button.sw}</Text>
          <Text style={styles.buttonEnglish}>{button.en}</Text>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {manifest.map((m) => {
          const s = state.models[m.name];
          const status = STATUS_TEXT[s.status];
          const detail =
            s.status === 'downloading'
              ? `${formatBytes(s.downloaded)} / ${formatBytes(s.total)}`
              : formatBytes(s.total);
          return (
            <View key={m.name} style={styles.row} testID={`model-${m.name}`}>
              <Text style={styles.rowLabel}>{m.label}</Text>
              <Text style={styles.rowStatus}>
                {status.sw} ({status.en}) · {detail}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function phaseText(state: ModelsState, pct: number): Bilingual {
  switch (state.phase) {
    case 'checking':
      return { sw: 'Inakagua modeli…', en: 'Checking models on this phone…' };
    case 'needs-download':
      return {
        sw: 'Modeli hazipo. Unganisha Wi-Fi upakue.',
        en: 'Models are missing. Connect to Wi-Fi and download them.',
      };
    case 'downloading':
      return { sw: `Inapakua… ${pct}%`, en: `Downloading… ${pct}%. Keep the app open.` };
    case 'ready':
      return { sw: 'Tayari', en: 'All models ready' };
    case 'error':
      return { sw: 'Upakuaji umesimama.', en: 'Download stopped.' };
  }
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { padding: space.lg, gap: space.md, backgroundColor: p.background },
    title: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    subtitle: { fontFamily: fonts.regular, fontSize: type.body, color: p.textMuted },
    body: { fontFamily: fonts.regular, fontSize: type.bodyLarge, lineHeight: 32, color: p.text },
    english: { fontFamily: fonts.regular, fontSize: type.hint, lineHeight: 26, color: p.textMuted },
    phase: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text },
    error: { fontFamily: fonts.regular, fontSize: type.body, color: p.warning },
    bar: { height: 20, borderRadius: 10, backgroundColor: p.outline, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: p.primary },
    button: {
      minHeight: touch.minSize,
      minWidth: touch.minSize,
      borderRadius: radius.lg,
      backgroundColor: p.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.md,
      paddingVertical: space.md,
    },
    pressed: { opacity: 0.8 },
    buttonText: { fontFamily: fonts.bold, fontSize: type.button, color: p.onAccent },
    buttonEnglish: { fontFamily: fonts.regular, fontSize: type.hint, color: p.onAccent },
    list: { gap: space.md },
    row: {
      paddingVertical: space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: p.outline,
    },
    rowLabel: { fontFamily: fonts.regular, fontSize: type.body, color: p.text },
    rowStatus: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
  });
}
