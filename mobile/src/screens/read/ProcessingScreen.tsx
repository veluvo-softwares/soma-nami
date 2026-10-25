import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import type { SpeechSession } from '../../speech/session';
import { fonts, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  speech: SpeechSession;
  onBack: () => void;
}

/** OCR is running on the photo; on the phone this takes a while, so say so. */
export function ProcessingScreen({ speech, onBack }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);

  useEffect(() => {
    void speech.say('reading_wait');
  }, [speech]);

  return (
    <View style={styles.container} testID="processing-screen">
      <View style={styles.center} accessible accessibilityLabel="Ninasoma. Subiri kidogo." accessibilityHint="Reading. Please wait.">
        <ActivityIndicator size="large" color={p.primary} />
        <Text style={styles.sw}>Ninasoma…</Text>
        <Text style={styles.en}>Reading. Please wait.</Text>
      </View>
      <BigButton testID="processing-back" tone="plain" icon="arrow-left" sw="Rudi" en="Back" onPress={onBack} />
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, padding: space.lg, backgroundColor: p.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
    sw: { fontFamily: fonts.bold, fontSize: type.headingLarge, color: p.text },
    en: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
  });
}
