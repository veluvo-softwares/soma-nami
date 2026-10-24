// TTS spike. One engine per process so peak RSS is clean.
//   node tts.mjs supertonic      English, Supertonic 3 Q4
//   node tts.mjs chatterbox      Swahili, Chatterbox multilingual Q4 (T3 + S3Gen)
// Writes out/tts/<engine>_<n>.wav and out/tts_<engine>.json.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadModel, unloadModel, textToSpeech, close,
  TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
  TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0, TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0,
} from '@qvac/sdk';
import { MemSampler, timed, timedCpu, round, writeJson, writeWav } from './lib/common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const engine = process.argv[2] ?? 'supertonic';
// The sandbox cgroup allows 1 CPU; more ggml threads than that spin and get
// throttled, so default to 1. Set THREADS on a real multi-core machine.
const threads = Number(process.env.THREADS ?? 1);
const tag = process.env.TAG ? `_${process.env.TAG}` : '';

const SETUPS = {
  supertonic: {
    modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
    modelConfig: { ttsEngine: 'supertonic', language: 'en', voice: process.env.VOICE ?? 'F1', ttsSpeed: 0.95, threads },
    fallbackRate: 44100,
    texts: [
      'Paracetamol tablets, 500 milligrams.',
      'Take one capsule three times a day for 7 days, or as directed by the prescriber.',
      'Dosage: adults and children over 12 years: 1 to 2 tablets every 4 to 6 hours. Do not take more than 8 tablets in 24 hours.',
      'I am not sure I read this correctly. Please ask the pharmacist.',
    ],
  },
  chatterbox: {
    modelSrc: TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0,
    modelConfig: {
      ttsEngine: 'chatterbox', language: 'sw',
      s3genModelSrc: TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0,
      cfmSteps: Number(process.env.CFM_STEPS ?? 2), threads, seed: 7,
    },
    fallbackRate: 24000,
    texts: [
      'Chumvi ya kurejesha maji mwilini.',
      'Yeyusha pakiti moja katika lita moja ya maji safi. Tumia ndani ya saa ishirini na nne.',
      'Meza kidonge kimoja mara tatu kwa siku, kwa siku saba.',
      'Sina uhakika nimesoma vizuri. Tafadhali muulize mfamasia.',
      // digits left as digits, to hear how the engine reads numbers
      'Tumia ndani ya saa 24.',
    ],
  },
};

const setup = SETUPS[engine];
if (!setup) { console.error(`unknown engine ${engine}`); process.exit(1); }

// TEXTS_FILE: JSON array of strings to speak instead of the built-in list.
// LIMIT: speak only the first N texts. OUT_DIR: where WAVs go (default out/tts).
const texts = (process.env.TEXTS_FILE ? JSON.parse(readFileSync(process.env.TEXTS_FILE, 'utf8')) : setup.texts)
  .slice(0, Number(process.env.LIMIT ?? Infinity));
const outDir = process.env.OUT_DIR ?? 'out/tts';

const mem = new MemSampler().start();
const { value: modelId, ms: loadMs } = await timed(() => loadModel({ modelSrc: setup.modelSrc, modelConfig: setup.modelConfig }));
console.log(`${engine} loaded in ${loadMs} ms`);
const runs = [];
for (const [i, text] of texts.entries()) {
  const { value, ms, cpuS } = await timedCpu(mem, async () => {
    const r = textToSpeech({ modelId, text, inputType: 'text', stream: false });
    const buf = await r.buffer;
    const rate = (await r.sampleRate) ?? setup.fallbackRate;
    return { buf, rate };
  });
  const audioS = value.buf.length / value.rate;
  const file = `${outDir}/${engine}${tag}_${i + 1}.wav`;
  writeWav(join(HERE, file), value.buf, value.rate);
  // rtf = wall time / audio length; cpuRtf = CPU seconds / audio length (not
  // inflated by sandbox throttling; divide by usable cores for a device guess)
  const run = { text, ms, cpuS, audioS: round(audioS, 2), rtf: round(ms / 1000 / audioS, 2), cpuRtf: round(cpuS / audioS, 2), sampleRate: value.rate, file };
  runs.push(run);
  console.log(JSON.stringify(run));
}
await unloadModel({ modelId, clearStorage: false });
const m = mem.stop();
const out = { engine, modelConfig: { ...setup.modelConfig, s3genModelSrc: undefined }, loadMs, cpuS: m.cpuS, peakRssMb: m.peakMb, baselineRssMb: m.baselineMb, procs: m.procs, runs };
writeJson(join(HERE, `out/tts_${engine}${tag}.json`), out);
console.log(`peak RSS ${m.peakMb} MB (baseline ${m.baselineMb} MB)`);
await close?.();
process.exit(0);
