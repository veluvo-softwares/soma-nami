import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import { splitDetails } from '../../reader/scope';
import type { LabelLine } from '../../reader/ocrLines';
import { useBi } from '../../settings/SettingsContext';
import { PHRASES } from '../../speech/phrases';
import { buildSpeechPlan, type SpeechStep } from '../../speech/plan';
import type { SpeechSession, SpeechState } from '../../speech/session';
import { buildTafsiriPlan, modelLines, tafsiriLines, type LineTafsiri, type Translate } from '../../tafsiri/tafsiri';
import { fonts, radius, space, type, usePalette, type Palette } from '../../theme';

/** "Polepole" plays everything at this rate, with pitch kept. */
export const SLOW_RATE = 0.8;

interface Props {
  speech: SpeechSession;
  speechState: SpeechState;
  lines: LabelLine[];
  /** TranslatePsy, one line (C11). */
  translate: Translate;
  /** Unloads the translation model when Tafsiri is done. */
  release: () => Promise<void>;
  onBack: () => void;
  onAsk?: () => void;
  /** Offers "Hifadhi" (save to Dawa zangu). Left out when replaying a saved label. */
  onSave?: () => Promise<void>;
}

type TafsiriState =
  | { status: 'idle' }
  | { status: 'working'; line: number; total: number }
  | { status: 'done'; results: LineTafsiri[] };

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
 * couldn't be read. Only the medicine's name and strength, how to take it,
 * the expiry and key warnings are listed and read, in that order
 * (reader/scope.ts); everything else on the label is shown small under More
 * details and not read aloud.
 * "Tafsiri kwa Kiswahili" (C11) translates the lines on the phone and checks
 * every number, unit and frequency against the original line. A checked
 * translation is shown under its original, labelled as a translation; if
 * anything differs the line shows only the original and the app says the
 * translation isn't safe. The Ask button comes with C5.
 */
