// Re-score saved Q&A runs with the current gates, without re-running a model.
//   node score_qa.mjs out/qa_QWEN3_1_7B_INST_Q4.json [...]
import { readFileSync, writeFileSync } from 'node:fs';
import { scoreCase, summarise } from './lib/qa_score.mjs';

for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, 'utf8'));
  for (const r of d.results) r.score = scoreCase(r);
  d.summary = summarise(d.results);
  writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
  console.log(f, JSON.stringify(d.summary));
}
