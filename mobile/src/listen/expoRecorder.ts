import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';

import type { Recorder } from './holdToTalk';
import { WHISPER_RATE } from './pcm';

/**
 * iOS records linear PCM straight to a 16 kHz mono 16-bit WAV, which is what
 * Whisper wants, so nothing has to be decoded or resampled on the phone.
 * (expo-audio's recorder takes the platform's options flattened, as its own
 * useAudioRecorder hook builds them.)
 */
const IOS_WAV = {
  extension: '.wav',
  sampleRate: WHISPER_RATE,
  numberOfChannels: 1,
  bitRate: WHISPER_RATE * 16,
  isMeteringEnabled: false,
  outputFormat: IOSOutputFormat.LINEARPCM,
  audioQuality: AudioQuality.HIGH,
  linearPCMBitDepth: 16,
  linearPCMIsBigEndian: false,
  linearPCMIsFloat: false,
};

/** The playback mode expoAudioBackend.ts uses: speaker, even on silent. */
const PLAYBACK_MODE = { playsInSilentMode: true, interruptionMode: 'doNotMix' as const, allowsRecording: false };

/**
 * The microphone through expo-audio. One recorder per press, released on
 * every way out, and the audio session switched back to playback afterwards
 * (left in record mode, iOS plays the answer quietly from the earpiece).
 * Not unit tested: it needs the native module. holdToTalk.test.ts covers
 * what it is driven by.
 */
export function createExpoRecorder(): Recorder {
  let active: AudioRecorder | null = null;

  const shutdown = async (): Promise<string | null> => {
    const r = active;
    active = null;
    if (!r) return null;
    let failure: unknown = null;
    try {
      if (r.isRecording) await r.stop();
    } catch (e) {
      failure = e;
    }
    const uri = r.uri;
    r.release();
    await setAudioModeAsync(PLAYBACK_MODE).catch(() => undefined);
    if (failure) {
      remove(uri);
      throw failure;
    }
    return uri;
  };

  const remove = (uri: string | null) => {
    if (!uri) return;
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      // Already gone; the OS clears the cache folder anyway.
    }
  };

  return {
    async requestPermission() {
      const res = await requestRecordingPermissionsAsync();
      return res.granted;
    },
    async start() {
      await shutdown().then(remove);
      await setAudioModeAsync({ ...PLAYBACK_MODE, allowsRecording: true });
      // AudioModule is the native module object, not an ES namespace; this is
      // how expo-audio's own useAudioRecorder creates a recorder.
      // eslint-disable-next-line import/namespace
      const r = new AudioModule.AudioRecorder(IOS_WAV);
      active = r;
      await r.prepareToRecordAsync();
      r.record();
    },
    async stop() {
      const uri = await shutdown();
      if (!uri) throw new Error('no recording');
      try {
        return await new File(uri).bytes();
      } finally {
        // The recording is the user's voice: never keep it.
        remove(uri);
      }
    },
    async discard() {
      remove(await shutdown());
    },
  };
}
