import { QUESTIONS } from '../ask/questions';

/**
 * Whisper's initial prompt: the full spoken form of every list question,
 * joined, as in the C2 spike's "prompted" mode (spike/asr_match.mjs). It
 * nudges Whisper's Swahili spelling toward our wording; the spike showed it
 * does not make Whisper hear a list question that wasn't said (0 wrong
 * matches in 288 tries, every out-of-list question rejected).
 */
export function whisperPrompt(): string {
  return QUESTIONS.map((q) => q.variants[0] ?? q.sw).join(' ');
}
