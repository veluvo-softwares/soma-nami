import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import { parseInvite } from '../../pears/protocol';
import { receiveReducer, type PearsLink, type ReceiveState } from '../../pears/link';
import type { SpeechSession, SpeechState } from '../../speech/session';
import { fonts, radius, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  link: PearsLink;
  speech: SpeechSession;
  speechState: SpeechState;
  onBack: () => void;
}

/**
 * Patient side (card C7): type the code shown on the pharmacist's phone, then
 * the instruction arrives, is shown in large type and read aloud. It is read
 * exactly as the pharmacist typed it; the app adds nothing and translates
 * nothing (a translated dose would be a guess).
 */
export function PatientReceiveScreen({ link, speech, speechState, onBack }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [state, dispatch] = useReducer(receiveReducer, { phase: 'connecting' } as ReceiveState);
  const [typed, setTyped] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [joined, setJoined] = useState(false);
  const spokenId = useRef<string | null>(null);

  useEffect(() => {
    const off = link.subscribe((e) => dispatch(e));
    return () => {
      off();
      link.stop();
      speech.stop();
    };
  }, [link, speech]);

  const received = state.phase === 'received' ? state : null;
  const receivedId = received?.id ?? null;
  const receivedText = received?.text ?? null;

  const read = (text: string) => void speech.speak([{ kind: 'tts', text, line: 0 }]);

  // Read each new instruction aloud once, as soon as it arrives.
  useEffect(() => {
    if (receivedId === null || receivedText === null || spokenId.current === receivedId) return;
    spokenId.current = receivedId;
    void speech.speak([{ kind: 'tts', text: receivedText, line: 0 }]);
  }, [receivedId, receivedText, speech]);

  const connect = () => {
    const invite = parseInvite(typed);
    if (!invite) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setJoined(true);
    link.join(invite);
  };

  return (
    <View style={styles.container} testID="pears-receive-screen">
      <Text style={styles.heading} accessibilityRole="header">
        Pokea maelezo kutoka kwa mfamasia
      </Text>
      <Text style={styles.sub}>Receive the instruction from the pharmacist</Text>

      {received ? (
        <>
          <View style={styles.card} testID="pears-received">
            <Text
              style={[styles.instruction, speechState.status === 'speaking' && styles.speaking]}
              accessibilityLabel={received.text}
              accessibilityLiveRegion="polite"
            >
              {received.text}
            </Text>
          </View>
          <BigButton
            testID="pears-read-again"
            icon="replay"
            sw="Soma tena"
            en="Read again"
            tone="primary"
            onPress={() => read(received.text)}
          />
        </>
      ) : (
        <>
          <TextInput
            testID="pears-code"
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            editable={!joined || state.phase === 'error'}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            placeholder="192.168.43.1-4821"
            placeholderTextColor={p.textMuted}
            accessibilityLabel="Nambari kutoka kwa mfamasia"
            accessibilityHint="Andika nambari inayoonekana kwenye simu ya mfamasia. Type the code shown on the pharmacist's phone."
          />
          {invalid ? (
            <Text style={styles.warn} testID="pears-invalid">
              Nambari si sahihi / That code is not right
            </Text>
          ) : null}
          {state.phase === 'error' ? (
            <Text style={styles.warn} testID="pears-error">
              Haikuunganisha. Jaribu tena. / Could not connect. Try again.
            </Text>
          ) : null}
          {joined && state.phase === 'waiting' ? (
            <Text style={styles.status} testID="pears-waiting" accessibilityLiveRegion="polite">
              Inasubiri maelezo… / Waiting for the instruction…
            </Text>
          ) : null}
          <BigButton
            testID="pears-connect"
            icon="link-variant"
            sw="Unganisha"
            en="Connect"
            tone="primary"
            disabled={joined && state.phase !== 'error'}
            onPress={connect}
          />
        </>
      )}
      <BigButton testID="pears-back" icon="arrow-left" sw="Rudi" en="Back" tone="plain" onPress={onBack} />
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, padding: space.lg, gap: space.sm, backgroundColor: p.background },
    heading: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text },
    sub: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    card: { flex: 1, borderWidth: 3, borderColor: p.outline, borderRadius: radius.lg, padding: space.md },
    instruction: { fontFamily: fonts.bold, fontSize: type.headingLarge, color: p.text },
    speaking: { color: p.primary },
    input: {
      borderWidth: 3,
      borderColor: p.outline,
      borderRadius: radius.lg,
      padding: space.md,
      minHeight: 88,
      fontFamily: fonts.bold,
      fontSize: type.bodyLarge,
      color: p.text,
    },
    status: { fontFamily: fonts.bold, fontSize: type.body, color: p.text },
    warn: { fontFamily: fonts.bold, fontSize: type.hint, color: p.warning },
  });
}
