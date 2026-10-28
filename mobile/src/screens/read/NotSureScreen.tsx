import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import { dialNumber } from '../../settings/settings';
import { useBi, useSettings } from '../../settings/SettingsContext';
import type { SpeechSession } from '../../speech/session';
import { fonts, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  speech: SpeechSession;
  onTryAgain: () => void;
  onBack: () => void;
}

/**
 * Screen 5 (docs/ui.md, Not sure): nothing from the photo is shown or read.
 * "Mpigie msaidizi" (call my helper) dials the number from caregiver setup,
 * and isn't shown when there is none.
 */
export function NotSureScreen({ speech, onTryAgain, onBack }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  const { settings } = useSettings();
  const helper = dialNumber(settings.helperNumber);

  const heading = bi('Sijaweza kusoma vizuri', "I couldn't read this clearly");
  const noGuess = bi('Sitakisia dozi.', "I won't guess a dose.");
  const ask = bi('Muulize mfamasia au daktari.', 'Ask your pharmacist or doctor.');

  useEffect(() => {
    void speech.speak([
      { kind: 'clip', phrase: 'not_sure' },
      { kind: 'clip', phrase: 'try_again_light' },
    ]);
  }, [speech]);

  return (
    <View style={styles.container} testID="not-sure-screen">
      <View style={styles.body} accessible accessibilityRole="header" accessibilityLabel={`${heading.main}. ${noGuess.main} ${ask.main}`}>
        <MaterialCommunityIcons name="alert-circle" size={88} color={p.warning} />
        <Text style={styles.heading}>{heading.main}</Text>
        <Text style={styles.en}>{heading.sub}</Text>
        <Text style={styles.line}>{noGuess.main}</Text>
        <Text style={styles.en}>{noGuess.sub}</Text>
        <Text style={styles.line}>{ask.main}</Text>
        <Text style={styles.en}>{ask.sub}</Text>
      </View>
      <BigButton testID="not-sure-try-again" tone="warning" icon="camera-retake" sw="Jaribu tena" en="Try again" onPress={onTryAgain} />
      {helper ? (
        <BigButton
          testID="not-sure-call-helper"
          tone="ask"
          icon="phone"
          sw="Mpigie msaidizi"
          en="Call my helper"
          onPress={() => {
            speech.stop();
            Linking.openURL(`tel:${helper}`).catch((e) => {
              console.warn('[soma] could not open the dialler', e);
              void speech.say('error');
            });
          }}
        />
      ) : null}
      <BigButton testID="not-sure-back" tone="plain" icon="arrow-left" sw="Rudi" en="Back" onPress={onBack} />
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, padding: space.lg, gap: space.md, backgroundColor: p.background },
    body: { flex: 1, justifyContent: 'center', gap: space.xs },
    heading: { fontFamily: fonts.bold, fontSize: type.headingLarge, color: p.warning },
    line: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text, marginTop: space.md },
    en: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
  });
}
