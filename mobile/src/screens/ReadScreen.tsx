import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, space, type, usePalette, type Palette } from '../theme';

/**
 * Placeholder for the read flow (card C4: Home, Aiming, Reading in docs/ui.md).
 * AppShell only renders this once every model is ready.
 */
export function ReadScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.container} testID="read-screen">
      <Text style={styles.title} accessibilityRole="header">
        Soma Nami
      </Text>
      <Text style={styles.body}>Modeli ziko tayari.</Text>
      <Text style={styles.english}>All models ready. Reading comes next.</Text>
      <Text style={styles.body}>Inafanya kazi bila intaneti</Text>
      <Text style={styles.english}>Works without internet</Text>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: space.lg,
      gap: space.sm,
      justifyContent: 'center',
      backgroundColor: p.background,
    },
    title: { fontFamily: fonts.bold, fontSize: type.display, color: p.primary },
    body: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text },
    english: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
  });
}
