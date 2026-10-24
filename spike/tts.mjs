// C2 spike: read-aloud. Swahili with Chatterbox multilingual Q4 (the go/no-go)
// and English with Supertonic 3 Q4. Run from spike/:  node tts.mjs [sw|en|both]
// Writes results/tts-<lang>-<n>.wav and results/tts-<lang>.json with load
// time, synthesis time, audio length (real-time factor) and worker peak RSS.
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import {
  loadModel,
  unloadModel,
  textToSpeech,
  close,
  TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0,
  TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0,
  TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
} from '@qvac/sdk';

const which = process.argv[2] ?? 'both';
const RESULTS = new URL('./results/', import.meta.url);
mkdirSync(RESULTS, { recursive: true });

// Short app phrases first (these are what the app says most), then label-style lines.
const SW = [
  'Gusa popote kusoma.',
  'Sogeza kushoto kidogo.',
  'Sijaweza kusoma vizuri. Sitakisia dozi. Muulize mfamasia au daktari.',
  'Lebo haisemi. Muulize mfamasia.',
  'Chukua kidonge kimoja mara mbili kwa siku baada ya chakula.',
  'Paracetamol miligramu mia tano. Chukua vidonge viwili kila baada ya saa nane.',
];
const EN = [
  'Paracetamol 500 mg tablets. Take 2 tablets every 8 hours.',
  'Do not take more than 8 tablets in 24 hours.',
  'Amlodipine 5 mg. Take 1 tablet at night.',
];

function wav(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] ?? 0))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

let peakKb = 0;
const sample = () => {
  try {
    const out = execSync("ps -eo rss,args | grep -i -E 'bare|qvac|worker' | grep -v grep | awk '{s+=$1} END {print s+0}'").toString();
    peakKb = Math.max(peakKb, Number(out.trim()) || 0);
  } catch { /* ignore */ }
};

async function run(lang, modelSrc, modelConfig, lines, fallbackRate) {
  peakKb = 0;
  const sampler = setInterval(sample, 250);
  const t0 = Date.now();
  const modelId = await loadModel({ modelSrc, modelConfig, onProgress: (p) => process.stderr.write(`download ${p.percentage.toFixed(0)}%\r`) });
  const loadSeconds = (Date.now() - t0) / 1000;
  console.log(`[${lang}] loaded in ${loadSeconds}s`);
  const items = [];
  for (const [i, text] of lines.entries()) {
    const t = Date.now();
    const r = textToSpeech({ modelId, text, inputType: 'text', stream: false });
    const buf = await r.buffer;
    const rate = (await r.sampleRate) ?? fallbackRate;
    const synthSeconds = (Date.now() - t) / 1000;
    const audioSeconds = buf.length / rate;
    const file = `tts-${lang}-${i + 1}.wav`;
    writeFileSync(new URL(file, RESULTS), wav(buf, rate));
    items.push({ text, file, synthSeconds, audioSeconds: +audioSeconds.toFixed(2), rtf: +(synthSeconds / audioSeconds).toFixed(2) });
    console.log(`[${lang}] ${synthSeconds}s for ${audioSeconds.toFixed(1)}s audio: ${text}`);
  }
  clearInterval(sampler);
  sample();
  await unloadModel({ modelId, clearStorage: false });
  const summary = { lang, model: modelSrc.name, loadSeconds, workerPeakRssMb: Math.round(peakKb / 1024), items };
  writeFileSync(new URL(`tts-${lang}.json`, RESULTS), JSON.stringify(summary, null, 2));
  return summary;
}

if (which === 'sw' || which === 'both') {
  await run('sw', TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0,
    { ttsEngine: 'chatterbox', language: 'sw', s3genModelSrc: TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0, cfmSteps: 1, threads: 4 },
    SW, 24000);
}
if (which === 'en' || which === 'both') {
  await run('en', TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
    { ttsEngine: 'supertonic', language: 'en', voice: 'F1', ttsSpeed: 1.0, ttsNumInferenceSteps: 5 },
    EN, 44100);
}
await close();
process.exit(0);
