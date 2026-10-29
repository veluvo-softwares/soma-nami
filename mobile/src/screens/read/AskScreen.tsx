import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { answerQuestion, type Answer } from '../../ask/answer';
import { matchQuestion } from '../../ask/match';
import { buildAnswerPlan, REFUSAL_PHRASE } from '../../ask/plan';
import { getQuestion, QUESTIONS, type QuestionId } from '../../ask/questions';
import { BigButton } from '../../components/BigButton';
import { listenErrorKind } from '../../listen/holdToTalk';
import type { LabelLine } from '../../reader/ocrLines';
import type { ListenService } from '../../reader/types';
import { PHRASES, type PhraseId } from '../../speech/phrases';
import type { SpeechSession, SpeechState } from '../../speech/session';
import { fonts, radius, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  speech: SpeechSession;
  speechState: SpeechState;
  lines: LabelLine[];
  /** Hold-to-talk. Without it only the question buttons are shown. */
  listen?: ListenService;
  onBackToLabel: () => void;
}

type Shown =
  | { kind: 'none' }
  | { kind: 'note'; phrase: PhraseId }
  | { kind: 'answer'; question: QuestionId; answer: Answer };

type Mic = 'idle' | 'listening' | 'thinking';

/** Why hold-to-talk is off for the rest of this visit; the buttons still work. */
type MicOff = 'permission' | 'model-missing';

const MIC_OFF_TEXT: Record<MicOff, { sw: string; en: string }> = {
  permission: {
    sw: 'Kipaza sauti kimezimwa. Ruhusu Soma Nami kwenye Mipangilio, au tumia vitufe.',
    en: 'The microphone is off. Allow it for Soma Nami in Settings, or use the buttons.',
  },
  'model-missing': {
    sw: 'Modeli ya sauti haipo kwenye simu. Tumia vitufe.',
    en: 'The speech model is not on this phone (download it on the Models screen). Use the buttons.',
  },
};

/**
 * Screen 4 (docs/ui.md, Ask). The question comes from a button, or from the
 * hold-to-talk mic whose rough Whisper transcript is matched against the
 * fixed list (ask/match.ts). Either way the answer is the label line itself,
 * quoted (ask/answer.ts); when the label doesn't say, or the line is
 * unreadable, the app says so and points to the pharmacist. No model writes
 * any part of an answer.
 */
