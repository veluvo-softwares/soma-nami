// OCR spike: OCR_LATIN recogniser + OCR_CRAFT detector (EasyOCR pipeline).
// Runs every image in data/print and data/hand, compares against
// data/truth.json and writes out/ocr.json. Usage: node ocr.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, unloadModel, ocr, close, OCR_LATIN, OCR_CRAFT } from '@qvac/sdk';
import { MemSampler, timed, timedCpu, cer, normalise, round, writeJson } from './lib/common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const truth = JSON.parse(readFileSync(join(HERE, 'data/truth.json'), 'utf8'));
const THRESH = Number(process.env.OCR_THRESH ?? 0.5);
// Optional filter: `node ocr.mjs photo hand` runs only files whose path matches.
const FILTER = process.argv.slice(2);
// Contrast and rotation retries on low-confidence boxes (much slower).
const RETRY = process.env.OCR_RETRY === '1';
const OUT = process.env.OCR_OUT ?? 'out/ocr.json';

// bbox may be [x1,y1,x2,y2] or four [x,y] points
function box(b) {
  if (!b) return { x: 0, y: 0, h: 0 };
  if (Array.isArray(b[0])) {
    const xs = b.map((p) => p[0]), ys = b.map((p) => p[1]);
    return { x: Math.min(...xs), y: (Math.min(...ys) + Math.max(...ys)) / 2, h: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: b[0], y: (b[1] + b[3]) / 2, h: b[3] - b[1] };
}

// Group word blocks into visual lines by vertical centre, then sort by x.
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
    const confs = its.map((i) => i.confidence ?? 0);
    return { text: its.map((i) => i.text).join(' '), minConf: Math.min(...confs), meanConf: confs.reduce((a, b) => a + b, 0) / confs.length };
  });
}

const nums = (s) => (normalise(s).match(/\d+/g) ?? []);

function scoreImage(refLines, lines) {
  const page = cer(refLines.join(' '), lines.map((l) => l.text).join(' '));
  const per = refLines.map((ref) => {
    let best = null;
    for (const l of lines) {
      const c = cer(ref, l.text);
      if (!best || c < best.cer) best = { cer: c, hyp: l.text, minConf: l.minConf };
    }
    return { ref, hyp: best?.hyp ?? '', cer: round(best?.cer ?? 1, 3), exact: best?.cer === 0, minConf: round(best?.minConf ?? 0, 3) };
  });
  const refNums = refLines.flatMap(nums);
  const hypNums = lines.flatMap((l) => nums(l.text));
  const pool = [...hypNums];
  let hit = 0;
  for (const n of refNums) { const i = pool.indexOf(n); if (i >= 0) { hit++; pool.splice(i, 1); } }
  return { pageCer: round(page, 3), lineExact: per.filter((p) => p.exact).length, lines: per.length, numberRecall: refNums.length ? round(hit / refNums.length, 3) : null, perLine: per };
}

const mem = new MemSampler().start();
const { value: modelId, ms: loadMs } = await timed(() => loadModel({
  modelSrc: OCR_LATIN,
  modelConfig: {
    langList: ['en'],
    detectorModelSrc: OCR_CRAFT,
    magRatio: Number(process.env.OCR_MAG ?? 1.5),
    // memory knobs (defaults are the SDK's): OCR_CANVAS caps the CRAFT input
    // long side, OCR_BATCH is the recogniser batch size
    ...(process.env.OCR_CANVAS ? { canvasSize: Number(process.env.OCR_CANVAS) } : {}),
    ...(process.env.OCR_BATCH ? { recognizerBatchSize: Number(process.env.OCR_BATCH) } : {}),
    defaultRotationAngles: RETRY ? [90, 270] : [],
    contrastRetry: RETRY,
    lowConfidenceThreshold: 0.4,
    nThreads: Number(process.env.THREADS ?? 1), // sandbox cgroup allows 1 CPU
  },
}));
console.log(`OCR loaded in ${loadMs} ms`);
mem.sample();
const peakAfterLoadMb = round(mem.peak, 1);
console.log(`peak RSS after load ${peakAfterLoadMb} MB`);

