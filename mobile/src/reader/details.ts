import type { LabelLine } from './ocrLines';

/**
 * Lines a patient doesn't need read aloud (Wesley, C4a): batch / lot numbers,
 * manufacturing dates, barcodes and the manufacturer's name and address. They
 * stay on screen under "More details". The expiry date is always spoken: it's
 * a safety line, even when it shares a line with the batch number.
 */
const BATCH = /\b(batch|lot)\b|\bb\.?\s?no\b/i;
const MANUFACTURE =
  /\b(mfg|mfd|mft|manufactured|manufacturer|manufacturing|marketed|distributed|imetengenezwa|kutengenezwa|mtengenezaji)\b|\bdate of manufacture\b|\bmade (in|by)\b/i;
const ADDRESS =
  /\b(p\.?\s?o\.?\s?box|tel|phone|fax|e-?mail|www|street|road|avenue|plot|industrial area|ltd|limited|plc|inc)\b|\.com\b|\.co\.ke\b/i;
const BARCODE_WORDS = /\b(gtin|ean|upc)\b/i;
const EXPIRY =
  /\b(exp|expiry|expires|expiration|use by|use before|best before)\b|\btarehe ya (mwisho|kuisha)\b|\bmwisho wa matumizi\b/i;

/** Digits only (spaces, dashes and GS1 brackets allowed), 8 or more of them. */
function isBarcode(text: string): boolean {
  if (BARCODE_WORDS.test(text)) return true;
  return /^[\d\s()-]+$/.test(text) && text.replace(/\D/g, '').length >= 8;
}

export type LineRole = 'read' | 'detail';

/** Whether a label line is read aloud, or only shown under More details. */
export function lineRole(text: string): LineRole {
  if (EXPIRY.test(text)) return 'read';
  if (BATCH.test(text) || MANUFACTURE.test(text) || ADDRESS.test(text) || isBarcode(text)) return 'detail';
  return 'read';
}

/** Splits label lines into those read aloud and those shown under More details, keeping each line's index. */
export function splitDetails(lines: readonly LabelLine[]): { read: number[]; details: number[] } {
  const read: number[] = [];
  const details: number[] = [];
  lines.forEach((l, i) => (lineRole(l.text) === 'detail' ? details : read).push(i));
  return { read, details };
}

/**
 * What to say for a line that is read: the line as printed, except that an
 * expiry date sharing a line with a batch number or a manufacturing date is
 * read on its own ("Batch No: PX2417 Exp: 08/2028" is spoken "Exp: 08/2028").
 * The words spoken are always the printed ones, in their printed order.
 */
export function spokenText(text: string): string {
  const exp = EXPIRY.exec(text);
  if (!exp) return text;
  const before = text.slice(0, exp.index);
  const start = BATCH.test(before) || MANUFACTURE.test(before) ? exp.index : 0;
  const rest = text.slice(exp.index + exp[0].length);
  const hits = [BATCH.exec(rest), MANUFACTURE.exec(rest)].filter((m): m is RegExpExecArray => m !== null);
  const end = hits.length ? exp.index + exp[0].length + Math.min(...hits.map((m) => m.index)) : text.length;
  return text
    .slice(start, end)
    .replace(/[\s,;|/-]+$/, '')
    .trim();
}
