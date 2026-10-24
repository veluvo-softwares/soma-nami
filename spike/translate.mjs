// C2 spike: TranslatePsy-AfriSLM for "tafsiri" (English -> Swahili) and, as a
// second test, whether the same model can answer label questions grounded in
// the label text. Run from spike/:  node translate.mjs [0.8b|2b]
// Writes results/translate-<size>.json. Peak RSS of this Node process does not
// include the QVAC worker; we sample the worker separately with ps.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import {
  loadModel,
  unloadModel,
  translate,
  completion,
  close,
  TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M,
  TRANSLATEPSY_AFRISLM_2B_TRANSLATION_Q4_K_M,
} from '@qvac/sdk';
import { checkTranslation } from './numbers.mjs';

const size = process.argv[2] ?? '0.8b';
const MODEL = size === '2b' ? TRANSLATEPSY_AFRISLM_2B_TRANSLATION_Q4_K_M : TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M;
const lines = JSON.parse(readFileSync(new URL('./fixtures/label-lines.json', import.meta.url)));
const qa = JSON.parse(readFileSync(new URL('./fixtures/qa-cases.json', import.meta.url)));

let peakKb = 0;
const sample = () => {
  try {
    const out = execSync("ps -eo rss,args | grep -i -E 'bare|qvac|worker' | grep -v grep | awk '{s+=$1} END {print s+0}'").toString();
    peakKb = Math.max(peakKb, Number(out.trim()) || 0);
  } catch { /* ps unavailable */ }
};
const sampler = setInterval(sample, 250);

const t0 = Date.now();
const modelId = await loadModel({
  modelSrc: MODEL,
  modelConfig: { ctx_size: 2048 },
  onProgress: (p) => process.stderr.write(`download ${p.percentage.toFixed(0)}%\r`),
});
const loadS = (Date.now() - t0) / 1000;
console.log(`loaded ${size} in ${loadS}s`);

const translations = [];
for (const src of lines) {
  const t = Date.now();
  const r = translate({ modelId, text: src, from: 'en', to: 'sw', modelType: 'llamacpp-completion', stream: false });
  const out = (await r.text).trim();
  const check = checkTranslation(src, out);
  translations.push({ src, out, ms: Date.now() - t, ...check });
  console.log(`${check.safe ? 'OK  ' : 'FAIL'} ${src}\n     -> ${out}`);
}

const SYSTEM =
  'Wewe ni msomaji wa lebo za dawa. Jibu kwa Kiswahili, kwa sentensi moja, ukitumia LEBO pekee. ' +
  'Nakili mstari wa lebo uliotumia ndani ya alama za nukuu. ' +
  'Kama lebo haisemi jibu, jibu hasa: "Lebo haisemi. Muulize mfamasia." Usikisie kamwe.';
const answers = [];
for (const c of qa) {
  const t = Date.now();
  const run = completion({
    modelId,
    history: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `LEBO:\n${c.label}\n\nSWALI: ${c.question}` },
    ],
    stream: false,
    generationParams: { temp: 0, predict: 160 },
  });
  const final = await run.final;
  const out = final.contentText.trim();
  answers.push({ ...c, out, ms: Date.now() - t });
  console.log(`Q: ${c.question} [expect ${c.expect}]\nA: ${out}\n`);
}

clearInterval(sampler);
sample();
await unloadModel({ modelId, clearStorage: false });
mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
const summary = {
  model: MODEL.name,
  loadSeconds: loadS,
  workerPeakRssMb: Math.round(peakKb / 1024),
  translationsSafe: translations.filter((x) => x.safe).length,
  translationsTotal: translations.length,
  meanTranslateMs: Math.round(translations.reduce((a, x) => a + x.ms, 0) / translations.length),
};
writeFileSync(new URL(`./results/translate-${size}.json`, import.meta.url), JSON.stringify({ summary, translations, answers }, null, 2));
console.log(JSON.stringify(summary, null, 2));
await close();
process.exit(0);
