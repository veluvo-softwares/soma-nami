import type { PhraseId } from '../speech/phrases';
import type { SpeechStep } from '../speech/plan';
import type { Answer, RefusalReason } from './answer';
import { getQuestion } from './questions';

export const REFUSAL_PHRASE: Record<RefusalReason, PhraseId> = {
  'not-stated': 'ask_not_stated',
  unsure: 'ask_unsure',
  conflict: 'ask_conflict',
};

/**
 * What the app says for an answer (C5): the matched question repeated back
 * from its pre-made clip, "Lebo inasema", then the label line exactly as
 * printed (English read by Supertonic; a Swahili line is shown, with the
 * same one clip C4 uses to say it's on the screen). A refusal is one clip and
 * never reads any label text.
 */
export function buildAnswerPlan(answer: Answer): SpeechStep[] {
  if (answer.kind === 'read-again') return [{ kind: 'clip', phrase: getQuestion('read_again').clip }];
  const asked: SpeechStep = { kind: 'clip', phrase: getQuestion(answer.question).clip };
  if (answer.kind === 'refuse') return [asked, { kind: 'clip', phrase: REFUSAL_PHRASE[answer.reason] }];
  const steps: SpeechStep[] = [asked, { kind: 'clip', phrase: 'label_says' }];
  let toldSwahili = false;
  for (const q of answer.quotes) {
    if (q.language === 'sw') {
      if (!toldSwahili) {
        steps.push({ kind: 'clip', phrase: 'line_swahili', line: q.index });
        toldSwahili = true;
      }
    } else {
      steps.push({ kind: 'tts', text: q.spoken, line: q.index });
    }
  }
  return steps;
}
