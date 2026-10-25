import { lineRole, spokenText, splitDetails } from './details';
import { toLines } from './ocrLines';
import { blocksFor } from './testing';
import { buildSpeechPlan } from '../speech/plan';

describe('lineRole: what is not read aloud', () => {
  it.each([
    'Batch No: PX2417',
    'BATCH: 2417A',
    'Lot 7731',
    'B.No. KX221',
    'Mfg: 01/2026',
    'Mfd. date 01/2026',
    'Date of manufacture: 01/2026',
    'Manufactured by: Generic Pharma Ltd',
    'Marketed by Afya Labs Limited',
    'P.O. Box 12345-00100, Nairobi',
    'Industrial Area, Nairobi',
    'Tel: +254 700 000 000',
    'www.example.co.ke',
    '5 012345 678900',
    '(01) 05012345678900',
    'GTIN 05012345678900',
    'Imetengenezwa na Afya Labs',
  ])('%s is a detail', (text) => {
    expect(lineRole(text)).toBe('detail');
  });

  it.each([
    'PARACETAMOL',
    'Tablets BP 500 mg',
    '100 Tablets',
    '1 to 2 tablets every 4 to 6 hours.',
    'Do not take more than 8 tablets in 24 hours.',
    'Store below 30°C. Keep out of reach of children.',
    'Exp: 08/2028',
    'Expiry date 08/2028',
    'Use by 08/2028',
    // Expiry is a safety line: spoken even when it shares the line with the batch.
    'Batch No: PX2417 Exp: 08/2028',
    'Mfg: 01/2026 Exp: 01/2028',
    'Tarehe ya mwisho wa matumizi: 08/2028',
    '08/2028',
    '20 x 10 tablets',
  ])('%s is read', (text) => {
    expect(lineRole(text)).toBe('read');
  });
});

describe('spokenText', () => {
  it.each([
    ['Batch No: PX2417 Exp: 08/2028', 'Exp: 08/2028'],
    ['Batch No: PX2417  Exp: 08/2028', 'Exp: 08/2028'],
    ['Exp: 08/2028 Mfg: 01/2026', 'Exp: 08/2028'],
    ['Mfg: 01/2026 Exp: 01/2028 Batch: X7', 'Exp: 01/2028'],
    ['Use by 08/2028, Lot 7731', 'Use by 08/2028'],
    ['Expiry date: 08/2028', 'Expiry date: 08/2028'],
    ['1 to 2 tablets every 4 to 6 hours.', '1 to 2 tablets every 4 to 6 hours.'],
  ])('%s -> %s', (text, spoken) => {
    expect(spokenText(text)).toBe(spoken);
  });
});

describe('speech plan with label details', () => {
  const lines = toLines(
    blocksFor([
      'PARACETAMOL',
      '1 to 2 tablets every 4 to 6 hours.',
      { text: 'Batch No: PX24I7', confidence: 0.3 },
      'Batch No: PX2417 Exp: 08/2028',
      'Mfg: 01/2026',
      'Manufactured by: Generic Pharma Ltd',
      '5 012345 678900',
    ]),
  );

  it('skips batch, manufacturing, maker and barcode lines, even unsure ones, and keeps the expiry date', () => {
    const plan = buildSpeechPlan(lines);
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'label_says' },
      { kind: 'tts', text: 'PARACETAMOL', line: 0 },
      { kind: 'tts', text: '1 to 2 tablets every 4 to 6 hours.', line: 1 },
      { kind: 'tts', text: 'Exp: 08/2028', line: 3 },
      { kind: 'clip', phrase: 'reading_end' },
    ]);
  });

  it('splits the lines for the screen: read lines first, details kept with their indices', () => {
    expect(splitDetails(lines)).toEqual({ read: [0, 1, 3], details: [2, 4, 5, 6] });
  });

  it('an unsure expiry line is still marked and spoken as unsure, never dropped', () => {
    const plan = buildSpeechPlan(toLines(blocksFor(['AMOXICILLIN', { text: 'Exp: 08/2O28', confidence: 0.3 }])));
    expect(plan).toContainEqual({ kind: 'clip', phrase: 'line_unsure', line: 1 });
  });
});
