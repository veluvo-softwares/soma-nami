import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import type { SpeechSession } from '../../speech/session';
import { fonts, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  speech: SpeechSession;
  onRead: () => void;
}

/** Screen 1 (docs/ui.md): almost the whole screen is one yellow button. */
export function HomeScreen({ speech, onRead }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);

  useEffect(() => {
    void speech.say('home_open');
  }, [speech]);

  return (
    <View style={styles.container} testID="read-screen">
      <BigButton
        testID="home-read"
        size="huge"
        icon="camera"
        sw="Gusa kusoma"
        en="Tap to read"
        onPress={onRead}
        style={styles.big}
      />
      <Text style={styles.offline}>Inafanya kazi bila intaneti</Text>
      <Text style={styles.offlineEn}>Works without internet</Text>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, padding: space.lg, gap: space.sm, backgroundColor: p.background },
    big: { flex: 1, marginBottom: space.md },
    offline: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text, textAlign: 'center' },
    offlineEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted, textAlign: 'center' },
  });
}
