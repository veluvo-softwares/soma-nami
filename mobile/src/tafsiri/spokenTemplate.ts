import type { PhraseId } from '../speech/phrases';

/**
 * Spoken Swahili for the lines that follow a fixed pattern. The iPhone has no
 * Swahili voice and Chatterbox is far too slow live, so a translated line is
 * shown, and only a line that fits one of these templates is also spoken, by
 * playing pre-generated clips one after another (docs/plan.md, C11).
 *
 * The numbers come from the ORIGINAL English line, never from the model's
 * translation. The match is on the whole line: any word the template doesn't
 * know means no match, and a line that doesn't match is shown, not spoken.
 *
 *   dose     Take <count> <tablet|capsule> [<frequency>] [for <days>]
 *   expiry   Expiry: <month> <year>   (also 03/2028, Exp 03-2028, Use before ...)
 *
 * Counts are 1-10 for tablets and capsules, plus half, a quarter, 1 and a half
 * and 2 and a half for tablets. Frequencies are 1-6 a day. Durations are 1-10
 * days and 14. Expiry years are 2026-2035.
 */

const COUNT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const COUNT_ALT = Object.keys(COUNT_WORDS).join('|');
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const DURATION_DAYS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14]);
export const EXPIRY_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035] as const;

function clean(line: string): string {
  return line
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\u00a0\u2009\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!]+$/, '')
    .trim();
}

/** "2", "two", "a" / "an" -> a whole number 1-10, or null. */
function wholeCount(word: string): number | null {
  if (word === 'a' || word === 'an') return 1;
  if (/^\d+$/.test(word)) {
    const n = Number(word);
    return n >= 1 && n <= 10 ? n : null;
  }
  return COUNT_WORDS[word] ?? null;
}

type Form = 'tablet' | 'capsule';

/** The clip for "<count> <form>", or null when there isn't one. */
function countClip(count: string, form: Form): PhraseId | null {
  const c = count.trim();
  if (form === 'tablet') {
    const HALF = ['half a', 'half of a', 'half', '1/2', '½', '0.5'];
    const QUARTER = ['a quarter of a', 'a quarter', 'quarter of a', 'quarter', '1/4', '¼', '0.25'];
    const ONE_HALF = ['1 and a half', 'one and a half', '1 and half', '1½', '1 ½', '1.5'];
    const TWO_HALF = ['2 and a half', 'two and a half', '2 and half', '2½', '2 ½', '2.5'];
    if (HALF.includes(c)) return 'tpl_tab_half';
    if (QUARTER.includes(c)) return 'tpl_tab_quarter';
    if (ONE_HALF.includes(c)) return 'tpl_tab_1_5';
    if (TWO_HALF.includes(c)) return 'tpl_tab_2_5';
  }
  const n = wholeCount(c);
  if (n === null) return null;
  return (form === 'tablet' ? `tpl_tab_${n}` : `tpl_cap_${n}`) as PhraseId;
}

function frequencyClip(text: string): PhraseId | null | 'none' {
  const t = text.trim();
  if (t === '') return 'none';
  if (/^(?:once|daily|every day|each day|once daily|once a day|once per day|1 time a day)$/.test(t)) return 'tpl_freq_1';
  if (/^(?:twice|twice daily|twice a day|twice per day)$/.test(t)) return 'tpl_freq_2';
  if (/^(?:thrice|thrice daily|thrice a day)$/.test(t)) return 'tpl_freq_3';
  const m = /^(\d+|one|two|three|four|five|six) times? (?:a|per|each) day$|^(\d+|one|two|three|four|five|six) times daily$/.exec(t);
  if (m) {
    const n = wholeCount((m[1] ?? m[2])!);
    if (n !== null && n <= 6) return `tpl_freq_${n}` as PhraseId;
  }
  return null;
}

function durationClip(n: number): PhraseId | null {
  return DURATION_DAYS.has(n) ? (`tpl_days_${n}` as PhraseId) : null;
}

function doseClips(s: string): PhraseId[] | null {
  const m = new RegExp(
    `^take (.+?) (tablets?|capsules?)(?: (?!for )(.+?))?(?: for (\\d+|${COUNT_ALT}) days?)?$`,
  ).exec(s);
  if (!m) return null;
  const form: Form = m[2]!.startsWith('capsule') ? 'capsule' : 'tablet';
  const count = countClip(m[1]!, form);
  if (!count) return null;
  const clips: PhraseId[] = ['tpl_take', count];
  const freq = frequencyClip(m[3] ?? '');
  if (freq === null) return null;
  if (freq !== 'none') clips.push(freq);
  if (m[4] !== undefined) {
    const n = /^\d+$/.test(m[4]) ? Number(m[4]) : wholeCount(m[4]);
    const days = n === null ? null : durationClip(n);
    if (!days) return null;
    clips.push(days);
  }
  return clips;
}

function expiryClips(s: string): PhraseId[] | null {
  const lead = '(?:exp(?:iry)?(?: date)?|expires?|use before|use by|best before|use before end of)';
  const sep = '\\s*[:\\-]?\\s*';
  const numeric = new RegExp(`^${lead}${sep}(\\d{1,2})\\s*[/-]\\s*(\\d{4})$`).exec(s);
  const named = new RegExp(`^${lead}${sep}([a-z]+)\\.?,?\\s+(\\d{4})$`).exec(s);
  let month: number | undefined;
  let year: number | undefined;
  if (numeric) {
    month = Number(numeric[1]);
    year = Number(numeric[2]);
  } else if (named) {
    month = MONTHS[named[1]!];
    year = Number(named[2]);
  }
  if (month === undefined || year === undefined) return null;
  if (month < 1 || month > 12) return null;
  if (!(EXPIRY_YEARS as readonly number[]).includes(year)) return null;
  return ['tpl_expiry_lead', `tpl_month_${month}` as PhraseId, `tpl_year_${year}` as PhraseId];
}

/**
 * The clips to play for an English label line, in order, or null when the line
 * doesn't fit a template and so is shown but not spoken.
 */
export function spokenClipsFor(originalEnglish: string): PhraseId[] | null {
  const s = clean(originalEnglish);
  if (s === '') return null;
  return doseClips(s) ?? expiryClips(s);
}
