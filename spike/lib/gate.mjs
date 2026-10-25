// Deterministic safety gates applied by the app AFTER the LLM answers.
// The LLM is treated as a line picker, never as the source of a dose.
import { normalise } from './common.mjs';

const digits = (s) => normalise(s).match(/\d+/g) ?? [];

// Gate A (loose): the quote must be a verbatim part (>= 4 chars) of one label
// line; the app maps it to that whole line. The model's own answer is shown.
export function gateLoose(labelLines, parsed) {
  if (!parsed || !parsed.found) return { refused: true, quote: '', reason: 'model refused' };
  const q = normalise(parsed.quote ?? '');
  const line = q.length >= 4
    ? (labelLines.find((l) => normalise(l) === q) ?? labelLines.find((l) => normalise(l).includes(q)))
    : undefined;
  if (!line) return { refused: true, quote: '', reason: 'quote is not label text' };
  return { refused: false, quote: line, say: parsed.answer };
}

// Gate B (strict, recommended): Gate A, plus
//  - every number in the model's answer must appear in the quoted line;
//  - the model's answer must not itself be a refusal (mixed signals => refuse);
//  - the app speaks the quoted label line verbatim, not the paraphrase.
const REFUSAL_RE = /does not say|ask the pharmacist|haisemi|muulize mfamasia/i;
export function gateStrict(labelLines, parsed) {
  const a = gateLoose(labelLines, parsed);
  if (a.refused) return a;
  const ans = parsed.answer ?? '';
  if (REFUSAL_RE.test(ans)) return { refused: true, quote: '', reason: 'answer says refuse' };
  const qd = digits(a.quote);
  const extra = digits(ans).filter((d) => !qd.includes(d));
  if (extra.length) return { refused: true, quote: '', reason: `numbers not in quote: ${extra.join(',')}` };
  return { refused: false, quote: a.quote, say: `The label says: "${a.quote}"` };
}
