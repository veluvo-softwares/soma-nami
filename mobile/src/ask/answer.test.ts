import { answerQuestion, numbersIn, type Answer } from './answer';
import { QUESTIONS, type QuestionId } from './questions';
import { toLines, type LabelLine } from '../reader/ocrLines';

/** Synthetic label lines; `~` before a line marks it as low confidence. */
function label(...rows: string[]): LabelLine[] {
  return toLines(
    rows.map((r, i) => ({
      text: r.replace(/^~/, ''),
      confidence: r.startsWith('~') ? 0.3 : 0.95,
      bbox: [10, 20 + i * 40, 400, 50 + i * 40] as [number, number, number, number],
    })),
  );
}

const CLEAN = label(
  'Paracetamol Tablets BP 500 mg',
  'Each tablet contains 500 mg paracetamol',
  'Take 2 tablets 3 times a day with food',
  'Do not take more than 8 tablets in 24 hours',
  'Exp: 08/2028',
);

const quotes = (a: Answer) => (a.kind === 'answer' ? a.quotes.map((q) => q.text) : []);

describe('answers come from the label line, quoted exactly', () => {
  it('how many: quotes the dose line, not the strength line', () => {
    const a = answerQuestion('how_many', CLEAN);
    expect(quotes(a)).toEqual(['Take 2 tablets 3 times a day with food']);
  });

  it('how often and with food quote the same printed line', () => {
    expect(quotes(answerQuestion('times_a_day', CLEAN))).toEqual(['Take 2 tablets 3 times a day with food']);
    expect(quotes(answerQuestion('with_food', CLEAN))).toEqual(['Take 2 tablets 3 times a day with food']);
  });

  it('what is it quotes the name line', () => {
    expect(quotes(answerQuestion('what_is_it', CLEAN))).toEqual(['Paracetamol Tablets BP 500 mg']);
  });

  it('expiry quotes the expiry line, and the batch code is not read out', () => {
    const lines = label('Ibuprofen Tablets 200 mg', 'Batch No: PX2417 Exp: 08/2028');
    const a = answerQuestion('expiry', lines);
    expect(a.kind === 'answer' && a.quotes[0]).toMatchObject({
      text: 'Batch No: PX2417 Exp: 08/2028',
      spoken: 'Exp: 08/2028',
    });
  });

  it('time of day quotes a line that names one, and does not turn "3 times" into hours', () => {
    expect(answerQuestion('time_of_day', CLEAN)).toMatchObject({ kind: 'refuse', reason: 'not-stated' });
    const lines = label('Amoxicillin Capsules 250 mg', 'Take 1 capsule in the morning and 1 at night');
    expect(quotes(answerQuestion('time_of_day', lines))).toEqual(['Take 1 capsule in the morning and 1 at night']);
  });

  it('read again hands back to the reading screen', () => {
    expect(answerQuestion('read_again', CLEAN)).toEqual({ kind: 'read-again' });
  });

  it('quotes a Swahili line as printed and marks its language', () => {
    const lines = label('Paracetamol Tablets 500 mg', 'Meza vidonge 2 mara 3 kwa siku');
    const a = answerQuestion('how_many', lines);
    expect(a.kind === 'answer' && a.quotes[0]).toMatchObject({ text: 'Meza vidonge 2 mara 3 kwa siku', language: 'sw' });
  });
});

