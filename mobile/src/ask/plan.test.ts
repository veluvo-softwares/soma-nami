import { answerQuestion, type Answer } from './answer';
import { buildAnswerPlan } from './plan';
import { toLines } from '../reader/ocrLines';
import { PHRASES } from '../speech/phrases';

const lines = toLines(
  ['Paracetamol Tablets BP 500 mg', 'Take 2 tablets 3 times a day with food', 'Meza vidonge 2 mara 3 kwa siku', 'Exp: 08/2028'].map(
    (text, i) => ({ text, confidence: 0.95, bbox: [10, 20 + i * 40, 400, 50 + i * 40] as [number, number, number, number] }),
  ),
);

describe('buildAnswerPlan', () => {
  it('repeats the question, says "Lebo inasema", then reads the quoted line exactly as printed', () => {
    const plan = buildAnswerPlan(answerQuestion('times_a_day', lines.slice(0, 2)));
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'q_times_a_day' },
      { kind: 'clip', phrase: 'label_says' },
      { kind: 'tts', text: 'Take 2 tablets 3 times a day with food', line: 1 },
    ]);
  });

  it('a refusal is two clips and no label text', () => {
    const plan = buildAnswerPlan(answerQuestion('time_of_day', lines.slice(0, 2)));
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'q_time_of_day' },
      { kind: 'clip', phrase: 'ask_not_stated' },
    ]);
  });

  it('a Swahili line is on the screen, not synthesised', () => {
    const plan = buildAnswerPlan(answerQuestion('how_many', [lines[0]!, lines[2]!]));
    expect(plan.some((s) => s.kind === 'tts')).toBe(false);
    expect(plan).toContainEqual({ kind: 'clip', phrase: 'line_swahili', line: 1 });
  });

  it('every spoken number is in the source line', () => {
    const a = answerQuestion('how_many', lines.slice(0, 2)) as Extract<Answer, { kind: 'answer' }>;
    const spoken = buildAnswerPlan(a).flatMap((s) => (s.kind === 'tts' ? [s.text] : []));
    expect(spoken).toEqual([a.quotes[0]!.text]);
  });

  it('every phrase it uses exists', () => {
    for (const q of ['time_of_day', 'how_many', 'expiry', 'what_is_it'] as const) {
      for (const s of buildAnswerPlan(answerQuestion(q, lines))) {
        if (s.kind === 'clip') expect(PHRASES[s.phrase]).toBeDefined();
      }
    }
  });
});
