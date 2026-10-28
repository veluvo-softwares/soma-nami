import type { LabelLine } from './ocrLines';

/**
 * Parts of a label a patient doesn't need read aloud (Wesley, C4a): batch /
 * lot numbers, manufacturing dates, barcodes and the maker's name and
 * address. They're shown under "More details" instead.
 *
 * Safety comes first, so this errs towards reading:
 * - only the batch / manufacturing field is cut out of a line; whatever else
 *   is on it ("Store below 30°C. Mfd by Afya Labs") is still spoken;
 * - a line with an expiry date is always spoken;
 * - words that also occur in instructions only count where they can't be an
 *   instruction ("lot" needs a code after it, "Made in" must start the line);
 * - an address or barcode needs a strong signal: a lone "Limited", or a date
 *   written in digits, is read.
 */
const FIELD =
  /\b(mfg|mfd|mft)\b|\bb\.?\s?no\b|\b(batch|lot)\b(?=\s*(no\.?|number|#)?\s*[:.#]?\s*[a-z-]*\d)|\bdate of manufacture\b|\bmanufactured (by|on)\b|\b(imetengenezwa|kutengenezwa)\b/gi;
/** Fields that only count at the start of a line ("Made in India", "Marketed by ..."). */
const FIELD_LINE =
  /^\s*(manufacturer|manufacturing|marketed by|distributed by|made in|mtengenezaji|batch|lot|b\.?\s?no|mfg|mfd|mft|manufactured|date of manufacture|imetengenezwa|kutengenezwa)\b/i;
/** "Exp", "EXP08/2028", "Expiry", "Valid until", "Use by", "Tumia kabla ya", "Tarehe ya mwisho". */
const EXPIRY =
  /\bexp(?![a-z])|\b(expiry|expires|expiration|valid (until|till|thru)|use by|use before|best before)\b|\btumia kabla\b|\btarehe ya (mwisho|kuisha)\b|\bmwisho wa matumizi\b/gi;
/** The end of a sentence: ". " (or ";") followed by a capital letter. */
const SENTENCE_END = /[.;]\s+(?=[A-Z])/g;

const STRONG_ADDRESS = /\bp\.?\s?o\.?\s?box\b|\b(tel|phone|fax)\b\s*[:.]?\s*\+?\d|\be-?mail\b|\S+@\S+\.\S+/i;
const WEAK_ADDRESS =
  /\b(road|rd|street|avenue|plot|industrial area|ltd|limited|plc|nairobi|mombasa|kenya|tanzania|uganda|india)\b|\bwww\.|\.com\b|\.co\.ke\b|\.org\b/gi;
const BARCODE_WORDS = /\b(gtin|ean|upc)\b/i;

function matches(re: RegExp, text: string): RegExpMatchArray[] {
  re.lastIndex = 0;
  return [...text.matchAll(re)];
}

export const hasExpiry = (text: string) => matches(EXPIRY, text).length > 0;

/** Digits only (spaces and GS1 brackets allowed) and 12 or more of them, as on EAN-13 / GTIN-14 barcodes. */
function isBarcode(text: string): boolean {
  if (BARCODE_WORDS.test(text)) return true;
  return /^[\d\s()]+$/.test(text) && text.replace(/\D/g, '').length >= 12;
}

function isAddress(text: string): boolean {
  if (STRONG_ADDRESS.test(text)) return true;
  return new Set(matches(WEAK_ADDRESS, text).map((m) => m[0].toLowerCase())).size >= 2;
}

function fieldStarts(text: string): number[] {
  const starts = matches(FIELD, text).map((m) => m.index!);
  const line = FIELD_LINE.exec(text);
  if (line) starts.push(line.index + line[0].length - line[1]!.length);
  return [...new Set(starts)].sort((a, b) => a - b);
}

/**
 * The line with its batch and manufacturing fields cut out. A field runs from
 * its name, over its first value, to the next expiry date, the next field, the
 * end of the sentence or the end of the line. What's left is printed text in
 * its printed order. ("Batch No: PX2417 Exp: 08/2028" -> "Exp: 08/2028")
 */
export function spokenText(text: string): string {
  if (fieldStarts(text).length === 0) return text;
  return tidy(keptRanges(text).map(([a, b]) => text.slice(a, b)).join(''));
}

function tidy(out: string): string {
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;|/-]+|[\s,;|/-]+$/g, '')
    .trim();
}

/** The [start, end) character ranges of `text` that are left after the batch and manufacturing fields are cut. */
export function keptRanges(text: string): [number, number][] {
  const fields = fieldStarts(text);
  if (fields.length === 0) return [[0, text.length]];
  const stops = [...matches(EXPIRY, text).map((m) => m.index!), ...fields].sort((a, b) => a - b);
  const kept: [number, number][] = [];
  let pos = 0;
  for (const start of fields) {
    if (start < pos) continue;
    kept.push([pos, start]);
    // Skip the field name, its separator and its first value before looking for the end.
    const head = /^\S+[\s:.#-]*\S*/.exec(text.slice(start))!;
    const from = start + head[0].length;
    SENTENCE_END.lastIndex = from;
    const sentence = SENTENCE_END.exec(text);
    const next = stops.find((s) => s >= from);
    pos = Math.min(next ?? text.length, sentence ? sentence.index + 1 : text.length);
  }
  kept.push([pos, text.length]);
  return kept;
}

/**
 * Which of the given parts (consecutive pieces of `text`, each [start, end))
 * still have something to say after the batch and manufacturing fields are
 * cut. A part that is only a batch code is not spoken, so its confidence
 * must not decide whether the rest of the line is.
 */
export function spokenParts(text: string, parts: readonly [number, number][]): boolean[] {
  const kept = keptRanges(text);
  return parts.map(([ps, pe]) =>
    kept.some(([a, b]) => {
      const from = Math.max(a, ps);
      const to = Math.min(b, pe);
      return to > from && /[a-z0-9]/i.test(text.slice(from, to));
    }),
  );
}

export type LineRole = 'read' | 'detail';

/** Whether a label line is read aloud, or only shown under More details. */
export function lineRole(line: Pick<LabelLine, 'text' | 'lowConfidence'>): LineRole {
  const { text } = line;
  if (hasExpiry(text)) return 'read';
  if (line.lowConfidence) {
    // OCR wasn't sure of this text, so only a field name at the very start
    // counts. Anything else gets the "couldn't read this line" notice.
    return FIELD_LINE.test(text) ? 'detail' : 'read';
  }
  if (isBarcode(text) || isAddress(text)) return 'detail';
  return /[a-z0-9]/i.test(spokenText(text)) ? 'read' : 'detail';
}

/** Splits label lines into those read aloud and those shown under More details, keeping each line's index. */
export function splitDetails(lines: readonly LabelLine[]): { read: number[]; details: number[] } {
  const read: number[] = [];
  const details: number[] = [];
  lines.forEach((l, i) => (lineRole(l) === 'detail' ? details : read).push(i));
  return { read, details };
}
