// Handwriting spike: combine readers through the dose grammar and score.
//   node eval_hand.mjs            prints markdown tables, writes results/hand_dose_eval.json
// Inputs: out/hand_reads_{orig,crop,bin}.json (ocr_reads.mjs, EasyOCR canvas 1024)
//         results/hand_reads_B_lightonocr.json (hand subset of the C2 ocr_vlm run)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDose, doseKey, agree } from './dose_grammar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const truth = JSON.parse(readFileSync(join(HERE, 'data/truth.json'), 'utf8')).hand;
const load = (p) => JSON.parse(readFileSync(join(HERE, p), 'utf8'));
const A = {};
for (const v of ['orig', 'crop', 'bin']) A[v] = load(`out/hand_reads_${v}.json`).reads;
const Bsrc = load('results/hand_reads_B_lightonocr.json').reads;
const B = Object.fromEntries(Object.entries(Bsrc).map(([f, r]) => [f, r.text]));

const files = Object.keys(A.orig).sort();
const truthKey = (f) => doseKey(parseDose(truth[Object.keys(truth).find((k) => f.startsWith(k))]));
for (const f of files) if (!truthKey(f)) throw new Error(`truth for ${f} does not parse`);

const readers = {
  A: (f) => A.orig[f].lines,
  Acrop: (f) => A.crop[f].lines,
  Abin: (f) => A.bin[f].lines,
  B: (f) => B[f],
};
const combos = {
  'A + B (EasyOCR + LightOnOCR-2)': ['A', 'B'],
  'A + A-crop (EasyOCR, two crops)': ['A', 'Acrop'],
  'A + A-bin (EasyOCR, original + binarised)': ['A', 'Abin'],
  'A-crop + A-bin': ['Acrop', 'Abin'],
  'A + A-crop + A-bin (all three agree)': ['A', 'Acrop', 'Abin'],
};
const singles = { 'A alone': ['A'], 'B alone': ['B'], 'A-crop alone': ['Acrop'], 'A-bin alone': ['Abin'] };

const fmt = (r) => JSON.stringify(Array.isArray(r) ? r.join(' / ') : r).replace(/\|/g, '\\|');
const out = { files: {}, totals: {} };
function run(name, rs) {
  let spoken = 0, wrong = 0;
  const rows = [];
  for (const f of files) {
    const reads = rs.map((r) => readers[r](f));
    const { speak, parsed } = agree(reads);
    const t = truthKey(f);
    const verdict = speak ? (speak === t ? 'correct' : 'WRONG') : 'not-sure';
    if (speak) { spoken++; if (speak !== t) wrong++; }
    rows.push({ file: f, reads, parsed, speak, truth: t, verdict });
  }
  out.totals[name] = { spoken, wrong, notSure: files.length - spoken, images: files.length };
  out.files[name] = rows;
  return rows;
}
for (const [n, rs] of Object.entries({ ...singles, ...combos })) run(n, rs);

const md = [];
md.push('### Totals (24 synthetic images)\n');
md.push('| Reader setup | Spoken | Spoken and WRONG | Not-sure |');
md.push('|---|---|---|---|');
for (const [n, t] of Object.entries(out.totals)) md.push(`| ${n} | ${t.spoken} | ${t.wrong} | ${t.notSure} |`);
md.push('');
md.push('### Per image: A + B\n');
md.push('| Image | Truth | A (EasyOCR) | B (LightOnOCR-2) | Result | Verdict |');
md.push('|---|---|---|---|---|---|');
for (const r of out.files['A + B (EasyOCR + LightOnOCR-2)']) md.push(`| ${r.file.replace('.jpg', '')} | ${r.truth} | ${fmt(r.reads[0])} | ${fmt(r.reads[1])} | ${r.speak ?? 'not-sure'} | ${r.verdict} |`);
md.push('');
for (const n of ['A + A-crop (EasyOCR, two crops)', 'A + A-bin (EasyOCR, original + binarised)', 'A + A-crop + A-bin (all three agree)']) {
  md.push(`### Per image: ${n}\n`);
  md.push('| Image | Truth | A | second reader | Result | Verdict |');
  md.push('|---|---|---|---|---|---|');
  for (const r of out.files[n]) md.push(`| ${r.file.replace('.jpg', '')} | ${r.truth} | ${fmt(r.reads[0])} | ${r.reads.slice(1).map(fmt).join(' ; ')} | ${r.speak ?? 'not-sure'} | ${r.verdict} |`);
  md.push('');
}
md.push('### Single readers, what each would have done on its own\n');
md.push('| Image | Truth | ' + Object.keys(singles).join(' | ') + ' |');
md.push('|---|---|' + Object.keys(singles).map(() => '---').join('|') + '|');
for (let i = 0; i < files.length; i++) {
  md.push(`| ${files[i].replace('.jpg', '')} | ${truthKey(files[i])} | ` + Object.keys(singles).map((n) => { const r = out.files[n][i]; return r.speak ? `${r.speak} (${r.verdict})` : 'not-sure'; }).join(' | ') + ' |');
}
writeFileSync(join(HERE, 'results/hand_dose_eval.json'), JSON.stringify(out, null, 2) + '\n');
writeFileSync(join(HERE, 'results/hand_dose_eval.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
