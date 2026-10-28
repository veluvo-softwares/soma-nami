import { hasExpiry, lineRole, spokenText } from '../reader/details';
import type { LabelLine } from '../reader/ocrLines';
import type { QuestionId } from './questions';

/**
 * Answers a matched question from the OCR lines of the label just scanned,
 * and from nothing else (C5). The answer is the label line itself, quoted
 * exactly as OCR read it. The app never rewrites, adds up, converts or
 * explains a dose: no model is involved, so it cannot invent a number
 * (product rule 1; the C2 spike's Qwen got 1 dose answer unsafe).
 *
 * It refuses, and points to the pharmacist, when
 * - no line says (`not-stated`);
 * - a line that would say is below the OCR confidence gate, or, for a dose
 *   question, any line at all was unreadable, since the answer may be in it
 *   (`unsure`);
 * - the label says two different things (`conflict`).
 */
export type RefusalReason = 'not-stated' | 'unsure' | 'conflict';

export interface QuotedLine {
  /** Index into the label lines, for highlighting. */
  index: number;
  /** The line exactly as OCR read it: shown in the quote block. */
  text: string;
  /** What is read aloud: the line with batch / manufacturing fields cut out (reader/details.ts); equal to `text` otherwise. */
  spoken: string;
  language: LabelLine['language'];
}

export type Answer =
  | { kind: 'answer'; question: QuestionId; quotes: QuotedLine[] }
  | { kind: 'read-again' }
  | { kind: 'refuse'; question: QuestionId; reason: RefusalReason };

/** Questions whose answer is a dose or a time: the label is never guessed for these. */
const DOSE_QUESTIONS: ReadonlySet<QuestionId> = new Set(['time_of_day', 'times_a_day', 'how_many']);

/** More lines than this are quoted for one question -> the label is too unclear to pick from. */
const MAX_QUOTES = 3;

const WORD_NUMBER = '(?:one|two|three|four|five|six|once|twice|thrice|moja|mbili|tatu|nne|tano)';
const NUM = `(?:\\d+(?:[.,]\\d+)?|${WORD_NUMBER})`;
const FORM = '(?:tablets?|tabs?|capsules?|caps?|sachets?|drops?|puffs?|teaspoons?|tsp|tablespoons?|vidonge|kidonge|kijiko|vijiko)';

const PATTERNS: Record<Exclude<QuestionId, 'expiry' | 'read_again'>, RegExp[]> = {
  // A clock time, or a part of the day.
  time_of_day: [
    /\b\d{1,2}\s?[:.]\s?\d{2}\s?(?:am|pm|hrs?)?\b/i,
    /\b\d{1,2}\s?(?:am|pm)\b/i,
    /\b(?:morning|noon|afternoon|evening|night|bedtime|at night|asubuhi|mchana|jioni|usiku)\b/i,
    /\b(?:nocte|mane)\b/i,
  ],
  // How often: "3 times a day", "twice daily", "every 8 hours", dosing shorthand as printed.
  times_a_day: [
    new RegExp(`\\b${NUM}\\s*(?:x|times?)\\s*(?:a|per|each|every|kwa)?\\s*(?:day|daily|siku)\\b`, 'i'),
    /\b(?:once|twice|thrice)\b/i,
    /\b(?:daily|every\s+day|each\s+day|kila\s+siku|mara\s+\S+\s+kwa\s+siku)\b/i,
    new RegExp(`\\bevery\\s+${NUM}\\s*(?:-\\s*${NUM}\\s*)?(?:hours?|hrs?|h)\\b`, 'i'),
    /\b(?:od|bd|bid|tds|tid|qds|qid|nocte)\b/i,
    /\b\d\s?[x×]\s?\d\b/i,
  ],
  // How much per dose: "Take 2 tablets", "1 capsule". Not "Each tablet contains 500 mg" (strength).
  how_many: [
    new RegExp(`\\b(?:take|swallow|give|chukua|meza|mimina)\\b[^.;]*\\b${NUM}\\b`, 'i'),
    new RegExp(`\\b${NUM}\\s*${FORM}\\b`, 'i'),
    /\b(?:adults?|children|watu wazima|watoto)\b[^.;]*\b\d+(?:[.,]\d+)?\s*(?:ml|mg)\b/i,
    /\b(?:dose|dosage|dozi)\b/i,
  ],
  with_food: [
    /\b(?:food|meals?|breakfast|lunch|dinner|empty stomach|milk|chakula|chai|uji|tumbo tupu)\b/i,
    /\b(?:before|after|with|during)\s+(?:eating|meals?|food)\b/i,
  ],
  what_is_it: [],
};

