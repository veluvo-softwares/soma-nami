import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import { splitDetails } from '../../reader/details';
import type { LabelLine } from '../../reader/ocrLines';
import { useBi } from '../../settings/SettingsContext';
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
  onAsk?: () => void;
  /** Offers "Hifadhi" (save to Dawa zangu). Left out when replaying a saved label. */
  onSave?: () => Promise<void>;
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
 * couldn't be read. Batch numbers, manufacturing dates, barcodes and the
 * maker's address are shown small under More details and not read aloud.
 * Translation (C11) and Ask (C5) buttons come with those cards.
 */
export function ReadingScreen({ speech, speechState, lines, onBack, onAsk, onSave }: Props) {
  const p = usePalette();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = () => {
    if (!onSave || saveState === 'saving' || saveState === 'saved') return;
    setSaveState('saving');
    onSave().then(
      () => mounted.current && setSaveState('saved'),
      (e) => {
        console.warn('[soma] save to Dawa zangu failed', e);
        if (mounted.current) setSaveState('failed');
      },
    );
  };
  const styles = useMemo(() => makeStyles(p), [p]);
  const plan = useMemo(() => buildSpeechPlan(lines), [lines]);
  const { read, details } = useMemo(() => splitDetails(lines), [lines]);
  const [slow, setSlow] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const lineY = useRef<Record<number, number>>({});
  const chip = languageChip(lines);
  const bi = useBi();
  const chipName = bi(chip.sw, chip.en);
  const asPrinted = bi('inasomwa kama ilivyoandikwa', 'read exactly as printed');
  const unsureText = bi('Mstari huu sijaweza kuusoma vizuri', "I couldn't read this line clearly. Ask the pharmacist.");
  const moreDetails = bi('Maelezo zaidi', 'More details');
  const notAloud = bi('Hayasomwi kwa sauti', 'Not read aloud');
  const saveFailed = bi('Haikuhifadhiwa. Jaribu tena.', "Couldn't save. Try again.");
  const couldntRead = bi('Sijaweza kusoma', 'Couldn’t read');

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
      <View style={styles.chip} accessible accessibilityLabel={`${chipName.main}, ${asPrinted.main}`}>
        <Text style={styles.chipSw}>{chipName.main} · {asPrinted.main}</Text>
        <Text style={styles.chipEn}>{chipName.sub} · {asPrinted.sub}</Text>
      </View>
      <ScrollView ref={scroll} style={styles.lines} contentContainerStyle={styles.linesContent}>
        {read.map((i) => {
          const line = lines[i]!;
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
                    <Text style={[styles.unsureSw, spoken && { color: p.onAccent }]}>{unsureText.main}</Text>
                    <Text style={[styles.unsureEn, spoken && { color: p.onAccent }]}>{unsureText.sub}</Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.lineText, spoken && styles.spokenText]}>{line.text}</Text>
              )}
            </View>
          );
        })}
        {details.length > 0 && (
          <View style={styles.details} testID="reading-details">
            <Text style={styles.detailsHeading}>{moreDetails.main} · {moreDetails.sub}</Text>
            <Text style={styles.detailsNote}>{notAloud.main} · {notAloud.sub}</Text>
            {details.map((i) => {
              const line = lines[i]!;
              return (
                <Text key={i} testID={`reading-detail-${i}`} style={styles.detailText}>
                  {line.lowConfidence ? `${couldntRead.main} · ${couldntRead.sub}` : line.text}
                </Text>
              );
            })}
          </View>
        )}
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
        {onAsk && (
          <BigButton
            testID="reading-ask"
            tone="ask"
            icon="microphone"
            sw="Uliza swali"
            en="Ask a question"
            onPress={() => {
              speech.stop();
              onAsk();
            }}
          />
        )}
        {onSave ? (
          <View>
            <BigButton
              testID="reading-save"
              tone="ask"
              icon={saveState === 'saved' ? 'check' : 'content-save'}
              sw={saveState === 'saved' ? 'Imehifadhiwa kwenye Dawa zangu' : 'Hifadhi kwenye Dawa zangu'}
              en={saveState === 'saved' ? 'Saved to My medicines' : 'Save to My medicines'}
              disabled={saveState === 'saving' || saveState === 'saved'}
              onPress={save}
            />
            {saveState === 'failed' ? (
              <Text style={styles.saveFailed} accessibilityRole="alert" testID="reading-save-failed">
                {saveFailed.main} · {saveFailed.sub}
              </Text>
            ) : null}
          </View>
        ) : null}
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
    details: { marginTop: space.md, paddingTop: space.sm, borderTopWidth: 2, borderTopColor: p.outline, gap: space.xs },
    detailsHeading: { fontFamily: fonts.bold, fontSize: type.hint, color: p.textMuted },
    detailsNote: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    detailText: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    saveFailed: { fontFamily: fonts.bold, fontSize: type.body, color: p.warning, marginTop: space.xs },
    actions: { padding: space.md, gap: space.md },
    row: { flexDirection: 'row', gap: space.md },
    half: { flex: 1, paddingHorizontal: space.md },
  });
}
