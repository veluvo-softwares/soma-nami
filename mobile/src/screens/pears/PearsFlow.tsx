import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import type { PearsLink } from '../../pears/link';
import { IDLE, SpeechSession, type SpeechBackend, type SpeechState } from '../../speech/session';
import { space, usePalette } from '../../theme';
import { PatientReceiveScreen } from './PatientReceiveScreen';
import { PharmacistSendScreen } from './PharmacistSendScreen';

interface Props {
  /** Starts the Pears worklet. Called when a role is chosen, never before. */
  createLink: () => PearsLink;
  speech: SpeechBackend;
  onExit: () => void;
}

type Role = 'choose' | 'pharmacist' | 'patient';

/** Entry for the stretch feature: pick a side, then the matching screen. */
export function PearsFlow({ createLink, speech, onExit }: Props) {
  const p = usePalette();
  const [role, setRole] = useState<Role>('choose');
  const [link, setLink] = useState<PearsLink | null>(null);
  const [speechState, setSpeechState] = useState<SpeechState>(IDLE);
  const [session] = useState(() => new SpeechSession(speech, setSpeechState));

  useEffect(() => () => session.stop(), [session]);

  const choose = (r: Role) => {
    setLink(createLink());
    setRole(r);
  };
  const back = () => {
    session.stop();
    setLink(null);
    setRole('choose');
  };

  if (role === 'pharmacist' && link) return <PharmacistSendScreen link={link} onBack={back} />;
  if (role === 'patient' && link)
    return <PatientReceiveScreen link={link} speech={session} speechState={speechState} onBack={back} />;

  return (
    <View style={[styles.container, { backgroundColor: p.background }]} testID="pears-choose">
      <BigButton testID="pears-role-pharmacist" icon="pill" sw="Mimi ni mfamasia" en="I am the pharmacist" onPress={() => choose('pharmacist')} />
      <BigButton testID="pears-role-patient" icon="account" sw="Mimi ni mgonjwa" en="I am the patient" tone="ask" onPress={() => choose('patient')} />
      <BigButton testID="pears-exit" icon="arrow-left" sw="Rudi" en="Back" tone="plain" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.lg, gap: space.md, justifyContent: 'center' },
});
