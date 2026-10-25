import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import type { SpeechSession } from '../../speech/session';
import { fonts, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  speech: SpeechSession;
  onTryAgain: () => void;
  onBack: () => void;
}

/**
 * Screen 5 (docs/ui.md, Not sure): nothing from the photo is shown or read.
 * C6 adds "Mpigie msaidizi" (call my helper) once caregiver setup exists.
 */
export function NotSureScreen({ speech, onTryAgain, onBack }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);

  useEffect(() => {
    void speech.speak([
      { kind: 'clip', phrase: 'not_sure' },
      { kind: 'clip', phrase: 'try_again_light' },
    ]);
  }, [speech]);

  return (
    <View style={styles.container} testID="not-sure-screen">
      <View style={styles.body} accessible accessibilityRole="header">
        <MaterialCommunityIcons name="alert-circle" size={88} color={p.warning} />
        <Text style={styles.heading}>Sijaweza kusoma vizuri</Text>
        <Text style={styles.en}>I couldn&apos;t read this clearly</Text>
        <Text style={styles.line}>Sitakisia dozi.</Text>
        <Text style={styles.en}>I won&apos;t guess a dose.</Text>
        <Text style={styles.line}>Muulize mfamasia au daktari.</Text>
        <Text style={styles.en}>Ask your pharmacist or doctor.</Text>
      </View>
      <BigButton testID="not-sure-try-again" tone="warning" icon="camera-retake" sw="Jaribu tena" en="Try again" onPress={onTryAgain} />
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
