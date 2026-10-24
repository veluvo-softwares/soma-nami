// Swahili ASR spike: Whisper base vs small (Q8_0) through QVAC transcribe().
//   node asr.mjs WHISPER_BASE_Q8_0
//   node asr.mjs WHISPER_SMALL_Q8_0
// Clips: data/asr/clips.json -> [{ file, ref, source }]. Prepared by
// prepare_asr.sh (FLEURS sw_ke dev, CC-BY-4.0) plus our own synthetic
// Chatterbox Swahili WAVs from tts.mjs. Writes out/asr_<model>.json.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from '@qvac/sdk';
import { MemSampler, timed, timedCpu, round, writeJson, wer, cer } from './lib/common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const modelName = process.argv[2] ?? 'WHISPER_BASE_Q8_0';
const clips = JSON.parse(readFileSync(join(HERE, 'data/asr/clips.json'), 'utf8'))
  .filter((c) => existsSync(join(HERE, c.file)));

const wavSeconds = (path) => {
  const b = readFileSync(path);
  const rate = b.readUInt32LE(24), bits = b.readUInt16LE(34), ch = b.readUInt16LE(22);
  let off = 12;
  while (off < b.length - 8) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'data') return size / (rate * ch * bits / 8);
    off += 8 + size;
  }
  return 0;
};

const mem = new MemSampler().start();
const { value: modelId, ms: loadMs } = await timed(() => sdk.loadModel({
  modelSrc: sdk[modelName],
  modelConfig: {
    n_threads: Number(process.env.THREADS ?? 1), // sandbox cgroup allows 1 CPU
    language: 'sw', translate: false, strategy: 'greedy', temperature: 0.0,
    no_timestamps: true, suppress_blank: true, suppress_nst: true,
    contextParams: { use_gpu: false },
  },
}));
console.log(`${modelName} loaded in ${loadMs} ms`);

const results = [];
for (const c of clips) {
  const path = join(HERE, c.file);
  const audioS = wavSeconds(path);
  const { value: segs, ms, cpuS } = await timedCpu(mem, () => sdk.transcribe({ modelId, audioChunk: path }));
  const hyp = (Array.isArray(segs) ? segs.map((s) => (typeof s === 'string' ? s : s.text)).join('') : String(segs)).trim();
  const r = { ...c, hyp, wer: round(wer(c.ref, hyp), 3), cer: round(cer(c.ref, hyp), 3), ms, cpuS, audioS: round(audioS, 2), rtf: round(ms / 1000 / audioS, 2) };
  results.push(r);
  console.log(`${c.source} ${c.file}: WER ${r.wer} CER ${r.cer} (${ms} ms, ${audioS.toFixed(1)} s audio)\n  ref: ${c.ref}\n  hyp: ${hyp}`);
}
await sdk.unloadModel({ modelId, clearStorage: false });
const m = mem.stop();
const agg = (rs) => rs.length ? {
  clips: rs.length,
  meanWer: round(rs.reduce((a, r) => a + r.wer, 0) / rs.length, 3),
  meanCer: round(rs.reduce((a, r) => a + r.cer, 0) / rs.length, 3),
  meanRtf: round(rs.reduce((a, r) => a + r.rtf, 0) / rs.length, 2),
  cpuSPerAudioS: round(rs.reduce((a, r) => a + r.cpuS, 0) / rs.reduce((a, r) => a + r.audioS, 0), 2),
} : null;
const summary = { fleurs: agg(results.filter((r) => r.source === 'fleurs')), synthetic: agg(results.filter((r) => r.source === 'synthetic')) };
writeJson(join(HERE, `out/asr_${modelName}.json`), { model: modelName, loadMs, peakRssMb: m.peakMb, baselineRssMb: m.baselineMb, cpuS: m.cpuS, summary, results });
console.log(JSON.stringify({ model: modelName, loadMs, mem: m, summary }, null, 2));
await sdk.close?.();
process.exit(0);
