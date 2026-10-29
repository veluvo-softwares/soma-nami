import { hasExpiry, lineRole, spokenText } from './details';
import type { LabelLine } from './ocrLines';

/**
 * Reading scope (card A, 29 Oct): what on a medicine label is read aloud,
 * and in what order.
 *
 *   name     the medicine's name and strength ("PARACETAMOL", "Tablets BP 500 mg")
 *   dose     how to take it: dose, how often, how long ("1 to 2 tablets every 4 to 6 hours")
 *   expiry   the expiry date ("Exp: 08/2028"; a batch code on the line is still cut out)
 *   warning  key warnings: maximum dose, keep away from children, do not use if ...
 *   detail   everything else: pack size, storage, ingredients without a strength,
 *            marketing, the maker, batch, barcode. Shown small under More details,
 *            never spoken.
 *
 * The spoken groups are read in that order. Lines are never reworded: a line
 * is read exactly as printed (only a batch or manufacturing field is cut out,
 * reader/details.ts), so a line that mixes a warning with storage text is read
 * whole. Safety comes first: a line that could be a dose or a warning is read.
 *
 * Text that is not on the label at all (another pack, a table, a screen) never
 * gets this far: the photo is cropped to the aiming frame and lines outside
 * the label's block are dropped (reader/assess.ts, labelLines).
 */
export type LineGroup = 'name' | 'dose' | 'expiry' | 'warning' | 'detail';

/** The order the spoken groups are read in. */
export const SPOKEN_ORDER: readonly LineGroup[] = ['name', 'dose', 'expiry', 'warning'];

/** A line that opens with a dosing word is a dose line, even if a limit follows ("Adults: do not take more than 8"). */
const STARTS_DOSE =
  /^\W*(take|dosage|dose|directions|how to (use|take)|adults?|children|chukua|meza|kunywa|tumia|dozi|maelekezo)\b/i;

