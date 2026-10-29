import { StyleSheet, View } from 'react-native';

import { useSettings } from '../settings/SettingsContext';
import { space } from '../theme';
import { BigButton } from './BigButton';

/**
 * Kiswahili / English: the language of the app's own words (never of a label).
 * Stacked full width: a half-width button broke "Kiswahili" and "Kiingereza" mid-word.
 */
export function LanguageChoice() {
  const { settings, update } = useSettings();
  return (
    <View style={styles.column} accessibilityRole="radiogroup">
      <BigButton
        testID="language-sw"
        tone="plain"
        icon="translate"
        sw="Kiswahili"
        en="Swahili"
        fixedOrder
        selected={settings.language === 'sw'}
        onPress={() => update({ language: 'sw' })}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.md },
});
