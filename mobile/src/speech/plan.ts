import type { PhraseId } from './phrases';
import { hasExpiry, lineRole, spokenText } from '../reader/details';
import { speakDates } from '../reader/spokenDate';
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
 * - a confident English line is read as printed, except that a date gets its
 *   month name ("08/2028" -> "August 2028", reader/spokenDate.ts); the screen
 *   still shows the label as printed;
 * - a low-confidence line is never read: the app says it couldn't read it and
 *   to ask the pharmacist;
 * - a Swahili line can't be spoken (no on-device Swahili voice; Chatterbox is
 *   too slow live), so the first one gets a clip saying it's on the screen and
 *   the rest are shown silently;
 * - batch numbers, manufacturing dates, barcodes and the maker's address are
 *   not spoken at all, unsure or not (reader/details.ts); they're shown under
 *   More details. An expiry date is always spoken.
 */
export function buildSpeechPlan(lines: readonly LabelLine[]): SpeechStep[] {
  const steps: SpeechStep[] = [{ kind: 'clip', phrase: 'label_says' }];
  let toldSwahili = false;
  lines.forEach((line, i) => {
    if (lineRole(line) === 'detail') return;
    if (line.lowConfidence) {
      steps.push({ kind: 'clip', phrase: 'line_unsure', line: i });
    } else if (line.language === 'sw') {
      if (!toldSwahili) {
        steps.push({ kind: 'clip', phrase: 'line_swahili', line: i });
        toldSwahili = true;
      }
    } else {
      steps.push({ kind: 'tts', text: speakDates(spokenText(line.text), 'en', hasExpiry(line.text)), line: i });
    }
  });
  steps.push({ kind: 'clip', phrase: 'reading_end' });
  return steps;
}
