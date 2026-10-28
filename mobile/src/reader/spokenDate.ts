/**
 * Dates as they are spoken. Supertonic reads digits literally ("08/2028" ->
 * "8 slash 2028"), and a low-vision user hears the date once, so the voice
 * gets a month name instead: "August 2028", or "12 August 2028" with a day.
 * Only the text sent to the voice changes; the screen shows the label as printed.
 *
 * Labels in Kenya are day-first, so DD/MM/YYYY is never read as MM/DD. Anything
 * that isn't a valid date (month 13, 31/02, an unclear OCR result) is left as
 * it is: we never guess.
 */

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Swahili month names, for the Swahili template clips (C11). */
export const MONTHS_SW = [
  'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
  'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba',
] as const;

export type DateLanguage = 'en' | 'sw';

/** Printed month words (English, as on packs) and their month numbers, 1-12. */
const WORD_MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MONTH_WORD = Object.keys(WORD_MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

// Not glued to other digits on either side ("1.08/2028", "08/2028/05").
const BEFORE = String.raw`(?<!\d)(?<!\d[/.\-])`;
const AFTER = String.raw`(?!\d)(?![/.\-]\d)`;

/** [day<sep>]month<sep>year in digits. Separators: / - . */
const NUMERIC = new RegExp(
  `${BEFORE}(?:(\\d{1,2})([/.\\-]))?(\\d{2})([/.\\-])(\\d{4}|\\d{2})${AFTER}`,
  'g',
);
/** [day] MONTHWORD [sep] year: "AUG 2028", "12 Aug. 2028". Four-digit years only: "may 25 mg" is a dose. */
const WORDY = new RegExp(
  `${BEFORE}(?:(\\d{1,2})\\s*)?\\b(${MONTH_WORD})\\b\\.?\\s*[/.\\-]?\\s*(\\d{4})${AFTER}`,
  'gi',
);

/**
 * 4 digits: 2000-2099. 2 digits: 2020-2059 only; "08/12" is too unclear (a
 * month and a year, or a day and a month?) to say as a date.
 */
function fullYear(y: string, shortYears = true): number | null {
  if (y.length === 4) return Number(y);
  if (!shortYears) return null;
  const n = Number(y);
  return n >= 20 && n <= 59 ? 2000 + n : null;
}

function daysIn(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "12 August 2028" / "August 2028", or null when day, month or year can't be right. */
function say(day: number | null, month: number, year: number | null, lang: DateLanguage): string | null {
  if (year === null || month < 1 || month > 12 || year < 2000 || year > 2099) return null;
  if (day !== null && (day < 1 || day > daysIn(month, year))) return null;
  const name = (lang === 'sw' ? MONTHS_SW : MONTHS_EN)[month - 1]!;
  return `${day === null ? '' : `${day} `}${name} ${year}`;
}

/**
 * The text with each date written in digits (day, month, year, or month and
 * year) or with a month word replaced by its spoken form. Other text is
 * untouched.
 *   "Exp: 08/2028"      -> "Exp: August 2028"
 *   "EXP 12/08/2028"    -> "EXP 12 August 2028"
 *   "Use by AUG 2028"   -> "Use by August 2028"
 *   "Exp: 13/2028"      -> "Exp: 13/2028"   (not a date)
 * Numeric dates need a two-digit month, so "1/2 tablet" is left alone. A
 * two-digit year ("08/28") is only said when shortYears is true, which the
 * caller sets for a line with an expiry word: elsewhere "10/20 mg" could be
 * anything.
 */
export function speakDates(text: string, lang: DateLanguage = 'en', shortYears = false): string {
  const numeric = text.replace(
    NUMERIC,
    (all: string, day: string | undefined, sep1: string | undefined, month: string, sep2: string,
      year: string, offset: number) => {
      // "EXP08/2028" -> "EXP August 2028": a date glued to a word gets a space, or the voice reads "EXPAugust".
      const gap = /\p{L}/u.test(text[offset - 1] ?? '') ? ' ' : '';
      if (day !== undefined) {
        // DD<sep>MM<sep>YYYY, day first. The separators must match and the year must be in full.
        if (sep1 !== sep2 || year.length !== 4) return all;
        const spoken = say(Number(day), Number(month), fullYear(year), lang);
        return spoken === null ? all : gap + spoken;
      }
      const spoken = say(null, Number(month), fullYear(year, shortYears), lang);
      return spoken === null ? all : gap + spoken;
    },
  );
  return numeric.replace(WORDY, (all: string, day?: string, word?: string, year?: string) => {
    const month = WORD_MONTHS[word!.toLowerCase()]!;
    return say(day === undefined ? null : Number(day), month, fullYear(year!), lang) ?? all;
  });
}
