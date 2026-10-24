// Hard-case OCR spike: LightOnOCR-2 (1B, Q4_K_M + F16 mmproj) vision LLM.
// Runs on the handwriting set and the "hard" printed photos.
//   node ocr_vlm.mjs [filter ...]     writes out/ocr_vlm.json
// Licence: lightonai/LightOnOCR-2-1B-ocr-soup is Apache-2.0 (checked on HF).
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from '@qvac/sdk';
import { MemSampler, timed, timedCpu, cer, round, writeJson } from './lib/common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const truth = JSON.parse(readFileSync(join(HERE, 'data/truth.json'), 'utf8'));
const FILTER = process.argv.slice(2).length ? process.argv.slice(2) : ['hand/', '_hard.jpg'];
const PROMPT = process.env.VLM_PROMPT ?? 'Transcribe all text in this image exactly as written.';

const mem = new MemSampler().start();
const { value: modelId, ms: loadMs } = await timed(() => sdk.loadModel({
  modelSrc: sdk.OCR_0_6B_MULTIMODAL_Q4_K_M,
  modelConfig: { ctx_size: 4096, temp: 0, predict: 256, device: 'cpu', threads: Number(process.env.THREADS ?? 1), projectionModelSrc: sdk.MMPROJ_OCR_0_6B_MULTIMODAL_F16 },
}));
console.log(`LightOnOCR loaded in ${loadMs} ms`);

const results = [];
for (const set of ['print', 'hand']) {
  const dir = join(HERE, 'data', set);
  for (const f of readdirSync(dir).sort()) {
    const id = Object.keys(truth[set]).find((k) => f.startsWith(k));
    if (!id || !FILTER.some((p) => `${set}/${f}`.includes(p))) continue;
    const { value: text, ms, cpuS } = await timedCpu(mem, async () => {
      const run = sdk.completion({ modelId, stream: true, history: [{ role: 'user', content: PROMPT, attachments: [{ path: join(dir, f) }] }] });
      for await (const _ of run.events) { /* drain */ }
      return (await run.final).contentText;
    });
    const ref = truth[set][id].join(' ');
    const r = { set, file: f, ms, cpuS, text: text.trim(), pageCer: round(cer(ref, text), 3) };
    results.push(r);
    console.log(`${set}/${f}: CER ${r.pageCer} (${ms} ms, ${cpuS} cpu-s) -> ${JSON.stringify(r.text.slice(0, 160))}`);
  }
}
await sdk.unloadModel({ modelId, clearStorage: false });
const m = mem.stop();
const hand = results.filter((r) => r.set === 'hand');
const summary = {
  handImages: hand.length,
  handMeanCer: hand.length ? round(hand.reduce((a, r) => a + r.pageCer, 0) / hand.length, 3) : null,
  handExact: hand.filter((r) => r.pageCer === 0).length,
  meanMs: Math.round(results.reduce((a, r) => a + r.ms, 0) / (results.length || 1)),
  meanCpuS: round(results.reduce((a, r) => a + r.cpuS, 0) / (results.length || 1), 1),
};
writeJson(join(HERE, 'out/ocr_vlm.json'), { loadMs, peakRssMb: m.peakMb, baselineRssMb: m.baselineMb, cpuS: m.cpuS, summary, results });
console.log(JSON.stringify({ loadMs, mem: m, summary }, null, 2));
await sdk.close?.();
process.exit(0);
