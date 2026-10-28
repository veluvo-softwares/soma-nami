import { StyleSheet, View } from 'react-native';

import { useSettings } from '../settings/SettingsContext';
import { space } from '../theme';
import { BigButton } from './BigButton';

/** Kiswahili / English: the language of the app's own words (never of a label). */
export function LanguageChoice() {
  const { settings, update } = useSettings();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      <BigButton
        testID="language-sw"
        tone="plain"
        icon="translate"
        sw="Kiswahili"
        en="Swahili"
        fixedOrder
        selected={settings.language === 'sw'}
        onPress={() => update({ language: 'sw' })}
        style={styles.half}
      />
      <BigButton
        testID="language-en"
        tone="plain"
        icon="translate"
        sw="English"
        en="Kiingereza"
        fixedOrder
        selected={settings.language === 'en'}
        onPress={() => update({ language: 'en' })}
        style={styles.half}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, paddingHorizontal: space.md },
});
