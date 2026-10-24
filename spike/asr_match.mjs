// Hold-to-talk spike for C5: can Whisper pick the right question from a FIXED
// list? We don't need a perfect transcript, only the right list entry, and a
// safe "didn't catch that" when unsure.
//   node asr_match.mjs texts                 write the TTS text lists
//   node asr_match.mjs WHISPER_BASE_Q8_0     run one model (sw + en clips)
// Clips: data/asr/q/<lang>_<n>_<variant>.wav, made by prepare_questions.sh
// (synthetic TTS voices, plus slowed and noisy copies). Questions:
// data/questions.json. Writes out/asrq_<model>.json.
//
// Matching: normalise, drop spaces (Whisper splits Swahili words oddly), then
// similarity = 1 - edit distance / longer length against every question in the
// clip's language. Accept the best only if sim >= MIN_SIM and it beats the
// runner-up by MIN_MARGIN; otherwise the app says "Sikukusikia vizuri, jaribu
// tena" (reject). A reject is safe; a wrong match is the failure that matters.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemSampler, timed, timedCpu, round, writeJson, normalise, levenshtein } from './lib/common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const Q = JSON.parse(readFileSync(join(HERE, 'data/questions.json'), 'utf8'));
const MIN_SIM = Number(process.env.MIN_SIM ?? 0.5);
const MIN_MARGIN = Number(process.env.MIN_MARGIN ?? 0.15);
const arg = process.argv[2] ?? 'WHISPER_BASE_Q8_0';

if (arg === 'texts') {
  mkdirSync(join(HERE, 'data/asr/q'), { recursive: true });
  for (const lang of ['sw', 'en']) {
    writeFileSync(join(HERE, `data/asr/q/${lang}_texts.json`), JSON.stringify(Q[lang].map((q) => q.text)) + '\n');
    writeFileSync(join(HERE, `data/asr/q/${lang}_neg_texts.json`), JSON.stringify(Q[`${lang}_neg`]) + '\n');
  }
  console.log('wrote data/asr/q/{sw,en}{,_neg}_texts.json');
  process.exit(0);
}
if (arg === 'count') { console.log(Q.sw.length); process.exit(0); }

const squash = (s) => [...normalise(s).replace(/\s+/g, '')];
const sim = (a, b) => {
  const x = squash(a), y = squash(b);
  const n = Math.max(x.length, y.length);
  return n ? 1 - levenshtein(x, y) / n : 0;
};
export function match(lang, hyp) {
  const scored = Q[lang].map((q) => ({ id: q.id, sim: round(sim(q.text, hyp), 3) })).sort((a, b) => b.sim - a.sim);
  const [best, second] = scored;
  const accepted = best.sim >= MIN_SIM && best.sim - (second?.sim ?? 0) >= MIN_MARGIN;
  return { pick: accepted ? best.id : null, best, second };
}

const sdk = await import('@qvac/sdk');
const dir = join(HERE, 'data/asr/q');
const clips = readdirSync(dir).filter((f) => /^(sw|en)_\d+_\w+\.wav$/.test(f)).sort();
const mem = new MemSampler().start();
const results = [];
const loads = {};
for (const lang of ['sw', 'en']) {
  const mine = clips.filter((f) => f.startsWith(`${lang}_`));
  if (!mine.length) continue;
  const { value: modelId, ms: loadMs } = await timed(() => sdk.loadModel({
    modelSrc: sdk[arg],
    modelConfig: {
      n_threads: Number(process.env.THREADS ?? 1), // sandbox cgroup allows 1 CPU
      language: lang, translate: false, strategy: 'greedy', temperature: 0.0,
      no_timestamps: true, suppress_blank: true, suppress_nst: true,
      contextParams: { use_gpu: false },
    },
  }));
  loads[lang] = loadMs;
  console.log(`${arg} (${lang}) loaded in ${loadMs} ms`);
  const listPrompt = Q[lang].map((q) => q.text).join(' ');
  for (const f of mine) {
    const [, n, variant] = f.match(/^\w+_(\d+)_(\w+)\.wav$/);
    const truth = Q[lang][Number(n) - 1]?.id ?? null; // null = out-of-list, must reject
    for (const mode of ['plain', 'prompted']) {
      const { value: segs, ms, cpuS } = await timedCpu(mem, () => sdk.transcribe({
        modelId, audioChunk: join(dir, f), ...(mode === 'prompted' ? { prompt: listPrompt } : {}),
      }));
      const hyp = (Array.isArray(segs) ? segs.map((s) => (typeof s === 'string' ? s : s.text)).join('') : String(segs)).trim();
      const m = match(lang, hyp);
      const outcome = truth === null
        ? (m.pick === null ? 'rejected_neg' : 'WRONG_neg')
        : (m.pick === null ? 'reject' : m.pick === truth ? 'right' : 'WRONG');
      results.push({ lang, file: f, variant, mode, truth, hyp, ...m, outcome, ms, cpuS });
      console.log(`${lang} ${f} ${mode}: ${outcome} (best ${m.best.id} ${m.best.sim}, 2nd ${m.second.id} ${m.second.sim}) ${ms} ms | ${hyp}`);
    }
  }
  await sdk.unloadModel({ modelId, clearStorage: false });
}
const m = mem.stop();
const summary = {};
for (const r of results) {
  const neg = r.truth === null ? '_neg' : '';
  for (const k of [`${r.lang}${neg}_${r.mode}`, `${r.lang}${neg}_${r.mode}_${r.variant}`]) {
    const s = (summary[k] ??= { clips: 0, right: 0, reject: 0, wrong: 0, msSum: 0 });
    s.clips++; s.msSum += r.ms;
    // for out-of-list clips a reject is the right outcome
    if (r.outcome === 'right' || r.outcome === 'rejected_neg') s.right++;
    else if (r.outcome === 'reject') s.reject++;
    else s.wrong++;
  }
}
for (const s of Object.values(summary)) { s.meanMs = Math.round(s.msSum / s.clips); delete s.msSum; }
writeJson(join(HERE, `out/asrq_${arg}.json`), { model: arg, minSim: MIN_SIM, minMargin: MIN_MARGIN, loads, peakRssMb: m.peakMb, cpuS: m.cpuS, summary, results });
console.log(JSON.stringify({ model: arg, loads, mem: m, summary }, null, 2));
await sdk.close?.();
process.exit(0);
