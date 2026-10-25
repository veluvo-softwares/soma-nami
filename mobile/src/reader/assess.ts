import type { PhraseId } from '../speech/phrases';
import { unionBox, type LabelLine } from './ocrLines';

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * What to do with one photo after OCR:
 *   read      show the lines and read them aloud
 *   hint      stay on the camera, speak how to move, and let the user retake
 *             (or read what was found anyway, when `lines` is not empty)
 *   not-sure  too little could be read safely: the Not sure screen
 */
export type Assessment =
  | { kind: 'read'; lines: LabelLine[] }
  | { kind: 'hint'; hint: PhraseId; lines: LabelLine[] }
  | { kind: 'not-sure'; reason: 'mostly-unreadable' | 'handwritten-dose'; lines: LabelLine[] };

/** Text within this fraction of an edge is treated as cut off by the frame. */
export const EDGE_MARGIN = 0.015;
/** Text covering less than this share of the photo, with small lines, is too far away. */
export const SMALL_AREA = 0.08;
export const SMALL_LINE_HEIGHT = 0.02;
/** More than this share of lines below the confidence gate sends the page to Not sure. */
export const MAX_UNREADABLE_SHARE = 0.5;

/**
 * Handwritten dosing shorthand ("1x3", "2 bd", "Tab 1 tds", "1 nocte"). The
 * C2 spike showed OCR changes these numbers with high confidence ("Tab 1 tds"
 * read as "Tab 4 tds" at 0.93), so a confidence gate can't make them safe.
 */
const DOSE_SHORTHAND =
  /(\b\S{1,2}\s*[x×]\s*\d+\b)|(\b(bd|bid|tds|tid|qds|qid|od|nocte|mane|prn|stat)\b)|(\b\d+\s*\/\s*7\b)/i;

/**
 * A short page with a number on it, or one that uses dosing shorthand, is
 * treated as a handwritten dose label: the app won't read it and sends the
 * user to the pharmacist. Printed packs have many lines and don't trip this;
 * a two-line printed scrap like "100 Tablets" does, which is the safe side.
 */
export function looksLikeHandwrittenDose(lines: readonly LabelLine[]): boolean {
  if (lines.length === 0 || lines.length > 3) return false;
  const all = lines.map((l) => l.text).join(' ');
  if (DOSE_SHORTHAND.test(all)) return true;
  return lines.length <= 2 && lines.every((l) => l.text.length <= 12) && /\d/.test(all);
}

/**
 * Where the text sits in the photo decides the spoken hint (docs/ui.md,
 * Aiming). Text cut off at one edge: move that way. Cut off at opposite
 * edges: move further away. Small and far: move closer.
 */
export function framingHint(lines: readonly LabelLine[], size: ImageSize): PhraseId | null {
  const box = unionBox(lines.map((l) => l.box));
  if (!box || size.width <= 0 || size.height <= 0) return null;
  const mx = size.width * EDGE_MARGIN;
  const my = size.height * EDGE_MARGIN;
  const cutLeft = box.x1 <= mx;
  const cutRight = box.x2 >= size.width - mx;
  const cutTop = box.y1 <= my;
  const cutBottom = box.y2 >= size.height - my;

  if ((cutLeft && cutRight) || (cutTop && cutBottom)) return 'hint_further';
  if (cutLeft) return 'hint_left';
  if (cutRight) return 'hint_right';
  if (cutTop) return 'hint_up';
  if (cutBottom) return 'hint_down';

  const area = ((box.x2 - box.x1) * (box.y2 - box.y1)) / (size.width * size.height);
  const heights = lines
    .map((l) => (l.box ? l.box.y2 - l.box.y1 : 0))
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  const median = heights.length ? heights[Math.floor(heights.length / 2)]! : 0;
  if (area < SMALL_AREA && median / size.height < SMALL_LINE_HEIGHT) return 'hint_closer';
  return null;
}

/** Decides what happens to a photo once OCR has returned its lines. */
export function assessPhoto(lines: LabelLine[], size: ImageSize): Assessment {
  if (lines.length === 0) return { kind: 'hint', hint: 'hint_no_text', lines };

  if (looksLikeHandwrittenDose(lines)) return { kind: 'not-sure', reason: 'handwritten-dose', lines };

  const unreadable = lines.filter((l) => l.lowConfidence).length;
  if (unreadable / lines.length > MAX_UNREADABLE_SHARE) {
    return { kind: 'not-sure', reason: 'mostly-unreadable', lines };
  }

  const hint = framingHint(lines, size);
  if (hint) return { kind: 'hint', hint, lines };
  return { kind: 'read', lines };
}
