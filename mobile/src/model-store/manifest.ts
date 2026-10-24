/**
 * Every model the app needs, downloaded once on Wi-Fi before the app can read.
 *
 * The set follows the primary choices in docs/scope.md §1. Change it here only;
 * the models screen, the read gate and the README size all come from this list.
 * `name` must be the QVAC registry constant name exported by @qvac/sdk 0.22.0
 * (see `MODEL_DESCRIPTORS` in qvacClient.ts, which typechecks each one).
 */
export type ModelJob = 'ocr' | 'speech-en' | 'speech-sw' | 'answer';

export type ModelName =
  | 'OCR_CRAFT'
  | 'OCR_LATIN'
  | 'TTS_MULTILINGUAL_SUPERTONIC3_Q4_0'
  | 'TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0'
  | 'TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0'
  | 'QWEN3_1_7B_INST_Q4';

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
    name: 'TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0',
    label: 'Swahili voice (part 1)',
    job: 'speech-sw',
    approxBytes: 344_985_408,
  },
  {
    name: 'TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0',
    label: 'Swahili voice (part 2)',
    job: 'speech-sw',
    approxBytes: 788_432_672,
  },
  {
    name: 'QWEN3_1_7B_INST_Q4',
    label: 'Question answering',
    job: 'answer',
    approxBytes: 1_056_782_912,
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
