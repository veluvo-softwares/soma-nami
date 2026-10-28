import { useEffect, useReducer, useRef, useState } from 'react';

import { assessPhoto } from '../../reader/assess';
import { flowReducer, INITIAL_FLOW } from '../../reader/flow';
import { toLines } from '../../reader/ocrLines';
import type { Photo, ReaderServices } from '../../reader/types';
import { IDLE, SpeechSession, type SpeechState } from '../../speech/session';
import { AimingScreen } from './AimingScreen';
import { AskScreen } from './AskScreen';
import { HomeScreen } from './HomeScreen';
import { NotSureScreen } from './NotSureScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ReadingScreen } from './ReadingScreen';

interface Props {
  services: ReaderServices;
}

/**
 * Camera -> OCR -> read aloud (card C4). Owns the flow state, the one speech
 * session every screen talks through, and the OCR request in flight.
 */
export function ReadFlow({ services }: Props) {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  const [speechState, setSpeechState] = useState<SpeechState>(IDLE);
  const [speech] = useState(() => new SpeechSession(services.speech, setSpeechState));
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

  switch (state.screen) {
    case 'home':
      return <HomeScreen speech={speech} onRead={() => dispatch({ type: 'open-camera' })} />;
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
          onBack={home}
          onAsk={() => dispatch({ type: 'ask' })}
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
