import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import { useBi } from '../../settings/SettingsContext';
import type { SpeechSession } from '../../speech/session';
import { fonts, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  speech: SpeechSession;
  onRead: () => void;
  /** Opens caregiver setup. Left out where there is no setup screen. */
  onSetup?: () => void;
  /** Opens Dawa zangu. Left out where there is none. */
  onMedicines?: () => void;
}

/** Screen 1 (docs/ui.md): almost the whole screen is one yellow button. */
export function HomeScreen({ speech, onRead, onSetup, onMedicines }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  const offline = bi('Inafanya kazi bila intaneti', 'Works without internet');

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
      <View accessible accessibilityLabel={offline.main} testID="home-offline">
        <Text style={styles.offline}>{offline.main}</Text>
        <Text style={styles.offlineEn}>{offline.sub}</Text>
      </View>
      {onMedicines ? (
        <BigButton testID="home-medicines" tone="ask" icon="pill" sw="Dawa zangu" en="My medicines" onPress={onMedicines} />
      ) : null}
      {onSetup ? (
        <BigButton testID="home-setup" tone="plain" icon="cog" sw="Mipangilio" en="Setup" onPress={onSetup} />
      ) : null}
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
