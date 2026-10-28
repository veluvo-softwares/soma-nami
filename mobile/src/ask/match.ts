import { QUESTIONS, type QuestionId } from './questions';

/**
 * Picks the list question that Whisper's rough Swahili transcript was meant
 * to be, or none. Settings are the ones that scored 0 wrong matches in 288
 * spike attempts (docs/spike-report.md §5, spike/asr_match.mjs): drop the
 * spaces (Whisper splits Swahili words oddly), similarity = 1 - edit distance
 * / longer length, accept the best question only if it reaches MIN_SIM and
 * beats the runner-up by MIN_MARGIN. A reject is safe; a wrong match is not.
 */
export const MIN_SIM = 0.5;
export const MIN_MARGIN = 0.15;

/** Topics the label never answers. Whatever the matcher thinks, they get the pharmacist. */
const OFF_LIST_TOPICS =
  /\b(pombe|ulevi|mtoto|watoto|mtoo|mimba|mjamzito|ujauzito|nyonyesh\w*|mzio|sahau\w*|alcohol|beer|wine|child|children|kid|kids|baby|babies|pregnan\w*|breastfe\w*|allerg\w*|forgot|miss(ed)?)\b/;

export type MatchResult =
  | { kind: 'match'; id: QuestionId; sim: number; margin: number }
  | { kind: 'topic' }
  | { kind: 'none'; best: { id: QuestionId; sim: number } | null };

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function squash(s: string): string[] {
  return [...normalise(s).replace(/\s+/g, '')];
}

export function levenshtein(a: readonly string[], b: readonly string[]): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

export function similarity(a: string, b: string): number {
  const x = squash(a);
  const y = squash(b);
  const n = Math.max(x.length, y.length);
  return n === 0 ? 0 : 1 - levenshtein(x, y) / n;
}

export function matchQuestion(transcript: string): MatchResult {
  const heard = normalise(transcript);
  if (heard === '') return { kind: 'none', best: null };
  if (OFF_LIST_TOPICS.test(heard)) return { kind: 'topic' };

  const scored = QUESTIONS.map((q) => ({
    id: q.id,
    sim: Math.max(...q.variants.map((v) => similarity(v, heard))),
  })).sort((a, b) => b.sim - a.sim);
  const best = scored[0]!;
  const margin = best.sim - (scored[1]?.sim ?? 0);
  if (best.sim >= MIN_SIM && margin >= MIN_MARGIN) {
    return { kind: 'match', id: best.id, sim: best.sim, margin };
  }
  return { kind: 'none', best };
}
