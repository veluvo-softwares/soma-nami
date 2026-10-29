import { fixedTranslation, isFixedField } from './fixedLines';

const sw = (s: string) => fixedTranslation(s);

describe('fixed Swahili for expiry, batch and manufacturing lines', () => {
  it('the line the model got wrong on the phone', () => {
    expect(sw('Batch No: PX2417 Exp: 08/2028')).toEqual({
      kind: 'translated',
      translation: 'Nambari ya kundi: PX2417. Inaisha muda: Agosti 2028',
    });
  });

  it.each([
    ['Exp: 08/2028', 'Inaisha muda: Agosti 2028'],
    ['EXP08/2028', 'Inaisha muda: Agosti 2028'],
    ['Expiry Date: 12/03/2027', 'Inaisha muda: 12 Machi 2027'],
    ['Use by AUG 2028', 'Inaisha muda: Agosti 2028'],
    ['Exp. 01/29', 'Inaisha muda: Januari 2029'],
    ['Mfg: 03/2026', 'Imetengenezwa: Machi 2026'],
    ['Mfd 12-2025 Exp 12-2028', 'Imetengenezwa: Desemba 2025. Inaisha muda: Desemba 2028'],
    ['Batch: B2417', 'Nambari ya kundi: B2417'],
    ['Lot No. 4471A', 'Nambari ya kundi: 4471A'],
    ['B.No: PX2417 Mfg: 03/2026 Exp: 02/2029', 'Nambari ya kundi: PX2417. Imetengenezwa: Machi 2026. Inaisha muda: Februari 2029'],
  ])('%s', (original, expected) => {
    expect(sw(original)).toEqual({ kind: 'translated', translation: expected });
  });

  it('never says the wrong words the model produced', () => {
    const r = sw('Batch No: PX2417 Exp: 08/2028');
    expect(r?.kind === 'translated' && r.translation).not.toMatch(/mafunzo|maelezo|mwisho/i);
  });

  it('is unclear, not guessed, when the date is not a date', () => {
    expect(sw('Exp: 13/2028')).toEqual({ kind: 'unclear' });
    expect(sw('Exp: ??')).toEqual({ kind: 'unclear' });
  });

  it('is unclear when other words share the line, so nothing is dropped', () => {
    expect(sw('Exp: 08/2028 Keep dry')).toEqual({ kind: 'unclear' });
  });

  it('leaves every other line to the model', () => {
    expect(sw('Take 2 tablets twice daily')).toBeNull();
    expect(sw('Expect relief within an hour')).toBeNull();
    expect(isFixedField('Keep out of reach of children')).toBe(false);
  });
});
