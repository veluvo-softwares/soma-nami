import { toLines } from '../reader/ocrLines';
import { blocksFor } from '../reader/testing';
import type { PhraseId } from '../speech/phrases';
import { buildTafsiriPlan, isTranslatable, tafsiriLines, type LineTafsiri } from './tafsiri';

const linesOf = (texts: (string | { text: string; confidence: number })[]) => toLines(blocksFor(texts));

/** A fake model with the answers the test gives it. */
const model = (answers: Record<string, string | Error>) => async (line: string) => {
  const a = answers[line];
  if (a === undefined) throw new Error(`no answer set for: ${line}`);
  if (a instanceof Error) throw a;
  return a;
};

describe('tafsiriLines', () => {
  it('shows a translation whose numbers match, and gives its clips when the original fits a template', async () => {
    const lines = linesOf(['Take 2 tablets twice daily for 5 days.', 'Keep out of reach of children.', 'Store in a cool place.']);
    const results = await tafsiriLines(
      lines,
      model({
        'Take 2 tablets twice daily for 5 days.': 'Chukua vidonge viwili mara mbili kwa siku kwa siku tano.',
        'Keep out of reach of children.': 'Weka mbali na watoto.',
      }),
    );
    expect(results).toEqual([
      {
        kind: 'safe',
        original: 'Take 2 tablets twice daily for 5 days.',
        translation: 'Chukua vidonge viwili mara mbili kwa siku kwa siku tano.',
        clips: ['tpl_take', 'tpl_tab_2', 'tpl_freq_2', 'tpl_days_5'],
      },
      { kind: 'safe', original: 'Keep out of reach of children.', translation: 'Weka mbali na watoto.', clips: null },
      // Storage is under More details (not read aloud), so it is not translated either.
      { kind: 'skipped' },
    ]);
  });

  it('refuses a translation whose number changed, and keeps no translated text', async () => {
    const lines = linesOf(['Take 2 tablets twice daily.']);
    const [r] = (await tafsiriLines(lines, model({ 'Take 2 tablets twice daily.': 'Chukua vidonge 3 mara mbili kwa siku.' })))!;
    expect(r!.kind).toBe('unsafe');
    if (r?.kind === 'unsafe') {
      expect(r.original).toBe('Take 2 tablets twice daily.');
      expect(r.check.numbers).toEqual({ missing: ['2'], extra: ['3'] });
    }
  });

  it('refuses a changed frequency ("twice" became "mara tatu")', async () => {
    const [r] = (await tafsiriLines(
      linesOf(['Take 1 tablet twice daily.']),
      model({ 'Take 1 tablet twice daily.': 'Chukua kidonge kimoja mara tatu kwa siku.' }),
    ))!;
    expect(r!.kind).toBe('unsafe');
  });

  it('refuses a number that went missing', async () => {
    const [r] = (await tafsiriLines(
      linesOf(['Complete the full course of 14 tablets.']),
      model({ 'Complete the full course of 14 tablets.': 'Kamilisha kozi nzima ya vidonge.' }),
    ))!;
    expect(r!.kind).toBe('unsafe');
  });

  it('refuses a changed unit', async () => {
    const [r] = (await tafsiriLines(linesOf(['Give 5 ml.']), model({ 'Give 5 ml.': 'Toa 5 mg.' })))!;
    expect(r!.kind).toBe('unsafe');
  });

  it('a safe translation is still not spoken when the model changed a number in a line the template would match', async () => {
    // The clips come from the original, but only after the check passed.
    const [r] = (await tafsiriLines(
      linesOf(['Take 4 tablets.']),
      model({ 'Take 4 tablets.': 'Chukua vidonge vitano.' }),
    ))!;
    expect(r).toMatchObject({ kind: 'unsafe' });
    expect(buildTafsiriPlan([r!]).map((s) => (s.kind === 'clip' ? s.phrase : s.text))).toEqual(['tafsiri_unsafe']);
  });

  it('a model error on one line fails that line only', async () => {
    const results = await tafsiriLines(
      linesOf(['Take 1 tablet.', 'Shake well before use.']),
      model({ 'Take 1 tablet.': new Error('worker died'), 'Shake well before use.': 'Tikisa vizuri kabla ya kutumia.' }),
    );
    expect(results!.map((r) => r.kind)).toEqual(['failed', 'safe']);
  });

  it('an empty translation is a failure, not a pass', async () => {
    const [r] = (await tafsiriLines(linesOf(['Shake well.']), model({ 'Shake well.': '   ' })))!;
    expect(r!.kind).toBe('failed');
  });

  it('skips unsure lines, Swahili lines and detail lines, and never sends them to the model', async () => {
    const sent: string[] = [];
    const lines = linesOf([
      'PARACETAMOL',
      { text: 'Take 4 tablets', confidence: 0.3 },
      'Chukua kidonge kimoja kila siku',
      'Batch No: PX2417',
      'Manufactured by: Generic Pharma Ltd',
    ]);
    const results = await tafsiriLines(lines, async (l) => {
      sent.push(l);
      return 'PARASETAMOLI';
    });
    expect(sent).toEqual(['PARACETAMOL']);
    expect(results!.map((r) => r.kind)).toEqual(['safe', 'skipped', 'skipped', 'skipped', 'skipped']);
  });

  it('stops when cancelled and reports nothing, even if the model finishes after', async () => {
    let cancelled = false;
    let calls = 0;
    const results = await tafsiriLines(
      linesOf(['Shake well.', 'Take 1 tablet.']),
      async () => {
        calls++;
        cancelled = true; // the user left the screen while the model was running
        return 'Tikisa vizuri.';
      },
      () => cancelled,
    );
    expect(results).toBeNull();
    expect(calls).toBe(1);
  });

  it('isTranslatable matches the rules', () => {
    const [a, b] = linesOf(['Take 1 tablet.', { text: 'Take 1 tablet.', confidence: 0.1 }]);
    expect(isTranslatable(a!)).toBe(true);
    expect(isTranslatable(b!)).toBe(false);
  });
});

