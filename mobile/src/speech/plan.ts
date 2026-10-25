import type { PhraseId } from './phrases';
import type { LabelLine } from '../reader/ocrLines';

/**
 * One thing to say, in order:
 *   clip  a pre-rendered Swahili phrase
 *   tts   label text read on the phone by Supertonic (English only)
 * `line` is the label line the step belongs to, so the screen can highlight it.
 */
export type SpeechStep =
  | { kind: 'clip'; phrase: PhraseId; line?: number }
  | { kind: 'tts'; text: string; line: number };

/**
 * Turns the label lines into what the app says. Product rules:
 * - a confident English line is read exactly as printed;
 * - a low-confidence line is never read: the app says it couldn't read it and
 *   to ask the pharmacist;
 * - a Swahili line can't be spoken (no on-device Swahili voice; Chatterbox is
 *   too slow live), so the first one gets a clip saying it's on the screen and
 *   the rest are shown silently.
 */
export function buildSpeechPlan(lines: readonly LabelLine[]): SpeechStep[] {
  const steps: SpeechStep[] = [{ kind: 'clip', phrase: 'label_says' }];
  let toldSwahili = false;
  lines.forEach((line, i) => {
    if (line.lowConfidence) {
      steps.push({ kind: 'clip', phrase: 'line_unsure', line: i });
    } else if (line.language === 'sw') {
      if (!toldSwahili) {
        steps.push({ kind: 'clip', phrase: 'line_swahili', line: i });
        toldSwahili = true;
      }
    } else {
      steps.push({ kind: 'tts', text: line.text, line: i });
    }
  });
  steps.push({ kind: 'clip', phrase: 'reading_end' });
  return steps;
}
