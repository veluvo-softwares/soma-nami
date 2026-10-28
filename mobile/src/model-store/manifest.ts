/**
 * Every model the app needs, downloaded once on Wi-Fi before the app can read.
 *
 * The set follows docs/scope.md §1 and the 24 Oct decisions: no Chatterbox on
 * the phone (the fixed Swahili phrases ship as pre-generated audio), Whisper
 * small for hold-to-talk questions (C5), TranslatePsy 0.8B for Tafsiri (C11).
 * Change the set here only; the models screen, the read gate and the size
 * shown to the user all come from this list.
 * `name` must be the QVAC registry constant name exported by @qvac/sdk 0.22.0
 * (see `MODEL_DESCRIPTORS` in qvacClient.ts, which typechecks each one).
 */
export type ModelJob = 'ocr' | 'speech-en' | 'listen' | 'answer' | 'translate';

export type ModelName =
  | 'OCR_CRAFT'
  | 'OCR_LATIN'
  | 'TTS_MULTILINGUAL_SUPERTONIC3_Q4_0'
  | 'WHISPER_SMALL_Q8_0'
  | 'QWEN3_1_7B_INST_Q4'
  | 'TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M';

export interface ModelEntry {
  name: ModelName;
  /** What it is for, shown on the models screen. */
  label: string;
  job: ModelJob;
  /** Bytes, from the registry's `expectedSize`. Used before the SDK reports a total. */
  approxBytes: number;
}

export const MODEL_MANIFEST: readonly ModelEntry[] = [
  { name: 'OCR_CRAFT', label: 'Text detector', job: 'ocr', approxBytes: 83_133_856 },
  { name: 'OCR_LATIN', label: 'Text reader', job: 'ocr', approxBytes: 15_396_512 },
  {
    name: 'TTS_MULTILINGUAL_SUPERTONIC3_Q4_0',
    label: 'English voice',
    job: 'speech-en',
    approxBytes: 84_658_368,
  },
  {
    name: 'WHISPER_SMALL_Q8_0',
    label: 'Listening to questions',
    job: 'listen',
    approxBytes: 264_464_607,
  },
  {
    name: 'QWEN3_1_7B_INST_Q4',
    label: 'Question answering',
    job: 'answer',
    approxBytes: 1_056_782_912,
  },
  {
    name: 'TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M',
    label: 'Translating to Swahili',
    job: 'translate',
    approxBytes: 672_329_792,
  },
];

export function totalBytes(manifest: readonly ModelEntry[]): number {
  return manifest.reduce((sum, m) => sum + m.approxBytes, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}