describe('buildTafsiriPlan', () => {
  const safe = (clips: PhraseId[] | null): LineTafsiri => ({
    kind: 'safe',
    original: 'x',
    translation: 'y',
    clips,
  });

  it('plays the template clips tied to their line, and notes lines that are only shown', () => {
    const plan = buildTafsiriPlan([safe(['tpl_take', 'tpl_tab_1']), safe(null), { kind: 'skipped' }]);
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'tpl_take', line: 0 },
      { kind: 'clip', phrase: 'tpl_tab_1', line: 0 },
      { kind: 'clip', phrase: 'tafsiri_on_screen' },
    ]);
  });

  it('says the translation is not safe for each unsafe line, and that it failed once', () => {
    const plan = buildTafsiriPlan([
      { kind: 'unsafe', original: 'a', translation: 'b', check: { safe: false } as never },
      { kind: 'failed', original: 'c' },
      { kind: 'failed', original: 'd' },
    ]);
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'tafsiri_unsafe', line: 0 },
      { kind: 'clip', phrase: 'tafsiri_failed' },
    ]);
  });

  it('is silent when nothing was translated', () => {
    expect(buildTafsiriPlan([{ kind: 'skipped' }])).toEqual([]);
  });
});

describe('card D: expiry and batch lines never reach the model', () => {
  it('uses the fixed Swahili, and the model is not asked', async () => {
    const asked: string[] = [];
    const lines = linesOf(['Take 2 tablets twice daily for 5 days.', 'Batch No: PX2417 Exp: 08/2028']);
    const results = await tafsiriLines(lines, async (l) => {
      asked.push(l);
      return 'Nambari ya mafunzo: PX2417 Maelezo ya mwisho: 08/2028';
    });
    expect(asked).toEqual(['Take 2 tablets twice daily for 5 days.']);
    expect(results?.[1]).toMatchObject({
      kind: 'safe',
      original: 'Batch No: PX2417 Exp: 08/2028',
      translation: 'Nambari ya kundi: PX2417. Inaisha muda: Agosti 2028',
    });
  });

  it('shows only the original when the date cannot be rendered exactly', async () => {
    const asked: string[] = [];
    const results = await tafsiriLines(linesOf(['Exp: 13/2028']), async (l) => {
      asked.push(l);
      return 'x';
    });
    expect(asked).toEqual([]);
    expect(results).toEqual([{ kind: 'failed', original: 'Exp: 13/2028' }]);
  });
});