/** A line that gives the strength or contents, not the dose to take. */
const STRENGTH_LINE = /\b(?:each|contains?|composition|ingredients?|pack(?:s|ed)?|strips?|blisters?|i[mn]\s+(?:\d|each)|per\s+(?:tablet|capsule|5\s?ml))\b/i;

/** A ceiling ("Do not take more than ...", "maximum"), not the dose. */
const LIMIT_LINE = /\b(?:more than|not exceed|exceed|maximum|max\.?|usizidishe|zaidi ya)\b/i;

/** Words that make a line a medicine name or its form / strength. */
const NAME_LINE = /\b(?:tablets?|capsules?|syrup|suspension|solution|injection|cream|ointment|drops|sachets?|oral|b\.?p\.?|usp|mg|mcg|ml)\b/i;

function numbersIn(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

const words = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

function isCandidate(question: Exclude<QuestionId, 'read_again'>, line: LabelLine): boolean {
  const text = line.text;
  if (question === 'expiry') return hasExpiry(text);
  if (question === 'what_is_it') return false; // handled by pickName
  if (question === 'how_many' && STRENGTH_LINE.test(text) && !/\b(?:take|swallow|chukua|meza)\b/i.test(text)) return false;
  // "Do not take more than 8 tablets in 24 hours" is a limit, not the dose to take.
  if (question === 'how_many' && LIMIT_LINE.test(text)) return false;
  // Expiry and batch lines carry digits that look like times or amounts.
  if (question !== 'with_food' && hasExpiry(text)) return false;
  if (question !== 'with_food' && lineRole(line) === 'detail') return false;
  return PATTERNS[question].some((re) => re.test(text));
}

/** The medicine name line: the first confident line that names a form or strength. */
function nameCandidates(lines: readonly LabelLine[]): number[] {
  const first = lines.findIndex((l) => NAME_LINE.test(l.text) && lineRole(l) !== 'detail' && !hasExpiry(l.text));
  return first === -1 ? [] : [first];
}

function quote(lines: readonly LabelLine[], i: number): QuotedLine {
  const line = lines[i]!;
  const spoken = spokenText(line.text);
  return { index: i, text: line.text, spoken: spoken === '' ? line.text : spoken, language: line.language };
}

export function answerQuestion(question: QuestionId, lines: readonly LabelLine[]): Answer {
  if (question === 'read_again') return { kind: 'read-again' };
  const refuse = (reason: RefusalReason): Answer => ({ kind: 'refuse', question, reason });

  const unreadable = lines.filter((l) => l.lowConfidence);
  // Nearly nothing readable: whatever this finds would be a guess.
  if (lines.length === 0 || unreadable.length * 2 > lines.length) return refuse('unsure');

  const candidates =
    question === 'what_is_it'
      ? nameCandidates(lines)
      : lines.flatMap((line, i) => (isCandidate(question, line) ? [i] : []));

  // The line that would answer is unreadable: say so, never show a guess.
  if (candidates.some((i) => lines[i]!.lowConfidence)) return refuse('unsure');
  if (candidates.length === 0) {
    // The answer to a dose question may be in a line we couldn't read.
    return refuse(DOSE_QUESTIONS.has(question) && unreadable.length > 0 ? 'unsure' : 'not-stated');
  }

  // The same text twice (a pack printed on two faces) is one answer.
  const seen = new Set<string>();
  const unique = candidates.filter((i) => {
    const key = words(lines[i]!.text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Two lines with different numbers: the label disagrees with itself.
  const numberSets = new Set(unique.map((i) => numbersIn(lines[i]!.text).join('|')));
  if (numberSets.size > 1 || unique.length > MAX_QUOTES) return refuse('conflict');

  return { kind: 'answer', question, quotes: unique.map((i) => quote(lines, i)) };
}

export { numbersIn };
