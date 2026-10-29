import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '../components/BigButton';
import { LanguageChoice } from '../components/LanguageChoice';
import type { ModelEntry } from '../model-store/manifest';
import type { ModelsState } from '../model-store/modelsState';
import { sanitizeHelperNumber, type VoiceSpeed } from '../settings/settings';
import { useBi, useSettings } from '../settings/SettingsContext';
import { fonts, radius, space, touch, type, usePalette, type Palette } from '../theme';
import { MedicinesSetup } from './MedicinesSetup';
import { DownloadButton, ModelRows } from './ModelsScreen';

interface Props {
  manifest: readonly ModelEntry[];
  state: ModelsState;
  onDownload: () => void;
  onDone: () => void;
}

const SPEEDS: { value: VoiceSpeed; sw: string; en: string; icon: 'tortoise' | 'play' | 'run-fast' }[] = [
  { value: 'slow', sw: 'Polepole', en: 'Slow', icon: 'tortoise' },
  { value: 'normal', sw: 'Kawaida', en: 'Normal', icon: 'play' },
  { value: 'fast', sw: 'Haraka', en: 'Fast', icon: 'run-fast' },
];

/**
 * Screen 7 (docs/ui.md, Caregiver setup): done once by a helper. Language of
 * the app's words, voice speed, theme, the helper's number and the models.
 * Everything is stored only on the phone.
 */
export function SetupScreen({ manifest, state, onDownload, onDone }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  const { settings, update } = useSettings();

  const title = bi('Mipangilio', 'Setup');
  const forHelper = bi('Kwa msaidizi, mara moja tu.', 'For a helper, once.');
  const language = bi('Lugha ya programu', 'App language');
  const speed = bi('Kasi ya sauti', 'Voice speed');
  const theme = bi('Mwonekano', 'Theme');
  const helper = bi('Namba ya msaidizi', "Helper's phone number");
  const helperNote = bi('Inabaki kwenye simu hii tu.', 'Stays on this phone only.');
  const models = bi('Modeli', 'Models');
  const medicines = bi('Dawa zangu', 'My medicines');

  return (
    <ScrollView contentContainerStyle={styles.container} testID="setup-screen">
      <Text style={styles.title} accessibilityRole="header">
        {title.main}
      </Text>
      <Text style={styles.en}>{title.sub} · {forHelper.main}</Text>

      <Section styles={styles} label={language} />
      <LanguageChoice />

      <Section styles={styles} label={speed} />
      <View style={styles.speeds} accessibilityRole="radiogroup">
        {SPEEDS.map((s) => (
          <BigButton
            key={s.value}
            testID={`speed-${s.value}`}
            tone="plain"
            icon={s.icon}
            sw={s.sw}
            en={s.en}
            selected={settings.voiceSpeed === s.value}
            onPress={() => update({ voiceSpeed: s.value })}
          />
        ))}
      </View>

      <Section styles={styles} label={theme} />
      <View style={styles.row} accessibilityRole="radiogroup">
        <BigButton
          testID="theme-dark"
          tone="plain"
          icon="weather-night"
          sw="Giza"
          en="Dark"
          selected={settings.theme === 'dark'}
          onPress={() => update({ theme: 'dark' })}
          style={styles.half}
        />
        <BigButton
          testID="theme-light"
          tone="plain"
          icon="white-balance-sunny"
          sw="Mwanga"
          en="Light"
          selected={settings.theme === 'light'}
          onPress={() => update({ theme: 'light' })}
          style={styles.half}
        />
      </View>

      <Section styles={styles} label={helper} />
      <TextInput
        testID="helper-number"
        style={styles.input}
        value={settings.helperNumber}
        onChangeText={(t) => update({ helperNumber: sanitizeHelperNumber(t) })}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={20}
        placeholder="+254 …"
        placeholderTextColor={p.textMuted}
        accessibilityLabel={helper.main}
        accessibilityHint={`${helper.sub}. ${helperNote.main}`}
      />
      <Text style={styles.en}>{helperNote.main} · {helperNote.sub}</Text>

      <Section styles={styles} label={medicines} />
      <MedicinesSetup />

      <Section styles={styles} label={models} />
      <DownloadButton state={state} onDownload={onDownload} />
      <ModelRows manifest={manifest} state={state} />

      <BigButton testID="setup-done" icon="check" sw="Tayari" en="Done" onPress={onDone} />
    </ScrollView>
  );
}

function Section({ label, styles }: { label: { main: string; sub: string }; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.section} accessible accessibilityRole="header" accessibilityLabel={label.main} accessibilityHint={label.sub}>
      <Text style={styles.sectionMain}>{label.main}</Text>
      <Text style={styles.en}>{label.sub}</Text>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { padding: space.lg, gap: space.md, backgroundColor: p.background },
    title: { fontFamily: fonts.bold, fontSize: type.headingLarge, color: p.text },
    section: { marginTop: space.md },
    sectionMain: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    en: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    row: { flexDirection: 'row', gap: space.md },
    half: { flex: 1, paddingHorizontal: space.md },
    speeds: { gap: space.md },
    input: {
      minHeight: touch.minSize,
      borderWidth: 3,
      borderColor: p.outline,
      borderRadius: radius.lg,
      paddingHorizontal: space.md,
      fontFamily: fonts.bold,
      fontSize: type.heading,
      color: p.text,
    },
  });
}
