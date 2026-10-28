import {
  loadModel,
  ocr,
  OCR_CRAFT,
  OCR_LATIN,
  textToSpeech,
  translate,
  TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M,
  TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
  unloadModel,
} from '@qvac/sdk';
import { Directory, File, Paths } from 'expo-file-system';

import type { AudioRef } from '../speech/session';
import { encodeWav } from '../speech/wav';
import { ExclusiveModels, type EngineJob } from './exclusiveModels';
import { uriToPath } from './image';
import type { OcrBlock } from './ocrLines';

/**
 * OCR settings from the C2 spike (§1c): capping the CRAFT detector input at
 * 1024 px and recognising one crop at a time cut peak memory from 3.2 GB to
 * 1.7 GB on the VPS and read as well or better. No rotation or contrast
 * retries: they multiply the time and the spike didn't need them for print.
 */
export const OCR_CONFIG = {
  langList: ['en'],
  detectorModelSrc: OCR_CRAFT,
  magRatio: 1.5,
  canvasSize: 1024,
  recognizerBatchSize: 1,
  defaultRotationAngles: [],
  contrastRetry: false,
  lowConfidenceThreshold: 0.4,
};

/** Supertonic 3, English, voice F1 (the voice Wesley heard in C2), slightly slow. */
export const TTS_CONFIG = {
  ttsEngine: 'supertonic' as const,
  language: 'en',
  voice: 'F1',
  ttsSpeed: 0.95,
};
/** TranslatePsy 0.8B, as in the C2 spike (spike/translate.mjs): one label line at a time. */
export const TRANSLATE_CONFIG = { ctx_size: 2048 };

const SUPERTONIC_FALLBACK_RATE = 44100;

/**
 * Loads only from the phone's model cache: the models screen downloaded them
 * on Wi-Fi, and the SDK checks its cache before touching the network, so this
 * works in airplane mode.
 */
const loader = {
  async load(job: EngineJob) {
    if (job === 'ocr') return loadModel({ modelSrc: OCR_LATIN, modelConfig: OCR_CONFIG });
    if (job === 'translate') {
      return loadModel({ modelSrc: TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M, modelConfig: TRANSLATE_CONFIG });
    }
    return loadModel({ modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q4_0, modelConfig: TTS_CONFIG });
  },
  async unload(modelId: string) {
    await unloadModel({ modelId, clearStorage: false });
  },
};

export const models = new ExclusiveModels(loader);

/**
 * A read takes ~22 s on the iPhone 12 (~50 s in the first C4a Debug run), all
 * on the CPU. QVAC's OCR can't be cancelled, so a stuck one would leave the
 * user on the Processing screen forever: give up after this long.
 */
export const OCR_TIMEOUT_MS = 120_000;

/**
 * Runs QVAC OCR on a photo file (already shrunk to OCR_MAX_SIDE). Rejects with
 * JobTimeoutError after OCR_TIMEOUT_MS; the model is then unloaded, the next
 * read loads a fresh one, and the late result is dropped.
 */
export function recognize(photoUri: string, timeoutMs: number = OCR_TIMEOUT_MS): Promise<OcrBlock[]> {
  return models.use(
    'ocr',
    async (modelId) => {
      const { blocks } = ocr({ modelId, image: uriToPath(photoUri), options: { paragraph: false } });
      return (await blocks) as OcrBlock[];
    },
    { timeoutMs },
  );
}

/**
 * Translates label lines, English to Swahili, with TranslatePsy. The model is
 * loaded for the first line; the reader calls `releaseModels()` as soon as the
 * last line is done, so it is only in memory for this step.
 */
export function translateLine(text: string): Promise<string> {
  return models.use('translate', async (modelId) => {
    const run = translate({ modelId, text, from: 'en', to: 'sw', modelType: 'llamacpp-completion', stream: false });
    return (await run.text).trim();
  });
}

let ttsDir: Directory | null = null;
let ttsCount = 0;

function speechDir(): Directory {
  if (!ttsDir) {
    ttsDir = new Directory(Paths.cache, 'soma-tts');
    // Old clips from an earlier run are useless; start each app run clean.
    if (ttsDir.exists) ttsDir.delete();
    ttsDir.create({ intermediates: true });
  }
  return ttsDir;
}

/** Reads one label line with Supertonic on the phone and writes it to a WAV file. */
export function synthesize(text: string): Promise<AudioRef> {
  return models.use('tts', async (modelId) => {
    const result = textToSpeech({ modelId, text, inputType: 'text', stream: false });
    const samples = await result.buffer;
    const rate = (await result.sampleRate) ?? SUPERTONIC_FALLBACK_RATE;
    const file = new File(speechDir(), `line-${ttsCount++ % 64}.wav`);
    if (file.exists) file.delete();
    file.create();
    file.write(encodeWav(samples, rate));
    return { kind: 'file', uri: file.uri };
  });
}

export function releaseModels(): Promise<void> {
  return models.release();
}
