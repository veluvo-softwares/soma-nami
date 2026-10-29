import type { PhraseId } from '../speech/phrases';
import { unionBox, type LabelLine } from './ocrLines';
import { lineGroups } from './scope';

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
 * Prescriber abbreviations don't appear on printed retail packs, so they
 * trip the check on a page of any length, unless OCR was unsure of the line
 * and the line is nothing but the abbreviation: that is noise from artwork
 * or a logo ("od", "stat"), and it must not send a clear label to Not sure.
 * On a short page they trip it in any case. The "1x3" and "7/7" patterns also
 * match printed pack counts ("3 x 10 tablets"), so they only count on short pages.
 */
const DOSE_WORDS = /\b(bd|bid|tds|tid|qds|qid|od|nocte|mane|prn|stat)\b/i;
const SHORTHAND_ALONE = /^\W*(bd|bid|tds|tid|qds|qid|od|nocte|mane|prn|stat)\W*$/i;
const DOSE_PATTERNS = /(\b\S{1,2}\s*[x×]\s*\d+\b)|(\b\d+\s*\/\s*7\b)/i;

/**
 * A page with prescriber shorthand, or a short page with a dose pattern or a
 * number on it, is treated as a handwritten dose label: the app won't read
 * it and sends the user to the pharmacist. A two-line printed scrap like
 * "100 Tablets" trips this too, which is the safe side. Handwriting that OCR
 * splits into four or more plain-English lines is not caught here.
 */
export function looksLikeHandwrittenDose(lines: readonly LabelLine[]): boolean {
  if (lines.length === 0) return false;
  if (lines.some((l) => DOSE_WORDS.test(l.text) && !(l.lowConfidence && SHORTHAND_ALONE.test(l.text)))) return true;
  if (lines.length > 3) return false;
  const all = lines.map((l) => l.text).join(' ');
  if (DOSE_WORDS.test(all) || DOSE_PATTERNS.test(all)) return true;
  return lines.length <= 2 && lines.every((l) => l.text.length <= 12) && /\d/.test(all);
}

/**
 * Two lines are in the same block when the vertical gap between them is at
 * most this many line heights (of the taller line) and the horizontal gap at
 * most BLOCK_SIDE_GAP line heights. Label lines sit about one line apart;
 * a menu bar, a keyboard or the next pack on the table sits further away.
 */
export const BLOCK_GAP_LINES = 1.5;
export const BLOCK_SIDE_GAP = 2;

type BoxedLine = LabelLine & { box: NonNullable<LabelLine['box']> };

function near(a: BoxedLine, b: BoxedLine): boolean {
  const h = Math.max(1, a.box.y2 - a.box.y1, b.box.y2 - b.box.y1);
  const vgap = Math.max(a.box.y1, b.box.y1) - Math.min(a.box.y2, b.box.y2);
  const hgap = Math.max(a.box.x1, b.box.x1) - Math.min(a.box.x2, b.box.x2);
  return vgap <= BLOCK_GAP_LINES * h && hgap <= BLOCK_SIDE_GAP * h;
}

/**
 * The label itself: the largest cluster of nearby lines, by text area. Stray
 * text elsewhere in the photo (screen chrome, a keyboard, other packaging
 * touching an edge) is left out, so it can't trigger a framing hint.
 */
export function mainBlock(lines: readonly LabelLine[]): LabelLine[] {
  const boxed = lines.filter((l): l is BoxedLine => l.box !== null);
  const parent = boxed.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  for (let i = 0; i < boxed.length; i++) {
    for (let j = i + 1; j < boxed.length; j++) {
      if (near(boxed[i]!, boxed[j]!)) parent[find(i)] = find(j);
    }
  }
  const area = new Map<number, number>();
  boxed.forEach((l, i) => {
    const root = find(i);
    area.set(root, (area.get(root) ?? 0) + (l.box.x2 - l.box.x1) * (l.box.y2 - l.box.y1));
  });
  let best = -1;
  for (const [root, a] of area) if (best === -1 || a > area.get(best)!) best = root;
  return boxed.filter((_, i) => find(i) === best);
}

