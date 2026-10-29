import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useBi } from '../settings/SettingsContext';
import { fonts, radius, space, touch, type, usePalette } from '../theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  icon: IconName;
  /** Swahili word. Shown large and read as the label (in English mode the two swap). */
  sw: string;
  /** English line, shown under it and read as the hint. */
  en: string;
  onPress: () => void;
  /** Accent: yellow main action, blue ask, orange not sure, or outline on the background. */
  tone?: 'primary' | 'ask' | 'warning' | 'plain';
  disabled?: boolean;
  /** For a choice among several (language, speed, theme): the one chosen. Colour is never the only signal: a tick is drawn too. */
  selected?: boolean;
  /** Show the Swahili word first even in English mode (the language names themselves). */
  fixedOrder?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'normal' | 'huge';
  /** 'stacked': icon above the words, for two buttons side by side. */
  layout?: 'row' | 'stacked';
  /** Replaces the accessibility hint (default: the second line). */
  hint?: string;
  /** For a button that opens a panel: whether the panel is open. */
  expanded?: boolean;
}

/**
 * ui.md rule 6: every button has an icon, a Swahili word and a small English line. Never smaller than 88 pt.
 * Words never break across lines: the text shrinks to fit (adjustsFontSizeToFit), and a half-width pair
 * should use layout="stacked" or be stacked full width.
 */
export function BigButton({
  icon,
  sw,
  en,
  onPress,
  tone = 'primary',
  disabled,
  selected,
  fixedOrder,
  testID,
  style,
  size = 'normal',
  layout = 'row',
  hint,
  expanded,
}: Props) {
  const p = usePalette();
  const swapped = useBi()(sw, en);
  const { main, sub } = fixedOrder ? { main: sw, sub: en } : swapped;
  const bg = tone === 'primary' ? p.primary : tone === 'ask' ? p.ask : tone === 'warning' ? p.warning : 'transparent';
  const fg = tone === 'plain' ? p.text : p.onAccent;
  const huge = size === 'huge';
  const stacked = !huge && layout === 'stacked';
  const state: { disabled: boolean; selected?: boolean; expanded?: boolean } = { disabled: !!disabled };
  if (selected !== undefined) state.selected = selected;
  if (expanded !== undefined) state.expanded = expanded;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={main}
      accessibilityHint={hint ?? sub}
      accessibilityState={state}
      style={({ pressed }) => [
        styles.base,
        huge ? styles.huge : stacked ? styles.stacked : styles.row,
        {
          backgroundColor: bg,
          borderColor: tone === 'plain' ? (selected ? p.primary : p.outline) : bg,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        selected && styles.selected,
        style,
      ]}
    >
      <MaterialCommunityIcons name={selected ? 'check-circle' : icon} size={huge ? 96 : stacked ? 32 : 40} color={fg} />
      <View style={huge || stacked ? styles.centeredBox : styles.text}>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[styles.sw, huge && styles.swHuge, stacked && styles.centered, { color: fg }]}
        >
          {main}
        </Text>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.en, stacked && styles.centered, { color: fg }]}
        >
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.minSize,
    minWidth: touch.minSize,
    borderRadius: radius.lg,
    borderWidth: 3,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  selected: { borderWidth: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stacked: { alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.sm },
  huge: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  text: { flexShrink: 1 },
  centeredBox: { alignItems: 'center', alignSelf: 'stretch' },
  centered: { textAlign: 'center' },
  sw: { fontFamily: fonts.bold, fontSize: type.button },
  swHuge: { fontSize: type.display, textAlign: 'center' },
  en: { fontFamily: fonts.regular, fontSize: type.hint },
});
