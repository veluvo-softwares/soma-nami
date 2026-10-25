import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { PHRASE_ASSETS } from './phraseAssets';
import type { AudioRef, SpeechBackend } from './session';

const LOAD_TIMEOUT_MS = 8000;
const END_SLACK_MS = 3000;

let modeSet: Promise<void> | null = null;

/** Play through the speaker even with the iPhone's silent switch on. */
function ensureAudioMode(): Promise<void> {
  modeSet ??= setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' }).catch(() => {
    modeSet = null;
  });
  return modeSet;
}

/**
 * Plays pre-rendered phrase clips and synthesised label lines with expo-audio.
 * `synthesize` is injected (QVAC Supertonic in the app, a fake in tests).
 */
export function createExpoAudioBackend(synthesize: SpeechBackend['synthesize']): SpeechBackend {
  let active: { player: AudioPlayer; finish: () => void } | null = null;
  // Bumped by every stop(), so a play() still waiting on the audio session
  // when stop() lands never starts its sound afterwards.
  let generation = 0;

  const stop = () => {
    generation++;
    const a = active;
    active = null;
    if (!a) return;
    try {
      a.player.pause();
    } catch {
      // Already released.
    }
    a.finish();
  };

  return {
    synthesize,
    stop,
    async play(audio: AudioRef, rate: number) {
      stop();
      const mine = generation;
      await ensureAudioMode();
      if (mine !== generation) return;
      const source = audio.kind === 'clip' ? PHRASE_ASSETS[audio.phrase] : { uri: audio.uri };
      // A phrase whose clip hasn't been rendered is skipped rather than
      // blocking the reader; phrases.test.ts stops that from shipping.
      if (source === undefined) {
        console.warn(`[soma] no clip for phrase ${audio.kind === 'clip' ? audio.phrase : ''}`);
        return;
      }

      const player = createAudioPlayer(source);
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let endTimer: ReturnType<typeof setTimeout> | null = null;
        // A file that never loads would otherwise leave the reader waiting forever.
        const loadTimer = setTimeout(() => done(new Error('audio did not load')), LOAD_TIMEOUT_MS);
        const done = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(loadTimer);
          if (endTimer) clearTimeout(endTimer);
          sub.remove();
          player.remove();
          if (active?.player === player) active = null;
          if (error) reject(error);
          else resolve();
        };
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded) clearTimeout(loadTimer);
          if (status.didJustFinish) {
            done();
            return;
          }
          // Backstop in case the finish event is missed: the time left at this
          // rate plus slack, re-armed on every update while playing. Paused
          // (a phone call, say) disarms it, so a line is never skipped unheard.
          if (endTimer) clearTimeout(endTimer);
          endTimer = null;
          if (status.playing && status.duration > 0) {
            const left = Math.max(0, status.duration - status.currentTime) / rate;
            endTimer = setTimeout(() => done(), left * 1000 + END_SLACK_MS);
          }
        });
        active = { player, finish: () => done() };
        try {
          player.setPlaybackRate(rate, 'high');
          player.play();
        } catch (e) {
          done(e instanceof Error ? e : new Error(String(e)));
        }
      });
    },
  };
}
