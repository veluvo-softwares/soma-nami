import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import { checkInstruction, formatInvite, makeCode, MAX_INSTRUCTION_CHARS, PEARS_PORT } from '../../pears/protocol';
import { sendReducer, type PearsLink, type SendState } from '../../pears/link';
import { fonts, radius, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  link: PearsLink;
  onBack: () => void;
  /** Injectable for tests. */
  newCode?: () => string;
}

/** What the pharmacist sees for each state: Swahili line, English line. */
function statusText(state: SendState, failed: boolean): { sw: string; en: string } {
  switch (state.phase) {
    case 'starting':
      return { sw: 'Inaanza…', en: 'Starting…' };
    case 'waiting':
      return { sw: 'Subiri mgonjwa aunganishe simu', en: "Waiting for the patient's phone" };
    case 'connected':
      return failed
        ? { sw: 'Haikutumwa. Jaribu tena.', en: 'Not sent. Try again.' }
        : { sw: 'Simu ya mgonjwa imeunganishwa', en: "Patient's phone is connected" };
    case 'sending':
      return { sw: 'Inatuma…', en: 'Sending…' };
    case 'delivered':
      return { sw: 'Imefika kwa mgonjwa', en: 'Arrived on the patient\u2019s phone' };
    case 'error':
      return state.message === 'no-local-network'
        ? { sw: 'Washa Wi-Fi au hotspot', en: 'Turn on Wi-Fi or a hotspot' }
        : { sw: 'Kuna tatizo. Anza tena.', en: 'Something went wrong. Start again.' };
  }
}

/**
 * Pharmacist side (card C7): type the instruction once, it goes to the
 * patient's phone. The screen shows the code the patient types in.
 */
export function PharmacistSendScreen({ link, onBack, newCode = makeCode }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [state, dispatch] = useReducer(sendReducer, { phase: 'starting' } as SendState);
  const [text, setText] = useState('');
  const [empty, setEmpty] = useState(false);
  const [code] = useState(newCode);
  const nextId = useRef(0);

  useEffect(() => {
    const off = link.subscribe((e) => dispatch(e));
    link.host({ port: PEARS_PORT, code });
    return () => {
      off();
      link.stop();
    };
  }, [link, code]);

  const host = 'host' in state ? state.host : null;
  const status = statusText(state, state.phase === 'connected' && !!state.failed);
  const canSend = state.phase === 'connected' || state.phase === 'delivered';

  const send = () => {
    const checked = checkInstruction(text);
    if (!checked.ok) {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    const id = `m${++nextId.current}`;
    dispatch({ ev: 'sent', id });
    link.send(id, checked.text);
  };

  return (
    <View style={styles.container} testID="pears-send-screen">
      <Text style={styles.heading} accessibilityRole="header">
        Tuma maelezo kwa mgonjwa
      </Text>
      <Text style={styles.sub}>Send the instruction to the patient</Text>

      {host ? (
        <View style={styles.invite} testID="pears-invite" accessible accessibilityLabel={`Nambari ya mgonjwa: ${formatInvite(host, code)}`}>
          <Text style={styles.inviteLabel}>Mgonjwa aandike hii / Patient types this</Text>
          <Text style={styles.inviteCode}>{formatInvite(host, code)}</Text>
        </View>
      ) : null}

      <Text style={styles.status} testID="pears-status" accessibilityLiveRegion="polite">
        {status.sw}
      </Text>
      <Text style={styles.sub}>{status.en}</Text>

      <TextInput
        testID="pears-instruction"
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_INSTRUCTION_CHARS}
        placeholder="Mfano: Chukua kidonge 1 mara 3 kwa siku baada ya chakula"
        placeholderTextColor={p.textMuted}
        accessibilityLabel="Maelezo ya dawa"
        accessibilityHint="Andika maelezo ya dawa kwa mgonjwa. Type the dosing instruction."
      />
      {empty ? (
        <Text style={styles.warn} testID="pears-empty">
          Andika maelezo kwanza / Type the instruction first
        </Text>
      ) : null}

      <BigButton
        testID="pears-send"
        icon="send"
        sw="Tuma"
        en="Send"
        tone="primary"
        disabled={!canSend}
        onPress={send}
      />
      <BigButton testID="pears-back" icon="arrow-left" sw="Rudi" en="Back" tone="plain" onPress={onBack} />
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, padding: space.lg, gap: space.sm, backgroundColor: p.background },
    heading: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text },
    sub: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    invite: { borderWidth: 3, borderColor: p.outline, borderRadius: radius.lg, padding: space.md },
    inviteLabel: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    inviteCode: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text },
    status: { fontFamily: fonts.bold, fontSize: type.body, color: p.text },
    input: {
      minHeight: 120,
      borderWidth: 3,
      borderColor: p.outline,
      borderRadius: radius.lg,
      padding: space.md,
      fontFamily: fonts.regular,
      fontSize: type.body,
      color: p.text,
      textAlignVertical: 'top',
    },
    warn: { fontFamily: fonts.bold, fontSize: type.hint, color: p.warning },
  });
}
