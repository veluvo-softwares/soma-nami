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
}

/** ui.md rule 6: every button has an icon, a Swahili word and a small English line. Never smaller than 88 pt. */
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
}: Props) {
  const p = usePalette();
  const swapped = useBi()(sw, en);
  const { main, sub } = fixedOrder ? { main: sw, sub: en } : swapped;
  const bg = tone === 'primary' ? p.primary : tone === 'ask' ? p.ask : tone === 'warning' ? p.warning : 'transparent';
  const fg = tone === 'plain' ? p.text : p.onAccent;
  const huge = size === 'huge';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={main}
      accessibilityHint={sub}
      accessibilityState={selected === undefined ? { disabled: !!disabled } : { disabled: !!disabled, selected }}
      style={({ pressed }) => [
        styles.base,
        huge ? styles.huge : styles.row,
        {
          backgroundColor: bg,
          borderColor: tone === 'plain' ? (selected ? p.primary : p.outline) : bg,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        selected && styles.selected,
        style,
      ]}
    >
      <MaterialCommunityIcons name={selected ? 'check-circle' : icon} size={huge ? 96 : 40} color={fg} />
      <View style={huge ? styles.hugeText : styles.text}>
        <Text style={[styles.sw, huge && styles.swHuge, { color: fg }]}>{main}</Text>
        <Text style={[styles.en, { color: fg }]}>{sub}</Text>
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
  huge: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  text: { flexShrink: 1 },
  hugeText: { alignItems: 'center' },
  sw: { fontFamily: fonts.bold, fontSize: type.button },
  swHuge: { fontSize: type.display, textAlign: 'center' },
  en: { fontFamily: fonts.regular, fontSize: type.hint },
});