/**
 * Where the label sits in the photo decides the spoken hint (docs/ui.md,
 * Aiming). Only the main block of text counts (see mainBlock). Cut off at one
 * edge: move that way. Cut off at opposite edges: move further away. Small
 * and far: move closer.
 */
export function framingHint(allLines: readonly LabelLine[], size: ImageSize): PhraseId | null {
  const lines = mainBlock(allLines);
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

/**
 * The lines that belong to the label: the main block, plus any line set
 * above or below it and in line with it (a big title printed apart from the
 * body, or body text under a title that won the main block on size), added
 * until nothing more joins. Everything else in the photo (another pack, a
 * table, a screen) is dropped: it is not shown, read, asked about or saved.
 * Lines OCR returned without a position are kept, since nothing says where
 * they sit. Printed order is kept.
 */
export function labelLines(lines: readonly LabelLine[]): LabelLine[] {
  const kept = new Set(mainBlock(lines));
  let box = unionBox([...kept].map((l) => l.box));
  if (!box) return [...lines];
  for (let grew = true; grew; ) {
    grew = false;
    const tallest = Math.max(...[...kept].map((l) => (l.box ? l.box.y2 - l.box.y1 : 0)));
    for (const l of lines) {
      if (kept.has(l) || !l.box || !box) continue;
      const h = Math.max(1, l.box.y2 - l.box.y1, tallest);
      const overlap = Math.min(l.box.x2, box.x2) - Math.max(l.box.x1, box.x1);
      const vgap = Math.max(l.box.y1, box.y1) - Math.min(l.box.y2, box.y2);
      if (overlap >= 0.5 * (l.box.x2 - l.box.x1) && vgap <= TITLE_GAP_LINES * h) {
        kept.add(l);
        box = unionBox([box, l.box]);
        grew = true;
      }
    }
  }
  return lines.filter((l) => !l.box || kept.has(l));
}

/**
 * A line in line with the label's block, at most this many line heights above
 * or below it (the taller of its own lines and the block's), still belongs to
 * the label.
 */
export const TITLE_GAP_LINES = 3;

/** A label with at least this many readable lines that are read aloud is a good read (see unreadableShare). */
export const GOOD_LABEL_LINES = 3;

/**
 * The share of the label's lines that couldn't be read. On a good read (at
 * least GOOD_LABEL_LINES readable lines that are spoken), unreadable lines
 * that go to More details (reader/scope.ts: scraps with no word or number in
 * them, such as artwork, and batch codes) are left out, so they can't tip a
 * clear label into Not sure. Otherwise every line counts, as before.
 */
export function unreadableShare(lines: readonly LabelLine[]): number {
  if (lines.length === 0) return 0;
  const groups = lineGroups(lines);
  const readable = lines.filter((l, i) => !l.lowConfidence && groups[i] !== 'detail').length;
  const counted = readable >= GOOD_LABEL_LINES ? lines.filter((l, i) => !(l.lowConfidence && groups[i] === 'detail')) : lines;
  return counted.filter((l) => l.lowConfidence).length / counted.length;
}

/**
 * Decides what happens to a photo once OCR has returned its lines. The lines
 * it hands on are the label's only (labelLines). The handwriting check looks
 * at every line, so a dose note beside the label can't slip through.
 */
export function assessPhoto(allLines: LabelLine[], size: ImageSize): Assessment {
  if (allLines.length === 0) return { kind: 'hint', hint: 'hint_no_text', lines: allLines };
  const lines = labelLines(allLines);

  if (looksLikeHandwrittenDose(allLines)) return { kind: 'not-sure', reason: 'handwritten-dose', lines };

  if (unreadableShare(lines) > MAX_UNREADABLE_SHARE) {
    return { kind: 'not-sure', reason: 'mostly-unreadable', lines };
  }

  const hint = framingHint(lines, size);
  if (hint) return { kind: 'hint', hint, lines };
  return { kind: 'read', lines };
}
