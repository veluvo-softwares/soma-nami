// Grounded Q&A spike: Qwen3 1.7B vs 0.6B answering only from label text.
//   node qa.mjs QWEN3_1_7B_INST_Q4
//   node qa.mjs QWEN3_600M_INST_Q4
// The model must return JSON {"found": bool, "quote": "<exact label line>",
// "answer": "..."} (enforced with a JSON-schema grammar). The app then applies
// deterministic gates (lib/gate.mjs). We score the raw model, the loose gate
// and the strict gate. Writes out/qa_<model>[_<TAG>].json.
// Env: THREADS (default 1), PROMPT=v1|v2|v3, TAG.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from '@qvac/sdk';
import { MemSampler, timed, timedCpu, writeJson } from './lib/common.mjs';
import { LABELS, CASES } from './lib/qa_data.mjs';
import { scoreCase, summarise } from './lib/qa_score.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const modelName = process.argv[2] ?? 'QWEN3_600M_INST_Q4';
const PROMPT = process.env.PROMPT ?? 'v1';
const tag = process.env.TAG ? `_${process.env.TAG}` : '';

const SYSTEMS = {
  v1: [
    'You help an older person understand the text printed on a medicine label.',
    'Rules:',
    '1. Use ONLY the label text given. Never use outside knowledge, never guess, never give medical advice.',
    '2. If one label line answers the question, set found=true, copy that line EXACTLY into "quote", and give a short answer in the language of the question that only restates that line.',
    '3. If the label does not clearly answer the question, set found=false, quote="", and answer exactly: "The label does not say. Please ask the pharmacist." (in Swahili: "Lebo haisemi. Tafadhali muulize mfamasia.").',
    '4. Never change a number from the label.',
    '/no_think',
  ].join('\n'),
  // v2: numbered lines, the model picks a line; more refusal examples.
  v2: [
    'You read a medicine label for an older person. The label lines are numbered.',
    'Find the ONE line that directly answers the question.',
    '- If such a line exists: found=true, quote = that line copied exactly, answer = that line restated briefly.',
    '- If no line directly answers it: found=false, quote="", answer="The label does not say. Please ask the pharmacist."',
    'The label is silent about: alcohol, pregnancy, breastfeeding, allergies, side effects, other medicines, missed doses, food, and doses for children or babies, UNLESS a line explicitly mentions them.',
    'A line about something else is NOT an answer. Never use your own medical knowledge. Never change a number.',
    '/no_think',
  ].join('\n'),
  // v3: pure line picker. The grammar only allows a line number (0 = none),
  // so the model cannot write any text at all; the app speaks the line.
  v3: [
    'You read a medicine label for an older person. The label lines are numbered.',
    'Reply with the number of the ONE line that directly answers the question, or 0 if no line directly answers it.',
    'The label is silent about: alcohol, pregnancy, breastfeeding, allergies, side effects, other medicines, missed doses, food, and doses for children or babies, UNLESS a line explicitly mentions them.',
    'A line about something else is NOT an answer: reply 0. Never use your own medical knowledge.',
    '/no_think',
  ].join('\n'),
};

const SCHEMA = {
  type: 'object',
  properties: { found: { type: 'boolean' }, quote: { type: 'string' }, answer: { type: 'string' } },
  required: ['found', 'quote', 'answer'],
  additionalProperties: false,
};
const pickerSchema = (n) => ({
  type: 'object',
  properties: { line: { type: 'integer', enum: Array.from({ length: n + 1 }, (_, i) => i) } },
  required: ['line'],
  additionalProperties: false,
});

const userMsg = (label, q) => {
  const lines = LABELS[label];
  const body = PROMPT === 'v1' ? lines.join('\n') : lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
  return `LABEL TEXT:\n"""\n${body}\n"""\n\nQUESTION: ${q}`;
};

const mem = new MemSampler().start();
const { value: modelId, ms: loadMs } = await timed(() => sdk.loadModel({
  modelSrc: sdk[modelName],
  // threads: see tts.mjs; the sandbox cgroup allows 1 CPU
  modelConfig: { ctx_size: 2048, temp: 0, seed: 1, predict: 200, device: 'cpu', reasoning_budget: 0, threads: Number(process.env.THREADS ?? 1) },
}));
console.log(`${modelName} loaded in ${loadMs} ms (prompt ${PROMPT})`);

const results = [];
for (const c of CASES) {
  const history = [{ role: 'system', content: SYSTEMS[PROMPT] }, { role: 'user', content: userMsg(c.label, c.q) }];
  const schema = PROMPT === 'v3' ? pickerSchema(LABELS[c.label].length) : SCHEMA;
  const { value: raw, ms, cpuS } = await timedCpu(mem, async () => {
    const run = sdk.completion({ modelId, history, stream: true, responseFormat: { type: 'json_schema', json_schema: { name: 'label_answer', schema, strict: true } } });
    for await (const _ of run.events) { /* drain */ }
    const final = await run.final;
    return { text: final.contentText, stats: final.stats };
  });
  let parsed = null;
  try { parsed = JSON.parse(raw.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()); } catch { /* invalid */ }
  if (parsed && PROMPT === 'v3') {
    // map the picked line back to the {found, quote, answer} shape the gates use
    const line = LABELS[c.label][parsed.line - 1];
    parsed = line ? { found: true, quote: line, answer: line, line: parsed.line } : { found: false, quote: '', answer: '', line: 0 };
  }
  const r = { ...c, ms, cpuS, raw: raw.text, parsed, stats: raw.stats };
  r.score = scoreCase(r);
  results.push(r);
  const s = r.score;
  console.log(`[${c.expect}] ${c.q} -> ${raw.text.replace(/\s+/g, ' ').slice(0, 220)} | raw ${s.rawCorrect} loose ${s.loose.correct} strict ${s.strict.correct}${s.strict.unsafe ? ' UNSAFE' : ''} (${ms} ms)`);
}
await sdk.unloadModel({ modelId, clearStorage: false });
const m = mem.stop();
const summary = summarise(results);
writeJson(join(HERE, `out/qa_${modelName}${tag}.json`), { model: modelName, prompt: PROMPT, loadMs, peakRssMb: m.peakMb, baselineRssMb: m.baselineMb, cpuS: m.cpuS, summary, results });
console.log(JSON.stringify({ model: modelName, prompt: PROMPT, loadMs, mem: m, summary }, null, 2));
await sdk.close?.();
process.exit(0);
