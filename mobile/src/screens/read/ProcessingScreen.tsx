import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import { useBi } from '../../settings/SettingsContext';
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
  const bi = useBi();
  const wait = bi('Ninasoma. Subiri kidogo.', 'Reading. Please wait.');
  const title = bi('Ninasoma…', 'Reading…');

  useEffect(() => {
    void speech.say('reading_wait');
  }, [speech]);

  return (
    <View style={styles.container} testID="processing-screen">
      <View style={styles.center} accessible accessibilityLabel={wait.main} accessibilityHint={wait.sub} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={p.primary} />
        <Text style={styles.sw}>{title.main}</Text>
        <Text style={styles.en}>{title.sub}</Text>
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