export function AskScreen({ speech, speechState, lines, listen, onBackToLabel }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [shown, setShown] = useState<Shown>({ kind: 'none' });
  const [mic, setMic] = useState<Mic>('idle');
  const [micOff, setMicOff] = useState<MicOff | null>(null);
  const press = useRef(0); // each press-and-hold is one request; a stale one never reports
  const holding = useRef(false);
  const busy = useRef(false); // recording or transcribing: the mic or Whisper may be in use

  useEffect(() => {
    void speech.speak([{ kind: 'clip', phrase: 'ask_open' }]);
  }, [speech]);

  // Leaving the screen drops a recording or a transcription in progress, so
  // the mic is switched off and Whisper unloaded.
  useEffect(
    () => () => {
      press.current++;
      if (busy.current) void listen?.cancel().catch(() => undefined);
      busy.current = false;
    },
    [listen],
  );

  const note = useCallback(
    (phrase: PhraseId) => {
      setShown({ kind: 'note', phrase });
      void speech.speak([{ kind: 'clip', phrase }]);
    },
    [speech],
  );

  const ask = useCallback(
    (question: QuestionId) => {
      // Reading screen starts reading the label as soon as it opens.
      if (question === 'read_again') {
        speech.stop();
        onBackToLabel();
        return;
      }
      const answer = answerQuestion(question, lines);
      setShown({ kind: 'answer', question, answer });
      void speech.speak(buildAnswerPlan(answer));
    },
    [lines, speech, onBackToLabel],
  );

  /** What the user sees and hears when a press gives no transcript. */
  const listenFailed = useCallback(
    (e: unknown) => {
      const kind = listenErrorKind(e);
      if (kind === 'cancelled') return;
      console.warn('[soma] listen failed', e);
      if (kind === 'too-short') {
        note('ask_no_match'); // "Sijaelewa, jaribu tena."
        return;
      }
      if (kind === 'permission' || kind === 'model-missing') setMicOff(kind);
      note('ask_mic_error'); // "Sikuweza kusikia. Tumia vitufe."
    },
    [note],
  );

  const onPressIn = () => {
    if (!listen || micOff || mic !== 'idle') return;
    const id = ++press.current;
    speech.stop();
    holding.current = true;
    busy.current = true;
    setMic('listening');
    listen.start().catch((e) => {
      // Already let go: finish() rejects with the same error and reports it.
      if (id !== press.current || !holding.current) return;
      holding.current = false;
      busy.current = false;
      setMic('idle');
      listenFailed(e);
    });
  };

  const onPressOut = () => {
    if (!listen || !holding.current) return;
    holding.current = false;
    const id = press.current;
    setMic('thinking');
    listen
      .finish()
      .then((transcript) => {
        if (id !== press.current) return;
        busy.current = false;
        setMic('idle');
        const m = matchQuestion(transcript);
        if (m.kind === 'match') ask(m.id);
        else if (m.kind === 'topic') note('ask_not_stated');
        else note('ask_no_match');
      })
      .catch((e) => {
        if (id !== press.current) return;
        busy.current = false;
        setMic('idle');
        listenFailed(e);
      });
  };

  const speaking = speechState.status === 'speaking' ? speechState.line : null;

  return (
    <View style={styles.container} testID="ask-screen">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {listen && micOff && (
          <View style={styles.micOff} testID="ask-mic-off" accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="microphone-off" size={40} color={p.textMuted} />
            <Text style={styles.answerSw}>{MIC_OFF_TEXT[micOff].sw}</Text>
            <Text style={styles.answerEn}>{MIC_OFF_TEXT[micOff].en}</Text>
          </View>
        )}
        {listen && !micOff && (
          <Pressable
            testID="ask-mic"
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityRole="button"
            accessibilityLabel="Shikilia uliza"
            accessibilityHint="Hold and ask your question"
            accessibilityState={{ busy: mic !== 'idle' }}
            style={[styles.mic, mic === 'listening' && styles.micOn]}
          >
            <MaterialCommunityIcons name={mic === 'listening' ? 'microphone' : 'microphone-outline'} size={72} color={p.onAccent} />
            <Text style={styles.micText}>{mic === 'listening' ? 'Nasikiliza…' : mic === 'thinking' ? 'Subiri…' : 'Shikilia uliza'}</Text>
            <Text style={styles.micEn}>{mic === 'listening' ? 'Listening…' : 'Hold to ask'}</Text>
          </Pressable>
        )}

        <ResultView shown={shown} speaking={speaking} styles={styles} p={p} />

        <Text style={styles.listHeading}>Maswali · Questions</Text>
        {QUESTIONS.map((q) => (
          <BigButton
            key={q.id}
            testID={`ask-q-${q.id}`}
            tone="ask"
            icon={q.icon}
            sw={q.sw}
            en={q.en}
            onPress={() => ask(q.id)}
          />
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <BigButton
          testID="ask-back"
          tone="plain"
          icon="arrow-left"
          sw="Rudi kwa lebo"
          en="Back to the label"
          onPress={() => {
            speech.stop();
            onBackToLabel();
          }}
        />
      </View>
    </View>
  );
}

function ResultView({ shown, speaking, styles, p }: { shown: Shown; speaking: number | null; styles: ReturnType<typeof makeStyles>; p: Palette }) {
  if (shown.kind === 'none') return null;
  if (shown.kind === 'note') {
    return (
      <View style={styles.result} testID="ask-note" accessibilityLiveRegion="polite">
        <Text style={styles.answerSw}>{PHRASES[shown.phrase].sw}</Text>
        <Text style={styles.answerEn}>{PHRASES[shown.phrase].en}</Text>
      </View>
    );
  }
  const { answer, question } = shown;
  const q = getQuestion(question);
  return (
    <View style={styles.result} testID="ask-result" accessibilityLiveRegion="polite">
      <Text style={styles.asked}>{q.sw}</Text>
      {answer.kind === 'refuse' && (
        <View testID={`ask-refusal-${answer.reason}`}>
          <View style={styles.refuseRow}>
            <MaterialCommunityIcons name="alert-circle" size={40} color={p.warning} />
            <Text style={[styles.answerSw, { color: p.warning }]}>{PHRASES[REFUSAL_PHRASE[answer.reason]].sw}</Text>
          </View>
          <Text style={styles.answerEn}>{PHRASES[REFUSAL_PHRASE[answer.reason]].en}</Text>
        </View>
      )}
      {answer.kind === 'read-again' && <Text style={styles.answerEn}>Go back to the label to hear it again.</Text>}
      {answer.kind === 'answer' && (
        <View>
          <Text style={styles.says}>Lebo inasema · The label says</Text>
          {answer.quotes.map((quote) => (
            <View
              key={quote.index}
              testID={`ask-quote-${quote.index}`}
              style={[styles.quote, speaking === quote.index && styles.quoteSpoken]}
            >
              <Text style={[styles.quoteText, speaking === quote.index && { color: p.onAccent }]}>{quote.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    scroll: { flex: 1 },
    content: { padding: space.md, gap: space.md },
    mic: {
      alignSelf: 'center',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: p.ask,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: p.ask,
    },
    micOn: { borderColor: p.text },
    micOff: { borderRadius: radius.md, borderWidth: 2, borderColor: p.outline, padding: space.md, gap: space.sm, alignItems: 'center' },
    micText: { fontFamily: fonts.bold, fontSize: type.button, color: p.onAccent, textAlign: 'center' },
    micEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.onAccent },
    result: { borderRadius: radius.md, borderWidth: 2, borderColor: p.outline, padding: space.md, gap: space.sm },
    asked: { fontFamily: fonts.regular, fontSize: type.body, color: p.textMuted },
    refuseRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    answerSw: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text, flexShrink: 1 },
    answerEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    says: { fontFamily: fonts.bold, fontSize: type.body, color: p.ask, marginBottom: space.xs },
    quote: { borderWidth: 3, borderStyle: 'dashed', borderColor: p.ask, borderRadius: radius.md, padding: space.sm, marginBottom: space.xs },
    quoteSpoken: { backgroundColor: p.ask },
    quoteText: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    listHeading: { fontFamily: fonts.bold, fontSize: type.hint, color: p.textMuted },
    actions: { padding: space.md },
  });
}
