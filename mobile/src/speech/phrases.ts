import data from '../../assets/phrases/phrases.json';

/**
 * The fixed Swahili phrases the app speaks, each pre-rendered with QVAC
 * Chatterbox (scripts/phrases/generate.mjs). Chatterbox is too slow to run
 * live on the phone, so these ship as audio clips (docs/scope.md §6).
 */
export type PhraseId = keyof typeof data.phrases;

export interface Phrase {
  /** Spoken (from the clip) and shown first. */
  sw: string;
  /** Shown under the Swahili, never spoken. */
  en: string;
}

export const PHRASES: Record<PhraseId, Phrase> = data.phrases;

export const PHRASE_IDS = Object.keys(PHRASES) as PhraseId[];