export function ReadingScreen({ speech, speechState, lines, translate, release, onBack, onAsk, onSave }: Props) {
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

  const [tafsiri, setTafsiri] = useState<TafsiriState>({ status: 'idle' });
  const tafsiriRun = useRef(0);

  // Leaving the screen drops a translation still running.
  useEffect(
    () => () => {
      tafsiriRun.current++;
    },
    [],
  );

  const translateLabel = useCallback(async () => {
    if (tafsiri.status === 'working') return;
    if (tafsiri.status === 'done') {
      void speech.speak(buildTafsiriPlan(tafsiri.results), 1);
      return;
    }
    const run = ++tafsiriRun.current;
    // Counts model calls, so expiry and batch lines (fixed templates, no model) are not in it.
    const total = modelLines(lines).length;
    let doneLines = 0;
    setTafsiri({ status: 'working', line: 0, total });
    void speech.say('tafsiri_wait');
    // Counts the model calls so the card can say "Line 3 of 9" (the logic itself is untouched).
    const counted: Translate = (en) => {
      doneLines++;
      if (run === tafsiriRun.current && mounted.current) setTafsiri({ status: 'working', line: doneLines, total });
      return translate(en);
    };
    let results: LineTafsiri[] | null = null;
    try {
      results = await tafsiriLines(lines, counted, () => run !== tafsiriRun.current);
    } finally {
      // The model is only needed for this step: free the memory straight away.
      await release().catch(() => undefined);
    }
    if (results === null || run !== tafsiriRun.current) return;
    setTafsiri({ status: 'done', results });
    void speech.speak(buildTafsiriPlan(results), 1);
  }, [tafsiri, speech, lines, translate, release]);

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

  // The Zaidi / More panel. Opened by tapping the handle (the way VoiceOver users reach it) or by swiping it up.
  const [moreOpen, setMoreOpen] = useState(false);
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > 16 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -40) setMoreOpen(true);
          else if (g.dy > 40) setMoreOpen(false);
        },
      }),
    [],
  );
  const zaidi = bi('Zaidi', 'More');
  const zaidiHint = bi(
    'Fungua: Polepole, Tafsiri kwa Kiswahili, Hifadhi kwenye Dawa zangu na Rudi.',
    'Opens: Slower, Translate, Save to My medicines and Back.',
  );
  const progressText =
    tafsiri.status === 'working' && tafsiri.total > 0
      ? bi(`Mstari ${tafsiri.line} kati ya ${tafsiri.total}`, `Line ${tafsiri.line} of ${tafsiri.total}`)
      : null;
  const translating = bi('Ninatafsiri…', 'Translating…');
  const translated = tafsiri.status === 'done' ? tafsiri.results : null;

  return (
    <View style={styles.container} testID="reading-screen">
      <View style={styles.card} testID="reading-card">
        <View style={styles.chip} accessible accessibilityLabel={`${chipName.main}, ${asPrinted.main}`}>
          <Text style={styles.chipSw}>{chipName.main} · {asPrinted.main}</Text>
          <Text style={styles.chipEn}>{chipName.sub} · {asPrinted.sub}</Text>
        </View>
        {progressText ? (
          <View style={styles.status} accessible accessibilityLiveRegion="polite" testID="reading-progress">
            <Text style={styles.statusMain}>{translating.main} {progressText.main}</Text>
            <Text style={styles.statusSub}>{translating.sub} {progressText.sub}</Text>
          </View>
        ) : null}
        {saveState === 'failed' ? (
          <Text style={styles.saveFailed} accessibilityRole="alert" testID="reading-save-failed">
            {saveFailed.main} · {saveFailed.sub}
          </Text>
        ) : null}
        <ScrollView ref={scroll} style={styles.lines} contentContainerStyle={styles.linesContent}>
          {read.map((i) => {
            const line = lines[i]!;
            const spoken = current === i;
            const result = translated?.[i];
            const problem = result && (result.kind === 'unsafe' || result.kind === 'failed') ? result : null;
            const textColor = spoken ? { color: p.onAccent } : null;
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
                  (line.lowConfidence || problem) && styles.unsure,
                  spoken && (line.lowConfidence || problem ? styles.unsureSpoken : styles.spoken),
                ]}
              >
                {line.lowConfidence ? (
                  <View style={styles.unsureRow} testID={`reading-line-${i}-unsure`}>
                    <MaterialCommunityIcons name="alert" size={32} color={spoken ? p.onAccent : p.warning} />
                    <View style={styles.unsureText}>
                      <Text style={[styles.unsureSw, textColor]}>{unsureText.main}</Text>
                      <Text style={[styles.unsureEn, textColor]}>{unsureText.sub}</Text>
                    </View>
                  </View>
                ) : result?.kind === 'safe' ? (
                  // Translation view: the Swahili line big, the original small under it.
                  <View testID={`reading-line-${i}-tafsiri`}>
                    <Text style={[styles.lineText, textColor]}>{result.translation}</Text>
                    <Text style={[styles.originalSmall, textColor]}>{line.text}</Text>
                    <Text style={[styles.tafsiriLabel, textColor]}>Tafsiri (si lebo yenyewe) · Translation, not the label</Text>
                  </View>
                ) : (
                  <Text style={[styles.lineText, textColor]}>{line.text}</Text>
                )}
                {problem ? <TafsiriProblem kind={problem.kind} index={i} styles={styles} p={p} spoken={spoken} /> : null}
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
      </View>
      <View style={styles.actions}>
        {moreOpen ? (
          <MorePanel>
            <BigButton
              key="slower"
              testID="reading-slower"
              tone={slow ? 'primary' : 'plain'}
              icon="tortoise"
              sw="Polepole"
              en="Slower"
              onPress={() => {
                setSlow(true);
                setMoreOpen(false);
                start(SLOW_RATE, { kind: 'clip', phrase: 'btn_slower' });
              }}
            />
            <BigButton
              key="tafsiri"
              testID="reading-tafsiri"
              tone="plain"
              icon="translate"
              sw={tafsiri.status === 'working' ? 'Ninatafsiri…' : 'Tafsiri kwa Kiswahili'}
              en={tafsiri.status === 'working' ? 'Translating…' : 'Translate, numbers checked'}
              disabled={tafsiri.status === 'working'}
              onPress={() => {
                setMoreOpen(false);
                void translateLabel();
              }}
            />
            {onSave ? (
              <BigButton
                key="save"
                testID="reading-save"
                tone="ask"
                icon={saveState === 'saved' ? 'check' : 'content-save'}
                sw={saveState === 'saved' ? 'Imehifadhiwa kwenye Dawa zangu' : 'Hifadhi kwenye Dawa zangu'}
                en={saveState === 'saved' ? 'Saved to My medicines' : 'Save to My medicines'}
                disabled={saveState === 'saving' || saveState === 'saved'}
                onPress={save}
              />
            ) : null}
            <BigButton
              key="back"
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
          </MorePanel>
        ) : null}
        <View style={styles.row}>
          <BigButton
            key="again"
            testID="reading-again"
            layout="stacked"
            icon="replay"
            sw="Soma tena"
            en="Read again"
            onPress={() => start(slow ? SLOW_RATE : 1, { kind: 'clip', phrase: 'btn_read_again' })}
            style={styles.half}
          />
          {onAsk ? (
            <BigButton
              key="ask"
              testID="reading-ask"
              layout="stacked"
              tone="ask"
              icon="microphone"
              sw="Uliza swali"
              en="Ask a question"
              onPress={() => {
                speech.stop();
                onAsk();
              }}
              style={styles.half}
            />
          ) : null}
        </View>
        <View {...swipe.panHandlers}>
          <BigButton
            key="zaidi"
            testID="reading-more"
            tone="plain"
            icon={moreOpen ? 'chevron-down' : 'chevron-up'}
            sw={zaidi.main}
            en={zaidi.sub}
            fixedOrder
            hint={zaidiHint.main + ' ' + zaidiHint.sub}
            expanded={moreOpen}
            onPress={() => setMoreOpen((o) => !o)}
          />
        </View>
      </View>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

/** Slides up over the bottom of the card, just above the action bar. */
function MorePanel({ children }: { children: ReactNode }) {
  const p = usePalette();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  }, [rise]);
  return (
    <Animated.View
      testID="reading-more-panel"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '100%',
        padding: space.md,
        gap: space.md,
        backgroundColor: p.background,
        borderTopWidth: 3,
        borderColor: p.outline,
        opacity: rise,
        transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Marks a line whose translation could not be trusted: the original is shown, never the translation. */
function TafsiriProblem({
  kind,
  index,
  styles,
  p,
  spoken,
}: {
  kind: 'unsafe' | 'failed';
  index: number;
  styles: Styles;
  p: Palette;
  spoken: boolean;
}) {
  const reason = kind === 'unsafe' ? PHRASES.tafsiri_unsafe : PHRASES.tafsiri_failed;
  const color = spoken ? { color: p.onAccent } : null;
  return (
    <View style={[styles.tafsiri, styles.tafsiriUnsafe]} testID={`reading-line-${index}-tafsiri-unsafe`}>
      <View style={styles.unsureRow}>
        <MaterialCommunityIcons name="alert" size={32} color={spoken ? p.onAccent : p.warning} />
        <View style={styles.unsureText}>
          <Text style={[styles.tafsiriLabel, color]}>{reason.sw}</Text>
          <Text style={[styles.tafsiriEn, color]}>{reason.en}</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    // The label is the main thing: the card takes the room the buttons leave.
    card: { flex: 1, margin: space.md, marginBottom: 0, borderRadius: radius.lg, borderWidth: 2, borderColor: p.outline, overflow: 'hidden' },
    chip: { padding: space.sm, borderBottomWidth: 2, borderBottomColor: p.outline },
    chipSw: { fontFamily: fonts.bold, fontSize: type.hint, color: p.text },
    chipEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    status: { padding: space.sm, backgroundColor: p.primary },
    statusMain: { fontFamily: fonts.bold, fontSize: type.body, color: p.onAccent },
    statusSub: { fontFamily: fonts.regular, fontSize: type.hint, color: p.onAccent },
    lines: { flex: 1 },
    linesContent: { padding: space.md, gap: space.md },
    line: { borderRadius: radius.md, padding: space.sm, borderWidth: 3, borderColor: 'transparent' },
    lineText: { fontFamily: fonts.bold, fontSize: type.headingLarge, color: p.text },
    originalSmall: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    spoken: { backgroundColor: p.primary },
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
    saveFailed: { fontFamily: fonts.bold, fontSize: type.body, color: p.warning, padding: space.sm },
    tafsiri: { marginTop: space.sm, borderTopWidth: 2, borderTopColor: p.outline, paddingTop: space.xs, gap: 2 },
    tafsiriUnsafe: { borderTopColor: p.warning, borderTopWidth: 4 },
    tafsiriLabel: { fontFamily: fonts.bold, fontSize: type.hint, color: p.textMuted },
    tafsiriEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    actions: { padding: space.md, gap: space.md },
    row: { flexDirection: 'row', gap: space.md },
    half: { flex: 1 },
  });
}
