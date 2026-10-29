import { useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { assessPhoto } from '../../reader/assess';
import { flowReducer, INITIAL_FLOW } from '../../reader/flow';
import { toLines } from '../../reader/ocrLines';
import type { Photo, ReaderServices } from '../../reader/types';
import { SPEED_RATE } from '../../settings/settings';
import { useSettings } from '../../settings/SettingsContext';
import { IDLE, SpeechSession, type SpeechState } from '../../speech/session';
import { useMedicines } from '../../medicines/MedicinesContext';
import type { SavedMedicine } from '../../medicines/medicines';
import { MedicineNoteScreen } from '../MedicineNoteScreen';
import { MedicinesScreen } from '../MedicinesScreen';
import { AimingScreen } from './AimingScreen';
import { AskScreen } from './AskScreen';
import { HomeScreen } from './HomeScreen';
import { NotSureScreen } from './NotSureScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ReadingScreen } from './ReadingScreen';

interface Props {
  services: ReaderServices;
  /** Opens caregiver setup from Home. */
  onOpenSetup?: () => void;
  /** For tests: the clock "Sasa" is judged against. */
  now?: () => Date;
}

/** True while VoiceOver or TalkBack is on; follows it being switched on and off. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => alive && setOn(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

/**
 * Camera -> OCR -> read aloud (card C4). Owns the flow state, the one speech
 * session every screen talks through, and the OCR request in flight.
 */
export function ReadFlow({ services, onOpenSetup, now }: Props) {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  const [speechState, setSpeechState] = useState<SpeechState>(IDLE);
  // Dawa zangu sits beside the read flow: the flow's own state is kept while it is open.
  const [medicinesView, setMedicinesView] = useState<{ kind: 'list' } | { kind: 'replay' | 'note'; medicine: SavedMedicine } | null>(null);
  const { store, items } = useMedicines();
  const lastPhoto = useRef<Photo | null>(null);
  const { settings } = useSettings();
  const screenReader = useScreenReader();
  // The session lives for the whole reader; it reads the current setup on every call.
  const live = useRef({ settings, screenReader });
  live.current = { settings, screenReader };
  const [speech] = useState(
    () =>
      new SpeechSession(services.speech, setSpeechState, {
        language: () => live.current.settings.language,
        speed: () => SPEED_RATE[live.current.settings.voiceSpeed],
        screenReader: () => live.current.screenReader,
        announce: (text) => AccessibilityInfo.announceForAccessibility(text),
      }),
  );
  const request = useRef(0);
  const screen = useRef(state.screen);
  screen.current = state.screen;

  // Leaving the reader stops the voice and frees the models.
  useEffect(
    () => () => {
      request.current++; // nothing in flight may start OCR after this
      speech.stop();
      void services.release().catch(() => undefined);
    },
    [speech, services],
  );

  const readPhoto = async (raw: Photo) => {
    // The camera or picker can finish after the user pressed Back.
    if (screen.current !== 'aiming') return;
    const id = ++request.current;
    dispatch({ type: 'photo-taken', request: id });
    try {
      const t0 = Date.now();
      const photo = await services.preparePhoto(raw);
      if (id !== request.current) return;
      lastPhoto.current = photo;
      const blocks = await services.recognize(photo.uri);
      const lines = toLines(blocks);
      const assessment = assessPhoto(lines, photo);
      console.log(
        `[soma] ocr ${Date.now() - t0} ms, ${photo.width}x${photo.height}, ${blocks.length} blocks, ${lines.length} lines -> ${assessment.kind}`,
      );
      dispatch({ type: 'assessed', request: id, assessment });
    } catch (e) {
      console.warn('[soma] read failed', e);
      dispatch({ type: 'failed', request: id });
    }
  };

  const pick = async () => {
    try {
      const photo = await services.pickPhoto();
      if (photo) await readPhoto(photo);
    } catch (e) {
      console.warn('[soma] pick failed', e);
      void speech.say('error');
    }
  };

  const home = () => {
    request.current++; // drop any OCR result still on its way
    dispatch({ type: 'home' });
  };

  if (medicinesView?.kind === 'list') {
    return (
      <MedicinesScreen
        medicines={items}
        now={now}
        onBack={() => {
          speech.stop();
          setMedicinesView(null);
        }}
        onOpen={(medicine) => setMedicinesView({ kind: 'replay', medicine })}
      />
    );
  }
  if (medicinesView?.kind === 'note') {
    // Take the live copy, so the editor shows the note as last saved.
    const medicine = items.find((m) => m.id === medicinesView.medicine.id) ?? medicinesView.medicine;
    return (
      <MedicineNoteScreen
        medicine={medicine}
        onSave={(note) => store.setNote(medicine.id, note)}
        onBack={() => setMedicinesView({ kind: 'replay', medicine })}
      />
    );
  }
  if (medicinesView?.kind === 'replay') {
    // Read from storage: the saved lines go straight to speech, no OCR.
    // The note is shown under the label and never spoken (no Swahili voice on the phone).
    const medicine = items.find((m) => m.id === medicinesView.medicine.id) ?? medicinesView.medicine;
    return (
      <ReadingScreen
        key={medicine.id}
        speech={speech}
        speechState={speechState}
        lines={medicine.lines}
        translate={services.translate}
        release={services.release}
        note={medicine.note}
        onNote={() => {
          speech.stop();
          setMedicinesView({ kind: 'note', medicine });
        }}
        onBack={() => setMedicinesView({ kind: 'list' })}
      />
    );
  }

  switch (state.screen) {
    case 'home':
      return (
        <HomeScreen
          speech={speech}
          onRead={() => dispatch({ type: 'open-camera' })}
          onSetup={onOpenSetup}
          onMedicines={() => setMedicinesView({ kind: 'list' })}
        />
      );
    case 'aiming':
      return (
        <AimingScreen
          speech={speech}
          hint={state.hint}
          canReadAnyway={state.found.length > 0}
          onPhoto={(p) => void readPhoto(p)}
          onPick={() => void pick()}
          onReadAnyway={() => dispatch({ type: 'read-anyway' })}
          onBack={home}
        />
      );
    case 'processing':
      return <ProcessingScreen speech={speech} onBack={home} />;
    case 'reading':
      return (
        <ReadingScreen
          speech={speech}
          speechState={speechState}
          lines={state.lines}
          translate={services.translate}
          release={services.release}
          onBack={home}
          onAsk={() => dispatch({ type: 'ask' })}
          onSave={() => {
            const photo = lastPhoto.current;
            if (!photo) return Promise.reject(new Error('no photo to save'));
            return store.add({ photoUri: photo.uri, lines: state.lines }).then(() => undefined);
          }}
        />
      );
    case 'asking':
      return (
        <AskScreen
          speech={speech}
          speechState={speechState}
          lines={state.lines}
          listen={services.listen}
          onBackToLabel={() => dispatch({ type: 'back-to-label' })}
        />
      );
    case 'not-sure':
      return <NotSureScreen speech={speech} onTryAgain={() => dispatch({ type: 'open-camera' })} onBack={home} />;
  }
}
