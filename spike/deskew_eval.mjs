// C4f: does deskewing a tilted photo help OCR, and what does it cost?
// For each data/print/*_hard.jpg: OCR the original, estimate the tilt with
// deskew.py (a projection profile, no OCR pass), OCR the straightened copy,
// and compare time, page CER and the "not sure" gate. Same OCR settings as the
// app (canvasSize 1024, recognizerBatchSize 1). Usage:
//   node deskew_eval.mjs [filter...]   -> results/deskew_eval.json
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, unloadModel, ocr, close, OCR_LATIN, OCR_CRAFT } from '@qvac/sdk';
import { cer, round, writeJson } from './lib/common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const truth = JSON.parse(readFileSync(join(HERE, 'data/truth.json'), 'utf8')).print;
const FILTER = process.argv.slice(2);
const THRESH = 0.5; // the app's "not sure" gate works on lines below this
const OUT_DIR = process.env.DESKEW_OUT ?? join(HERE, 'out/deskew');
mkdirSync(OUT_DIR, { recursive: true });

function center(b) {
  const pts = Array.isArray(b[0]) ? b : [[b[0], b[1]], [b[2], b[3]]];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: (Math.min(...ys) + Math.max(...ys)) / 2, h: Math.max(...ys) - Math.min(...ys) };
}

function toLines(blocks) {
  const items = blocks.map((b) => ({ ...b, ...center(b.bbox ?? [0, 0, 0, 0]) })).sort((a, b) => a.y - b.y);
  const lines = [];
  for (const it of items) {
    const last = lines.at(-1);
    if (last && Math.abs(it.y - last.y) < Math.max(10, 0.5 * Math.min(it.h || 20, last.h || 20))) {
      last.items.push(it);
      last.y = (last.y * (last.items.length - 1) + it.y) / last.items.length;
    } else lines.push({ y: it.y, h: it.h, items: [it] });
  }
  return lines.map((l) => {
    const its = l.items.sort((a, b) => a.x - b.x);
    return { text: its.map((i) => i.text).join(' '), minConf: Math.min(...its.map((i) => i.confidence ?? 0)) };
  });
}

function score(ref, lines) {
  const exact = ref.filter((r) => lines.some((l) => cer(r, l.text) === 0)).length;
  return {
    pageCer: round(cer(ref.join(' '), lines.map((l) => l.text).join(' ')), 3),
    lineExact: `${exact}/${ref.length}`,
    flagged: lines.length === 0 || lines.some((l) => l.minConf < THRESH),
    lowLines: lines.filter((l) => l.minConf < THRESH).length,
  };
}

const modelId = await loadModel({
  modelSrc: OCR_LATIN,
  modelConfig: {
    langList: ['en'], detectorModelSrc: OCR_CRAFT, magRatio: 1.5, canvasSize: 1024, recognizerBatchSize: 1,
    defaultRotationAngles: [], contrastRetry: false, lowConfidenceThreshold: 0.4,
    nThreads: Number(process.env.THREADS ?? 1),
  },
});

async function read(path) {
  const t0 = Date.now();
  const blocks = await ocr({ modelId, image: path, options: { paragraph: false } }).blocks;
  const ms = Date.now() - t0;
  return { ms, blocks: blocks.length, lines: toLines(blocks) };
}

const dir = join(HERE, 'data/print');
const results = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith('_hard.jpg')).sort()) {
  if (FILTER.length && !FILTER.some((p) => f.includes(p))) continue;
  const id = Object.keys(truth).find((k) => f.startsWith(k));
  const src = join(dir, f);
  const out = join(OUT_DIR, f);
  const [angle, estMs] = execFileSync('python3', [join(HERE, 'deskew.py'), src, out]).toString().trim().split(' ');
  const a = await read(src);
  const b = await read(out);
  const r = {
    file: f, angleDeg: Number(angle), estimateMs: parseInt(estMs),
    original: { ms: a.ms, blocks: a.blocks, ...score(truth[id], a.lines), text: a.lines.map((l) => l.text) },
    deskewed: { ms: b.ms, blocks: b.blocks, ...score(truth[id], b.lines), text: b.lines.map((l) => l.text) },
  };
  results.push(r);
  console.log(`${f}: angle ${angle}° (est ${estMs}); original ${a.ms} ms CER ${r.original.pageCer} exact ${r.original.lineExact} flagged ${r.original.flagged}; deskewed ${b.ms} ms CER ${r.deskewed.pageCer} exact ${r.deskewed.lineExact} flagged ${r.deskewed.flagged}`);
}
await unloadModel({ modelId, clearStorage: false });
writeJson(process.env.DESKEW_JSON ?? 'results/deskew_eval.json', results);
await close();
