import { cancel, transcribe } from '@qvac/sdk';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { createExpoRecorder } from './expoRecorder';
import { HoldToTalk } from './holdToTalk';
import { WhisperTranscriber } from './whisper';
import { qvacModelClient } from '../model-store/qvacClient';
import { uriToPath } from '../reader/image';
import { cancelAsrLoad, models } from '../reader/qvacReader';
import type { ListenService } from '../reader/types';

let pcmCount = 0;

function writePcm(pcm: Uint8Array): string {
  const dir = new Directory(Paths.cache, 'soma-asr');
  if (!dir.exists) dir.create({ intermediates: true });
  // `.pcm`, not `.wav`: the SDK streams it to Whisper as raw s16le instead of
  // sending it to the FFmpeg decoder the app doesn't bundle.
  const file = new File(dir, `question-${pcmCount++ % 4}.pcm`);
  if (file.exists) file.delete();
  file.create();
  file.write(pcm);
  const path = uriToPath(file.uri);
  written.set(path, file);
  return path;
}

const written = new Map<string, File>();

function removeFile(path: string) {
  const f = written.get(path);
  written.delete(path);
  try {
    if (f?.exists) f.delete();
  } catch {
    // Already gone; the OS clears the cache folder anyway.
  }
}

/**
 * The real hold-to-talk: expo-audio's microphone and QVAC Whisper small,
 * loaded from the phone's cache only (no network). iOS only for now: the
 * recorder asks iOS for a 16 kHz linear-PCM WAV, and Android's recorder
 * can't write one, so Android keeps the question buttons.
 * Not unit tested: it needs the native modules. holdToTalk.test.ts and
 * whisper.test.ts cover the logic it wires together.
 */
export function createListenService(): ListenService | undefined {
  if (Platform.OS !== 'ios') return undefined;
  return new HoldToTalk({
    recorder: createExpoRecorder(),
    transcriber: new WhisperTranscriber({
      isCached: () => qvacModelClient.isCached('WHISPER_SMALL_Q8_0'),
      models,
      cancelLoad: cancelAsrLoad,
      transcribe: (params) => transcribe(params),
      cancel: (params) => cancel(params),
      writePcm,
      removeFile,
    }),
  });
}
