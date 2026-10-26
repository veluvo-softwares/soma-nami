// Handwriting spike, reader A runs: EasyOCR (OCR_LATIN + OCR_CRAFT) with the
// phone config (canvasSize 1024, batch 1) over a directory of images.
//   node ocr_reads.mjs data/hand orig
//   node ocr_reads.mjs data/hand_var/crop crop
// Writes results/hand_reads_<variant>.json: { file: [lines...] } plus per-line min confidence.
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, unloadModel, ocr, close, OCR_LATIN, OCR_CRAFT } from '@qvac/sdk';
import { MemSampler, timedCpu, round, writeJson } from './lib/common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const [dir, variant] = process.argv.slice(2);
if (!dir || !variant) throw new Error('usage: node ocr_reads.mjs <dir> <variant>');

function box(b) {
  if (!b) return { x: 0, y: 0, h: 0 };
  if (Array.isArray(b[0])) {
    const xs = b.map((p) => p[0]), ys = b.map((p) => p[1]);
    return { x: Math.min(...xs), y: (Math.min(...ys) + Math.max(...ys)) / 2, h: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: b[0], y: (b[1] + b[3]) / 2, h: b[3] - b[1] };
}
function toLines(blocks) {
  const items = blocks.map((b) => ({ ...b, ...box(b.bbox) })).sort((a, b) => a.y - b.y);
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

const mem = new MemSampler().start();
const modelId = await loadModel({
  modelSrc: OCR_LATIN,
  modelConfig: { langList: ['en'], detectorModelSrc: OCR_CRAFT, magRatio: 1.5, canvasSize: 1024, recognizerBatchSize: 1, defaultRotationAngles: [], contrastRetry: false, lowConfidenceThreshold: 0.4, nThreads: Number(process.env.THREADS ?? 1) },
});
const reads = {};
for (const f of readdirSync(join(HERE, dir)).filter((x) => /\.(jpg|png)$/.test(x)).sort()) {
  const { value: blocks, ms, cpuS } = await timedCpu(mem, () => ocr({ modelId, image: join(HERE, dir, f), options: { paragraph: false } }).blocks);
  const lines = toLines(blocks);
  reads[f] = { lines: lines.map((l) => l.text), minConf: lines.map((l) => round(l.minConf, 3)), ms, cpuS };
  console.log(`${variant}/${f}: ${ms} ms ${JSON.stringify(reads[f].lines)}`);
}
await unloadModel({ modelId, clearStorage: false });
const m = mem.stop();
writeJson(join(HERE, `results/hand_reads_${variant}.json`), { variant, config: { canvasSize: 1024, recognizerBatchSize: 1, magRatio: 1.5 }, peakRssMb: m.peakMb, reads });
await close?.();
process.exit(0);
