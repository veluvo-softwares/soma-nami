// Print markdown tables from out/*.json for docs/spike-report.md, and copy the
// compact result files into results/ (committed). Usage: node report_tables.mjs
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f) => (existsSync(join(HERE, 'out', f)) ? JSON.parse(readFileSync(join(HERE, 'out', f), 'utf8')) : null);
const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
const gb = (mb) => (mb == null ? 'n/a' : `${(mb / 1024).toFixed(2)} GB`);
mkdirSync(join(HERE, 'results'), { recursive: true });
const keep = (name, obj) => obj && writeFileSync(join(HERE, 'results', name), JSON.stringify(obj, null, 2) + '\n');

// ---- OCR
for (const f of ['ocr.json', 'ocr_lowmem.json']) {
  const o = load(f);
  if (!o) continue;
  console.log(`\n### OCR (${f}): load ${(o.loadMs / 1000).toFixed(1)} s, peak RSS ${gb(o.peakRssMb)}, gate threshold ${o.threshold}\n`);
  console.log('| Set | Images | Mean page CER | Lines exact | Number recall | Mean conf | Flagged | Wrong lines | Wrong but confident | CPU-s / image |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [k, s] of Object.entries(o.summary)) {
    console.log(`| ${k} | ${s.images} | ${s.meanPageCer} | ${pct(s.lineExactRate)} | ${pct(s.numberRecall)} | ${s.meanConf} | ${pct(s.flaggedRate)} | ${s.wrongLines} | ${s.wrongButConfident} | ${s.meanCpuS} |`);
  }
  console.log('\nHandwriting reads:\n');
  console.log('| File | Truth | Read | Min conf | Flagged |');
  console.log('|---|---|---|---:|---|');
  const truth = JSON.parse(readFileSync(join(HERE, 'data/truth.json'), 'utf8')).hand;
  for (const r of o.results.filter((x) => x.set === 'hand')) {
    const id = Object.keys(truth).find((k) => r.file.startsWith(k));
    console.log(`| ${r.file} | ${truth[id].join(' / ')} | ${r.text.join(' / ') || '(nothing)'} | ${r.minConf} | ${r.flagged ? 'yes' : '**no**'} |`);
  }
  keep(f, { ...o, results: o.results.map(({ perLine, ...rest }) => ({ ...rest, perLine })) });
}

// ---- OCR memory configs (3 images each)
console.log('\n### OCR memory\n');
console.log('| Run | magRatio | canvasSize | batch | RSS after load | Peak RSS | Lines exact | CPU-s / image |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const f of ['ocr_mem_default.json', 'ocr_mem_c1280_b8.json', 'ocr_mem_m1_b8.json', 'ocr_mem_c1024_b1.json']) {
  const o = load(f);
  if (!o) continue;
  const lines = o.results.flatMap((r) => r.perLine);
  const cpu = o.results.reduce((a, r) => a + r.cpuS, 0) / o.results.length;
  console.log(`| ${f} | ${o.config.magRatio} | ${o.config.canvasSize} | ${o.config.recognizerBatchSize} | ${gb(o.peakAfterLoadMb)} | ${gb(o.peakRssMb)} | ${lines.filter((l) => l.exact).length}/${lines.length} | ${cpu.toFixed(1)} |`);
  keep(f, o);
}

const v = load('ocr_vlm.json');
if (v) {
  console.log(`\n### LightOnOCR-2: load ${(v.loadMs / 1000).toFixed(1)} s, peak RSS ${gb(v.peakRssMb)}\n`);
  console.log('| File | CER | CPU-s | Read |');
  console.log('|---|---:|---:|---|');
  for (const r of v.results) console.log(`| ${r.file} | ${r.pageCer} | ${r.cpuS} | ${r.text.replace(/\s+/g, ' ').slice(0, 80)} |`);
  console.log(JSON.stringify(v.summary));
  keep('ocr_vlm.json', v);
}

// ---- TTS
console.log('\n### TTS\n');
console.log('| Engine | Threads | Text | Audio s | Wall s | CPU-s | CPU-RTF | Peak RSS |');
console.log('|---|---:|---|---:|---:|---:|---:|---:|');
for (const f of ['tts_supertonic_t4.json', 'tts_supertonic.json', 'tts_chatterbox.json', 'tts_chatterbox_cfm1.json']) {
  const t = load(f);
  if (!t) continue;
  for (const r of t.runs) {
    console.log(`| ${t.engine}${f.includes('cfm1') ? ' (cfm 1)' : ''} | ${t.modelConfig.threads} | ${r.text.slice(0, 50)}${r.text.length > 50 ? '…' : ''} | ${r.audioS} | ${(r.ms / 1000).toFixed(1)} | ${r.cpuS ?? 'n/a'} | ${r.cpuRtf ?? 'n/a'} | ${gb(t.peakRssMb)} |`);
  }
  keep(f, t);
}

// ---- QA
console.log('\n### Grounded Q&A\n');
console.log('| Model | Prompt | Valid JSON | Raw answer / refusal | Strict gate answer / refusal | Unsafe (strict) | Over-refused (strict) | CPU-s / question | Peak RSS |');
console.log('|---|---|---:|---|---|---:|---:|---:|---:|');
for (const m of ['QWEN3_600M_INST_Q4', 'QWEN3_1_7B_INST_Q4']) {
  for (const t of ['', '_v2', '_v3']) {
    const q = load(`qa_${m}${t}.json`);
    if (!q) continue;
    const s = q.summary;
    console.log(`| ${m} | ${q.prompt ?? 'v1'} | ${pct(s.validJson)} | ${pct(s.raw.answerAcc)} / ${pct(s.raw.refusalAcc)} | ${pct(s.strict.answerAcc)} / ${pct(s.strict.refusalAcc)} | ${s.strict.unsafe} | ${s.strict.overRefused} | ${s.meanCpuS} | ${gb(q.peakRssMb)} |`);
    keep(`qa_${m}${t}.json`, q);
  }
}

// ---- ASR
console.log('\n### ASR\n');
console.log('| Model | Set | Clips | Mean WER | Mean CER | CPU-s per audio-s | Peak RSS |');
console.log('|---|---|---:|---:|---:|---:|---:|');
for (const m of ['WHISPER_BASE_Q8_0', 'WHISPER_SMALL_Q8_0']) {
  const a = load(`asr_${m}.json`);
  if (!a) continue;
  for (const [k, s] of Object.entries(a.summary)) if (s) console.log(`| ${m} | ${k} | ${s.clips} | ${s.meanWer} | ${s.meanCer} | ${s.cpuSPerAudioS} | ${gb(a.peakRssMb)} |`);
  keep(`asr_${m}.json`, a);
}

// ---- hold-to-talk question matching
console.log('\n### Hold-to-talk\n');
console.log('| Model | Set | Clips | Right | Reject | Wrong | Mean ms |');
console.log('|---|---|---:|---:|---:|---:|---:|');
for (const m of ['WHISPER_BASE_Q8_0', 'WHISPER_SMALL_Q8_0']) {
  const a = load(`asrq_${m}.json`);
  if (!a) continue;
  for (const [k, s] of Object.entries(a.summary)) console.log(`| ${m} | ${k} | ${s.clips} | ${s.right} | ${s.reject} | ${s.wrong} | ${s.meanMs} |`);
  console.log(`peak RSS ${gb(a.peakRssMb)}, loads ${JSON.stringify(a.loads)}`);
  keep(`asrq_${m}.json`, a);
}
for (const f of ['tts_chatterbox_q_sw.json', 'tts_supertonic_q_en_f1.json']) keep(f, load(f));
