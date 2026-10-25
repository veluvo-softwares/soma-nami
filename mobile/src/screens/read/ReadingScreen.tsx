import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import type { LabelLine } from '../../reader/ocrLines';
import { buildSpeechPlan, type SpeechStep } from '../../speech/plan';
import type { SpeechSession, SpeechState } from '../../speech/session';
import { fonts, radius, space, type, usePalette, type Palette } from '../../theme';

/** "Polepole" plays everything at this rate, with pitch kept. */
export const SLOW_RATE = 0.8;

interface Props {
  speech: SpeechSession;
  speechState: SpeechState;
  lines: LabelLine[];
  onBack: () => void;
}

function languageChip(lines: readonly LabelLine[]) {
  const sw = lines.filter((l) => l.language === 'sw').length;
  const en = lines.length - sw;
  if (sw > 0 && en > 0) return { sw: 'Kiingereza na Kiswahili', en: 'English and Swahili' };
  if (sw > 0) return { sw: 'Kiswahili', en: 'Swahili' };
  return { sw: 'Kiingereza', en: 'English' };
}

/**
 * Screen 3 (docs/ui.md, Reading): the label lines in large type, read aloud
 * as printed, the spoken line highlighted and kept on screen. A line OCR was
 * unsure of is never shown or read as text: it's an orange box that says it
 * couldn't be read. Translation (C11) and Ask (C5) buttons come with those cards.
 */
export function ReadingScreen({ speech, speechState, lines, onBack }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const plan = useMemo(() => buildSpeechPlan(lines), [lines]);
  const [slow, setSlow] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const lineY = useRef<Record<number, number>>({});
  const chip = languageChip(lines);

  const start = useCallback(
    (rate: number, prefix?: SpeechStep) => {
      void speech.speak(prefix ? [prefix, ...plan] : plan, rate);
    },
    [speech, plan],
  );

  useEffect(() => {
    start(1);
  }, [start]);

  const current = speechState.status === 'speaking' ? speechState.line : null;

  useEffect(() => {
    if (current === null) return;
    const y = lineY.current[current];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: true });
  }, [current]);

  return (
    <View style={styles.container} testID="reading-screen">
      <View style={styles.chip} accessible accessibilityLabel={`${chip.sw}, inasomwa kama ilivyoandikwa`}>
        <Text style={styles.chipSw}>{chip.sw} · inasomwa kama ilivyoandikwa</Text>
        <Text style={styles.chipEn}>{chip.en} · read exactly as printed</Text>
      </View>
      <ScrollView ref={scroll} style={styles.lines} contentContainerStyle={styles.linesContent}>
        {lines.map((line, i) => {
          const spoken = current === i;
          return (
            <View
              key={i}
              testID={`reading-line-${i}`}
              accessibilityState={{ selected: spoken }}
              onLayout={(e) => {
                lineY.current[i] = e.nativeEvent.layout.y;
              }}
              style={[
                styles.line,
                line.lowConfidence && styles.unsure,
                spoken && (line.lowConfidence ? styles.unsureSpoken : styles.spoken),
              ]}
            >
              {line.lowConfidence ? (
                <View style={styles.unsureRow} testID={`reading-line-${i}-unsure`}>
                  <MaterialCommunityIcons name="alert" size={32} color={spoken ? p.onAccent : p.warning} />
                  <View style={styles.unsureText}>
                    <Text style={[styles.unsureSw, spoken && { color: p.onAccent }]}>Mstari huu sijaweza kuusoma vizuri</Text>
                    <Text style={[styles.unsureEn, spoken && { color: p.onAccent }]}>
                      I couldn&apos;t read this line clearly. Ask the pharmacist.
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.lineText, spoken && styles.spokenText]}>{line.text}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.actions}>
        <View style={styles.row}>
          <BigButton
            testID="reading-again"
            icon="replay"
            sw="Soma tena"
            en="Read again"
            onPress={() => start(slow ? SLOW_RATE : 1, { kind: 'clip', phrase: 'btn_read_again' })}
            style={styles.half}
          />
          <BigButton
            testID="reading-slower"
            tone={slow ? 'primary' : 'plain'}
            icon="tortoise"
            sw="Polepole"
            en="Slower"
            onPress={() => {
              setSlow(true);
              start(SLOW_RATE, { kind: 'clip', phrase: 'btn_slower' });
            }}
            style={styles.half}
          />
        </View>
        <BigButton
          testID="reading-back"
          tone="plain"
          icon="arrow-left"
          sw="Rudi"
          en="Back"
          onPress={() => {
            speech.stop();
            onBack();
          }}
        />
      </View>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    chip: {
      margin: space.md,
      marginBottom: 0,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: p.outline,
      padding: space.sm,
    },
    chipSw: { fontFamily: fonts.bold, fontSize: type.body, color: p.text },
    chipEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    lines: { flex: 1 },
    linesContent: { padding: space.md, gap: space.sm },
    line: { borderRadius: radius.md, padding: space.sm, borderWidth: 3, borderColor: 'transparent' },
    lineText: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    spoken: { backgroundColor: p.primary },
    spokenText: { color: p.onAccent },
    unsure: { borderColor: p.warning, borderStyle: 'dashed' },
    unsureSpoken: { backgroundColor: p.warning },
    unsureRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    unsureText: { flexShrink: 1 },
    unsureSw: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text },
    unsureEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    actions: { padding: space.md, gap: space.md },
    row: { flexDirection: 'row', gap: space.md },
    half: { flex: 1, paddingHorizontal: space.md },
  });
}