const results = [];
for (const set of ['print', 'hand']) {
  const dir = join(HERE, 'data', set);
  for (const f of readdirSync(dir).sort()) {
    const id = Object.keys(truth[set]).find((k) => f.startsWith(k));
    if (!id) continue;
    if (FILTER.length && !FILTER.some((p) => `${set}/${f}`.includes(p))) continue;
    const { value: blocks, ms, cpuS } = await timedCpu(mem, () => ocr({ modelId, image: join(dir, f), options: { paragraph: false } }).blocks);
    const lines = toLines(blocks);
    const s = scoreImage(truth[set][id], lines);
    const confs = blocks.map((b) => b.confidence ?? 0);
    const r = {
      set, file: f, ms, cpuS, blocks: blocks.length,
      meanConf: round(confs.reduce((a, b) => a + b, 0) / (confs.length || 1), 3),
      minConf: round(confs.length ? Math.min(...confs) : 0, 3),
      text: lines.map((l) => l.text),
      ...s,
    };
    // Would the "not sure, ask the pharmacist" gate fire? Any line below THRESH.
    r.flagged = lines.length === 0 || lines.some((l) => l.minConf < THRESH);
    r.peakSoFarMb = round(mem.peak, 1);
    results.push(r);
    console.log(`${set}/${f}: ${ms} ms (${cpuS} cpu-s), pageCER ${r.pageCer}, exact ${r.lineExact}/${r.lines}, nums ${r.numberRecall}, conf mean ${r.meanConf} min ${r.minConf}, flagged ${r.flagged}`);
    if (set === 'hand') console.log(`   read: ${JSON.stringify(r.text)}`);
  }
}
await unloadModel({ modelId, clearStorage: false });
const m = mem.stop();

// Summary per set and per variant (clean / photo / hard / hand)
const groups = {};
for (const r of results) {
  const k = r.set === 'print' ? `print_${r.file.match(/_(clean|photo|hard)\./)[1]}` : 'hand';
  (groups[k] ??= []).push(r);
}
const summary = {};
for (const [k, rs] of Object.entries(groups)) {
  const lines = rs.flatMap((r) => r.perLine);
  summary[k] = {
    images: rs.length,
    meanPageCer: round(rs.reduce((a, r) => a + r.pageCer, 0) / rs.length, 3),
    lineExactRate: round(lines.filter((l) => l.exact).length / lines.length, 3),
    numberRecall: round(rs.reduce((a, r) => a + (r.numberRecall ?? 0), 0) / rs.length, 3),
    meanConf: round(rs.reduce((a, r) => a + r.meanConf, 0) / rs.length, 3),
    flaggedRate: round(rs.filter((r) => r.flagged).length / rs.length, 3),
    meanMs: Math.round(rs.reduce((a, r) => a + r.ms, 0) / rs.length),
    meanCpuS: round(rs.reduce((a, r) => a + r.cpuS, 0) / rs.length, 1),
    // wrong lines that the confidence gate would NOT have caught
    wrongButConfident: lines.filter((l) => !l.exact && l.minConf >= THRESH).length,
    wrongLines: lines.filter((l) => !l.exact).length,
  };
}
const out = { threshold: THRESH, retry: RETRY, config: { magRatio: Number(process.env.OCR_MAG ?? 1.5), canvasSize: process.env.OCR_CANVAS ? Number(process.env.OCR_CANVAS) : 'default (2560)', recognizerBatchSize: process.env.OCR_BATCH ? Number(process.env.OCR_BATCH) : 'default (32)' }, loadMs, peakAfterLoadMb, cpuS: m.cpuS, peakRssMb: m.peakMb, baselineRssMb: m.baselineMb, procs: m.procs, summary, results };
writeJson(join(HERE, OUT), out);
console.log(JSON.stringify({ loadMs, mem: m, summary }, null, 2));
await close?.();
process.exit(0);
