import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LanguageChoice } from '../components/LanguageChoice';
import { formatBytes, type ModelEntry } from '../model-store/manifest';
import {
  missingBytes,
  overallProgress,
  type ModelState,
  type ModelsState,
} from '../model-store/modelsState';
import { useBi } from '../settings/SettingsContext';
import { fonts, radius, space, touch, type, usePalette, type Palette } from '../theme';

interface Props {
  manifest: readonly ModelEntry[];
  state: ModelsState;
  onDownload: () => void;
}

/** Swahili first, English under it (docs/ui.md Rule 6); the two swap in English mode. */
export interface Bilingual {
  sw: string;
  en: string;
}

export const STATUS_TEXT: Record<ModelState['status'], Bilingual> = {
  unknown: { sw: 'Inakagua…', en: 'Checking…' },
  missing: { sw: 'Haijapakuliwa', en: 'Not downloaded' },
  downloading: { sw: 'Inapakua', en: 'Downloading' },
  ready: { sw: 'Tayari', en: 'ready' },
  error: { sw: 'Imeshindwa', en: 'Failed' },
};

export function downloadLabel(state: ModelsState): Bilingual {
  return state.phase === 'error'
    ? { sw: 'Jaribu tena', en: 'Try again' }
    : { sw: 'Pakua', en: `Download models (${formatBytes(missingBytes(state))})` };
}

export function phaseText(state: ModelsState, pct: number): Bilingual {
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

/** The one yellow download button (Pakua); shown only when there is something to download. */
export function DownloadButton({ state, onDownload }: { state: ModelsState; onDownload: () => void }) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const show = state.phase === 'needs-download' || state.phase === 'error';
  const label = downloadLabel(state);
  const { main, sub } = bi(label.sw, label.en);
  if (!show) return null;
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onDownload}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={main}
      accessibilityHint={sub}
      testID="models-download"
    >
      <Text style={styles.buttonText}>{main}</Text>
      <Text style={styles.buttonEnglish}>{sub}</Text>
    </Pressable>
  );
}

/** Each model with its status and size. */
export function ModelRows({ manifest, state }: { manifest: readonly ModelEntry[]; state: ModelsState }) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  return (
    <View style={styles.list}>
      {manifest.map((m) => {
        const s = state.models[m.name];
        const status = bi(STATUS_TEXT[s.status].sw, STATUS_TEXT[s.status].en);
        const detail =
          s.status === 'downloading' ? `${formatBytes(s.downloaded)} / ${formatBytes(s.total)}` : formatBytes(s.total);
        const text = `${status.main} (${status.sub}) · ${detail}`;
        return (
          <View key={m.name} style={styles.row} testID={`model-${m.name}`} accessible accessibilityLabel={`${m.label}: ${text}`}>
            <Text style={styles.rowLabel}>{m.label}</Text>
            <Text style={styles.rowStatus}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function ModelsScreen({ manifest, state, onDownload }: Props) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const bi = useBi();
  const pct = Math.round(overallProgress(state) * 100);
  const rawPhase = phaseText(state, pct);
  const phase = bi(rawPhase.sw, rawPhase.en);
  const title = bi('Mipangilio ya modeli', 'Models');
  const body = bi(
    'Soma Nami inasoma kwenye simu, bila intaneti. Pakua modeli mara moja, kwenye Wi-Fi.',
    'Soma Nami reads on the phone, with no internet. Download the models once, on Wi-Fi, before you switch to airplane mode.',
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LanguageChoice />
      <Text style={styles.title} accessibilityRole="header">
        {title.main}
      </Text>
      <Text style={styles.subtitle}>{title.sub}</Text>
      <Text style={styles.body}>{body.main}</Text>
      <Text style={styles.english}>{body.sub}</Text>

      <View accessible accessibilityLabel={phase.main} accessibilityHint={phase.sub}>
        <Text style={styles.phase} testID="models-phase">
          {phase.main}
        </Text>
        <Text style={styles.english}>{phase.sub}</Text>
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

      <DownloadButton state={state} onDownload={onDownload} />
      <ModelRows manifest={manifest} state={state} />
    </ScrollView>
  );
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