describe('every number in an answer matches the source text exactly', () => {
  const labels: LabelLine[][] = [
    CLEAN,
    label('Metformin Tablets BP 500 mg', 'Take 1 tablet twice daily after meals', 'Exp 03/2029'),
    label('Oral Rehydration Salts', 'Dissolve 1 sachet in 1 litre of water', 'Take 200 ml after each loose stool', 'EXP 11/2027'),
    label('Cough Syrup 100 ml', 'Adults: 10 ml every 8 hours', 'Store below 25°C. Exp 12.2027'),
    label('Doxycycline Capsules 100 mg', 'Take 1 capsule at 8:30 am and 1 capsule at 8:30 pm', 'Exp 01/2030'),
  ];
  const ids = QUESTIONS.map((q) => q.id);

  it.each(labels.map((l, i) => [i, l] as const))('label %i', (_i, lines) => {
    let answered = 0;
    for (const id of ids) {
      const a = answerQuestion(id, lines);
      if (a.kind !== 'answer') continue;
      answered++;
      for (const q of a.quotes) {
        // The quote is the OCR line verbatim, and what is read aloud is a piece of it.
        expect(lines[q.index]!.text).toBe(q.text);
        const src = numbersIn(q.text);
        const spoken = numbersIn(q.spoken);
        expect(spoken.every((n) => src.includes(n))).toBe(true);
        for (const n of numbersIn(q.text)) expect(lines.some((l) => l.text.includes(n))).toBe(true);
      }
    }
    expect(answered).toBeGreaterThanOrEqual(2);
  });

  it('does not compute: 2 tablets x 3 a day is never turned into 6', () => {
    const a = answerQuestion('how_many', CLEAN);
    expect(JSON.stringify(a)).not.toMatch(/\b6\b/);
    const all = ids.flatMap((id) => quotes(answerQuestion(id, CLEAN)).join(' '));
    expect(numbersIn(all.join(' ')).every((n) => CLEAN.some((l) => l.text.includes(n)))).toBe(true);
  });
});

describe('refusals', () => {
  const refusal = (id: QuestionId, lines: LabelLine[]) => {
    const a = answerQuestion(id, lines);
    return a.kind === 'refuse' ? a.reason : a.kind;
  };

  it('the label does not say -> not-stated, for each question it can leave out', () => {
    const bare = label('Paracetamol Tablets BP 500 mg', 'Keep out of reach of children');
    expect(refusal('how_many', bare)).toBe('not-stated');
    expect(refusal('times_a_day', bare)).toBe('not-stated');
    expect(refusal('time_of_day', bare)).toBe('not-stated');
    expect(refusal('with_food', bare)).toBe('not-stated');
    expect(refusal('expiry', bare)).toBe('not-stated');
    expect(refusal('what_is_it', label('Keep out of reach of children', 'Store in a cool place'))).toBe('not-stated');
  });

  it('a strength line is not a dose', () => {
    expect(refusal('how_many', label('Paracetamol Tablets BP 500 mg', 'Each tablet contains 500 mg paracetamol'))).toBe(
      'not-stated',
    );
  });

  it('the line that would answer is unreadable -> unsure, and its text is never returned', () => {
    const lines = label('Paracetamol Tablets BP 500 mg', '~Take 4 tablets 3 times a day', 'Exp: 08/2028', 'Keep dry');
    const a = answerQuestion('how_many', lines);
    expect(a).toEqual({ kind: 'refuse', question: 'how_many', reason: 'unsure' });
    expect(JSON.stringify(a)).not.toContain('Take 4');
  });

  it('a dose question with nothing found but an unreadable line -> unsure, not "the label does not say"', () => {
    const lines = label('Paracetamol Tablets BP 500 mg', '~Tab 4 tds', 'Exp: 08/2028', 'Keep dry', 'Keep cool');
    expect(refusal('times_a_day', lines)).toBe('unsure');
    expect(refusal('how_many', lines)).toBe('unsure');
    expect(refusal('time_of_day', lines)).toBe('unsure');
  });

  it('a non-dose question with nothing found but an unreadable line stays not-stated', () => {
    const lines = label('Paracetamol Tablets BP 500 mg', '~Smudge', 'Keep dry', 'Keep cool');
    expect(refusal('with_food', lines)).toBe('not-stated');
  });

  it('most of the label unreadable -> unsure for everything, even a clear expiry line', () => {
    const lines = label('~Parace', '~Take 2', '~times', 'Exp: 08/2028');
    for (const q of QUESTIONS.filter((q) => q.id !== 'read_again')) expect(refusal(q.id, lines)).toBe('unsure');
  });

  it('no text at all -> unsure', () => {
    expect(refusal('how_many', [])).toBe('unsure');
  });

  it('the label says two different amounts -> conflict', () => {
    const lines = label('Paracetamol Tablets 500 mg', 'Take 1 tablet', 'Take 2 tablets', 'Exp 08/2028');
    expect(refusal('how_many', lines)).toBe('conflict');
  });

  it('two different expiry dates -> conflict', () => {
    expect(refusal('expiry', label('Exp 08/2028', 'Exp 09/2027', 'Paracetamol Tablets'))).toBe('conflict');
  });

  it('the same line printed twice is one answer', () => {
    const lines = label('Paracetamol Tablets 500 mg', 'Take 2 tablets', 'Take 2 tablets', 'Keep dry');
    expect(quotes(answerQuestion('how_many', lines))).toEqual(['Take 2 tablets']);
  });

  it('a refusal never carries label text', () => {
    const bare = label('Paracetamol Tablets BP 500 mg', 'Keep dry');
    expect(answerQuestion('with_food', bare)).toEqual({ kind: 'refuse', question: 'with_food', reason: 'not-stated' });
  });
});