const WARNING = new RegExp(
  [
    /\b(do not|don'?t|never|keep (out of|away from)|out of (the )?reach|not (to )?exceed|exceed|more than|maximum|max\b\.?|warnings?|caution|overdose)/,
    /\b(not (for|suitable|recommended|to be)|avoid|stop (using|taking)|consult|seek medical|if symptoms persist|pregnan|breast-?feeding|allerg)/,
    /\b(alcohol|liver|kidney|side effects?|discontinue|harmful|poison|external use)/,
    /\b(usitumie|usizidishe|usinywe|usimeze|usichanganye|onyo|tahadhari|hatari|mbali na watoto)\b/,
  ]
    .map((r) => r.source)
    .join('|'),
  'i',
);

const DOSE = new RegExp(
  [
    /\b(take|taken|takes|dosage|doses?|directions?|usage|adults?|children|child|infants?|babies|years?|every|times?|daily|once|twice|thrice)\b/,
    /\b(hourly|hours?|hrs?|days?|weeks?|morning|evening|night|bedtime|before|after|meals?|food|swallow|chew(ed)?|dissolved?|apply|spoonfuls?|teaspoons?|tsp|course|as directed|shake)\b/,
    /\b(chukua|meza|kunywa|tumia|yeyusha|kila|mara|saa|siku|asubuhi|mchana|jioni|usiku|kabla|baada|chakula|wazima|watoto|kijiko|vijiko|vidonge|kidonge|dozi|kipimo)\b/,
  ]
    .map((r) => r.source)
    .join('|'),
  'i',
);

/** "500 mg", "120mg/5ml", "1%", "100,000 IU". */
const STRENGTH = /\d+(?:[.,]\d+)?\s*(mg|mcg|µg|g|ml|iu|%|units?)(?![a-z])/i;
/** Storage text ("Store below 30°C", "Protect from light"). A line that also has a warning or a dose is read. */
const STORAGE = /\b(store|storage|protect(ed)? from|keep (in|at|below|dry|cool|tightly|the container)|refrigerat|hifadhi)/i;
/** The medicine's form on a short line ("Film-coated tablets", "Oral suspension BP"). */
const FORM =
  /\b(tablets?|capsules?|caplets?|syrup|suspension|solution|injection|cream|ointment|gel|drops|sachets?|lozenges?|b\.?p\.?|usp)\b/i;

/** A pack count on its own ("100 Tablets", "3 x 10 tablets", "100 ml"). */
const COUNT_LINE =
  /^\W*(\d+)\s*(x\s*\d+\s*)?(tablets?|capsules?|caplets?|sachets?|ampoules?|vials?|lozenges?|pessaries|suppositories|softgels?|vidonge|ml)\W*$/i;

/** Name lines are picked from lines at least this tall, relative to the tallest name-like line. */
export const NAME_HEIGHT_SHARE = 0.85;
/** Apart from the first line, a name line is printed at least this much taller than the label's median line. */
export const NAME_OVER_BODY = 1.15;
/** At most this many lines are taken as the name on their height alone. */
const MAX_NAME_LINES = 2;

const height = (l: LabelLine) => (l.box ? l.box.y2 - l.box.y1 : 0);
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** The group a line belongs to from its own text, or null when only its size can tell (a name, or nothing). */
function groupByText(line: LabelLine): LineGroup | null {
  const { text } = line;
  if (hasExpiry(text)) return 'expiry';
  if (lineRole(line) === 'detail') return 'detail';
  const t = spokenText(text);
  const count = COUNT_LINE.exec(t);
  if (count) {
    // A pack size is a detail; a small count alone on a line may be the dose, split by OCR.
    const pack = Boolean(count[2]) || Number(count[1]) >= 10 || count[3]!.toLowerCase() === 'ml';
    return pack ? 'detail' : 'dose';
  }
  if (STARTS_DOSE.test(t)) return 'dose';
  if (WARNING.test(t)) return 'warning';
  if (DOSE.test(t)) return 'dose';
  if (STORAGE.test(t)) return 'detail';
  if (STRENGTH.test(t)) return 'name';
  if (line.lowConfidence) {
    // OCR's text is a guess: a number on an unreadable line could be the dose.
    return /\d/.test(t) ? 'dose' : null;
  }
  if (FORM.test(t) && words(t) <= 5) return 'name';
  return null;
}

/**
 * The group of every line, in the same order as `lines`. Lines no text rule
 * claims are the medicine's name when they are among the tallest on the label
 * (the name is printed largest); the rest are details. An unreadable line
 * that no rule claims is decorative (a logo, artwork) and goes to details,
 * unless the label has no readable name, in which case the tallest one stands
 * in for the name and is announced as unreadable.
 */
export function lineGroups(lines: readonly LabelLine[]): LineGroup[] {
  const groups = lines.map(groupByText);
  /** Lines no text rule claimed, with some letters on them: readable ones, or unreadable ones. */
  const open = (readable: boolean) =>
    lines.flatMap((l, i) => (groups[i] === null && l.lowConfidence === !readable && /[a-z]{2}/i.test(l.text) ? [i] : []));

  const pickNames = (candidates: number[]): number[] => {
    if (candidates.length === 0) return [];
    if (!lines.some((l) => l.box)) {
      // No sizes to go by: the first line, if it is one of these, is the name.
      return candidates[0] === 0 ? [0] : [];
    }
    const nameLike = lines.flatMap((l, i) => (groups[i] === 'name' || candidates.includes(i) ? [height(l)] : []));
    const tallest = Math.max(...nameLike);
    if (tallest <= 0) return [];
    // Printed larger than the label's usual line, or the label's first line: a
    // line the same size as the body text further down is body text, not the name.
    const sizes = lines.map(height).filter((h) => h > 0).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
    return candidates
      .filter((i) => height(lines[i]!) >= NAME_HEIGHT_SHARE * tallest)
      .filter((i) => i === 0 || height(lines[i]!) > NAME_OVER_BODY * median)
      .sort((a, b) => height(lines[b]!) - height(lines[a]!) || a - b)
      .slice(0, MAX_NAME_LINES);
  };

  for (const i of pickNames(open(true))) groups[i] = 'name';
  if (!groups.includes('name')) for (const i of pickNames(open(false)).slice(0, 1)) groups[i] = 'name';
  return groups.map((g) => g ?? 'detail');
}

/**
 * Splits label lines into those read aloud, in reading order (name, dose,
 * expiry, warnings; printed order within a group), and those shown under
 * More details. Indices refer to `lines`.
 */
export function splitDetails(lines: readonly LabelLine[]): { read: number[]; details: number[] } {
  const groups = lineGroups(lines);
  const read = SPOKEN_ORDER.flatMap((g) => groups.flatMap((x, i) => (x === g ? [i] : [])));
  const details = groups.flatMap((x, i) => (x === 'detail' ? [i] : []));
  return { read, details };
}
