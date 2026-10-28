import type { PhraseId } from '../speech/phrases';

/**
 * The fixed list of questions the Ask screen understands (docs/ui.md screen 4,
 * C5). Hold-to-talk is matched against this list only (Whisper's Swahili is
 * too rough for free text: spike report §5), and every question is also a
 * large button.
 */
export type QuestionId =
  | 'time_of_day'
  | 'times_a_day'
  | 'how_many'
  | 'with_food'
  | 'what_is_it'
  | 'expiry'
  | 'read_again';

export interface Question {
  id: QuestionId;
  /** Button text, Swahili first. */
  sw: string;
  /** Small line under it, never spoken. */
  en: string;
  /** Pre-made clip: "Umeuliza: ..." */
  clip: PhraseId;
  icon: 'clock-outline' | 'counter' | 'pill' | 'food' | 'help-circle-outline' | 'calendar-clock' | 'replay';
  /**
   * What Whisper is expected to hear, as spoken Swahili: the full question
   * first, then short forms people actually say. The matcher takes the best
   * variant, so a short "saa ngapi" works. Keep each one at least 8 letters
   * once spaces are dropped, and no variant a substring of another question's.
   */
  variants: readonly string[];
}

export const QUESTIONS: readonly Question[] = [
  {
    id: 'time_of_day',
    sw: 'Hii ni ya saa ngapi?',
    en: 'What time is it for?',
    clip: 'q_time_of_day',
    icon: 'clock-outline',
    variants: ['Hii ni ya saa ngapi?', 'Saa ngapi?', 'Nitumie saa ngapi?'],
  },
  {
    id: 'times_a_day',
    sw: 'Mara ngapi kwa siku?',
    en: 'How many times a day?',
    clip: 'q_times_a_day',
    icon: 'counter',
    variants: ['Nimeze mara ngapi kwa siku?', 'Mara ngapi kwa siku?', 'Mara ngapi?'],
  },
  {
    id: 'how_many',
    sw: 'Nimeze vidonge vingapi?',
    en: 'How many do I take?',
    clip: 'q_how_many',
    icon: 'pill',
    variants: ['Nimeze vidonge vingapi?', 'Vidonge vingapi?', 'Nimeze ngapi?'],
  },
  {
    id: 'with_food',
    sw: 'Nimeze na chakula?',
    en: 'With food?',
    clip: 'q_with_food',
    icon: 'food',
    variants: ['Nimeze kabla au baada ya chakula?', 'Nimeze na chakula?', 'Na chakula?'],
  },
  {
    id: 'what_is_it',
    sw: 'Ni dawa gani?',
    en: 'Which medicine is this?',
    clip: 'q_what_is_it',
    icon: 'help-circle-outline',
    variants: ['Hii ni dawa gani?', 'Ni dawa gani?'],
  },
  {
    id: 'expiry',
    sw: 'Dawa hii inaisha muda lini?',
    en: 'When does it expire?',
    clip: 'q_expiry',
    icon: 'calendar-clock',
    variants: ['Dawa hii inaisha muda lini?', 'Inaisha lini?', 'Tarehe ya mwisho?'],
  },
  {
    id: 'read_again',
    sw: 'Soma tena.',
    en: 'Read it again.',
    clip: 'q_read_again',
    icon: 'replay',
    variants: ['Nisomee tena.', 'Soma tena.', 'Soma tena lebo.'],
  },
];

export function getQuestion(id: QuestionId): Question {
  return QUESTIONS.find((q) => q.id === id)!;
}
