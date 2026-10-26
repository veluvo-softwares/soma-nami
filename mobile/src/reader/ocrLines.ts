import { spokenParts } from './details';
import { detectLineLanguage, type LineLanguage } from './language';

/** One OCR text block as returned by QVAC `ocr()`: bbox is [x1, y1, x2, y2] in image pixels. */
export interface OcrBlock {
  text: string;
  bbox?: [number, number, number, number];
  confidence?: number;
}

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A visual line of the label, built from one or more OCR blocks. */
export interface LabelLine {
  /** Exactly what OCR read, blocks joined left to right with one space. */
  text: string;
  /** The lowest block confidence on the line (0..1). */
  minConfidence: number;
  /**
   * True when the line must not be read out (below LOW_CONFIDENCE). Judged on
   * the blocks that are actually spoken: a batch code that is cut out of the
   * line (reader/details.ts) can't make the rest of the line unsure.
   */
  lowConfidence: boolean;
  language: LineLanguage;
  box: Box | null;
}

/**
 * A line whose weakest block is below this is never read out: it is marked
 * and spoken as "I couldn't read this line". 0.5 is the C2 spike's gate; on
 * printed packs it let through only batch-code errors, never a dose line.
 */
export const LOW_CONFIDENCE = 0.5;

function boxOf(b: OcrBlock): Box | null {
  if (!b.bbox) return null;
  const [x1, y1, x2, y2] = b.bbox;
  return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) };
}

export function unionBox(boxes: readonly (Box | null)[]): Box | null {
  let out: Box | null = null;
  for (const b of boxes) {
    if (!b) continue;
    out = out
      ? { x1: Math.min(out.x1, b.x1), y1: Math.min(out.y1, b.y1), x2: Math.max(out.x2, b.x2), y2: Math.max(out.y2, b.y2) }
      : { ...b };
  }
  return out;
}

interface Item {
  block: OcrBlock;
  box: Box | null;
  cy: number;
  h: number;
  x: number;
  order: number;
}

/**
 * Groups OCR blocks into visual lines: blocks whose vertical centres are
 * within half a line height of each other share a line, then each line is
 * ordered left to right. Same rule as the C2 spike (`spike/ocr.mjs`). Blocks
 * without a bbox keep OCR's own order, one per line.
 */
export function toLines(blocks: readonly OcrBlock[], threshold = LOW_CONFIDENCE): LabelLine[] {
  const items: Item[] = blocks
    .filter((b) => b.text.trim().length > 0)
    .map((block, order) => {
      const box = boxOf(block);
      return {
        block,
        box,
        cy: box ? (box.y1 + box.y2) / 2 : Number.NaN,
        h: box ? box.y2 - box.y1 : 0,
        x: box ? box.x1 : 0,
        order,
      };
    });

  const withBox = items.filter((i) => i.box).sort((a, b) => a.cy - b.cy || a.x - b.x);
  const groups: { cy: number; h: number; items: Item[] }[] = [];
  for (const it of withBox) {
    const last = groups[groups.length - 1];
    const tolerance = Math.max(4, 0.5 * Math.min(it.h || 20, last?.h || 20));
    if (last && Math.abs(it.cy - last.cy) < tolerance) {
      last.items.push(it);
      last.cy = (last.cy * (last.items.length - 1) + it.cy) / last.items.length;
    } else {
      groups.push({ cy: it.cy, h: it.h, items: [it] });
    }
  }
  const noBox = items.filter((i) => !i.box).map((it) => ({ cy: Number.POSITIVE_INFINITY, h: 0, items: [it] }));

  return [...groups, ...noBox].map((g) => {
    const its = [...g.items].sort((a, b) => a.x - b.x || a.order - b.order);
    const text = its.map((i) => i.block.text.trim()).join(' ');
    const confidences = its.map((i) => i.block.confidence ?? 0);
    const minConfidence = Math.min(...confidences);
    // Where each block sits in `text` (blocks are joined with one space).
    let at = 0;
    const parts = its.map((i): [number, number] => {
      const len = i.block.text.trim().length;
      const part: [number, number] = [at, at + len];
      at += len + 1;
      return part;
    });
    const spoken = spokenParts(text, parts);
    // A line with nothing left to speak (a pure batch line) is judged on all its blocks, as before.
    const judged = spoken.some(Boolean) ? confidences.filter((_, k) => spoken[k]) : confidences;
    return {
      text,
      minConfidence,
      lowConfidence: Math.min(...judged) < threshold,
      language: detectLineLanguage(text),
      box: unionBox(its.map((i) => i.box)),
    };
  });
}
