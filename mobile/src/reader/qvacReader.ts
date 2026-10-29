import {
  cancel,
  loadModel,
  ocr,
  OCR_CRAFT,
  OCR_LATIN,
  textToSpeech,
  translate,
  TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M,
  TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
  unloadModel,
  WHISPER_SMALL_Q8_0,
} from '@qvac/sdk';
import { Directory, File, Paths } from 'expo-file-system';

import { whisperPrompt } from '../listen/prompt';
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
 * Whisper small for hold-to-talk (C5b), as in the C2 spike (§5,
 * spike/asr_match.mjs): Swahili, greedy, temperature 0, prompted with the
 * question list so it leans toward our wording. The prompt is set at load
 * (the spike passed it per call, which makes the SDK reload the model with it
 * as initial_prompt: same effect, one load fewer). CPU only, like every model
 * in the app (plugins/withQvacCpuOnly.js).
 */
export const WHISPER_CONFIG = {
  language: 'sw',
  translate: false,
  strategy: 'greedy' as const,
  temperature: 0.0,
  no_timestamps: true,
  suppress_blank: true,
  suppress_nst: true,
  n_threads: 4,
  initial_prompt: whisperPrompt(),
  contextParams: { use_gpu: false },
};

let asrLoadId: string | null = null;

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
    if (job === 'asr') {
      const t0 = Date.now();
      const op = loadModel({ modelSrc: WHISPER_SMALL_Q8_0, modelConfig: WHISPER_CONFIG });
      asrLoadId = op.requestId;
      try {
        const id = await op;
        console.log(`[soma] asr load ${Date.now() - t0} ms`);
        return id;
      } finally {
        asrLoadId = null;
      }
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

/** Stops a Whisper load in progress (hold-to-talk cancelled). No-op otherwise. */
export async function cancelAsrLoad(): Promise<void> {
  const requestId = asrLoadId;
  if (requestId) await cancel({ requestId });
}

export function releaseModels(): Promise<void> {
  return models.release();
}