// Card D (30 Oct): the Paracetamol label from the iPhone 12, build 3. OCR read "1to 2",
// "houn", and the storage line was unreadable.
describe('card D: the Paracetamol label from the phone', () => {
  const PARA = () =>
    toLines(
      (
        [
          ['PARACETAMOL', 0.95, 60],
          ['Tablets BP 500 mg', 0.95, 30],
          ['100 Tablets', 0.95, 30],
          ['Dosage: Adults and children over 12 years:', 0.95, 30],
          ['1to 2 tablets every 4 to 6 hours', 0.95, 30],
          ['Do not take more than 8 tablets in 24 houn', 0.95, 30],
          ['Store below 30C. Keep out of reach of children.', 0.3, 30],
          ['Batch No: PX2417 Exp: 08/2028', 0.95, 30],
        ] as const
      ).map(([text, confidence, h], i) => ({
        text,
        confidence,
        bbox: [10, i * 70, 400, i * 70 + h] as [number, number, number, number],
      })),
    );

  it('"Ni dawa gani?" answers the name line first, then the strength', () => {
    expect(quotes(answerQuestion('what_is_it', PARA()))).toEqual(['PARACETAMOL', 'Tablets BP 500 mg']);
  });

  it('"1 to 2 tablets every 4 to 6 hours" is one dose answer: the range, the "Dosage:" heading and the pack size are no conflict', () => {
    expect(quotes(answerQuestion('how_many', PARA()))).toEqual(['1to 2 tablets every 4 to 6 hours']);
  });

  it('the maximum is a warning, never the dose', () => {
    const lines = label('Ibuprofen Tablets 200 mg', 'Do not take more than 8 tablets in 24 hours');
    expect(answerQuestion('how_many', lines)).toMatchObject({ kind: 'refuse', reason: 'not-stated' });
  });

  it.each(['1 to 2 tablets', '1-2 tablets', '1to 2 tablets', '1 – 2 tablets'])('a range "%s" is one instruction', (range) => {
    const lines = label('Ibuprofen Tablets 200 mg', `Take ${range} every 6 hours`);
    expect(quotes(answerQuestion('how_many', lines))).toEqual([`Take ${range} every 6 hours`]);
  });

  it('an interval answers both "how often" and "what time"', () => {
    expect(quotes(answerQuestion('times_a_day', PARA()))).toEqual(['1to 2 tablets every 4 to 6 hours']);
    expect(quotes(answerQuestion('time_of_day', PARA()))).toEqual(['1to 2 tablets every 4 to 6 hours']);
  });

  it('an unreadable storage line does not block a dose answer, or turn "not stated" into "unsure"', () => {
    const lines = label('Ibuprofen Tablets 200 mg', 'Take 1 tablet daily', '~Store below 30C. Keep dry', 'Batch No: AB123');
    expect(quotes(answerQuestion('how_many', lines))).toEqual(['Take 1 tablet daily']);
    expect(answerQuestion('time_of_day', lines)).toMatchObject({ kind: 'refuse', reason: 'not-stated' });
  });

  it('an unreadable line among the dosing lines still blocks, since it could be the answer', () => {
    const lines = label('Ibuprofen Tablets 200 mg', 'Dosage: Adults and children', '~Tke 2 tbs evry 8 hrs', 'Exp: 08/2028');
    expect(answerQuestion('times_a_day', lines)).toMatchObject({ kind: 'refuse', reason: 'unsure' });
  });

  it('two different doses (adults and children) are still a conflict', () => {
    const lines = label('Syrup 100 mg/5 ml', 'Adults: take 10 ml', 'Children: take 5 ml');
    expect(answerQuestion('how_many', lines)).toMatchObject({ kind: 'refuse', reason: 'conflict' });
  });
});
