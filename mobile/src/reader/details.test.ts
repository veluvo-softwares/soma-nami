import { lineRole, spokenText, splitDetails } from './details';
import { toLines } from './ocrLines';
import { blocksFor } from './testing';
import { buildSpeechPlan } from '../speech/plan';

const sure = (text: string) => lineRole({ text, lowConfidence: false });

describe('lineRole: what is not read aloud', () => {
  it.each([
    'Batch No: PX2417',
    'BATCH: 2417A',
    'Batch No. KX-221',
    'Lot 7731',
    'B.No. KX221',
    'Mfg: 01/2026',
    'Mfd. date 01/2026',
    'Date of manufacture: 01/2026',
    'Manufactured by: Generic Pharma Ltd',
    'Marketed by Afya Labs Limited',
    'Made in India',
    'P.O. Box 12345-00100, Nairobi',
    'Industrial Area, Nairobi',
    'Generic Pharma Ltd, Nairobi, Kenya',
    'Tel: +254 700 000 000',
    'info@example.co.ke',
    'www.example.co.ke',
    '5 012345 678900',
    '(01) 05012345678900',
    'GTIN 05012345678900',
    'Imetengenezwa na Afya Labs',
  ])('%s is a detail', (text) => {
    expect(sure(text)).toBe('detail');
  });

  it.each([
    'PARACETAMOL',
    'Tablets BP 500 mg',
    '100 Tablets',
    '1 to 2 tablets every 4 to 6 hours.',
    'Do not take more than 8 tablets in 24 hours.',
    'Store below 30°C. Keep out of reach of children.',
    '20 x 10 tablets',
    // Instructions that share words with label details.
    'Drink a lot of water.',
    'Dissolve one sachet in 1 litre of water made by boiling.',
    'Limited to 4 days of use',
    'Store @ 25°C',
    // Expiry is a safety line: spoken even when it shares the line with the batch.
    'Exp: 08/2028',
    'EXP08/2028',
    'Expiry date 08/2028',
    'Valid until 01/2028',
    'Use by 08/2028',
    'Batch No: PX2417 Exp: 08/2028',
    'Mfg 01/26 Valid until 01/28',
    'Tarehe ya mwisho wa matumizi: 08/2028',
    'Tumia kabla ya 08/2028',
    // A date in digits on its own line (OCR split "EXP" from it) is not a barcode.
    '08/2028',
    '15-08-2028',
    '01 08 2028',
    // A warning or storage line sharing a line with the maker is still read.
    'Store below 30°C. Mfd by Afya Labs',
    'Protect from light. Mfg: 01/2026',
  ])('%s is read', (text) => {
    expect(sure(text)).toBe('read');
  });

  it('an unsure line is a detail only when it starts with a field name; otherwise it gets the unsure notice', () => {
    expect(lineRole({ text: 'Batch No: PX24I7', lowConfidence: true })).toBe('detail');
    expect(lineRole({ text: 'Mfg: O1/2026', lowConfidence: true })).toBe('detail');
    // Garbled text that merely contains an address-like word is not hidden.
    expect(lineRole({ text: 'Take 2 tabs Ltd water', lowConfidence: true })).toBe('read');
    expect(lineRole({ text: '5 0123 678900 0000', lowConfidence: true })).toBe('read');
    expect(lineRole({ text: 'Batch X Exp: 08/2O28', lowConfidence: true })).toBe('read');
  });
});

describe('spokenText', () => {
  it.each([
    ['Batch No: PX2417 Exp: 08/2028', 'Exp: 08/2028'],
    ['Batch No: PX2417  Exp: 08/2028', 'Exp: 08/2028'],
    ['Exp: 08/2028 Mfg: 01/2026', 'Exp: 08/2028'],
    ['Mfg: 01/2026 Exp: 01/2028 Batch: X7', 'Exp: 01/2028'],
    ['Use by 08/2028, Lot 7731', 'Use by 08/2028'],
    ['Mfg 01/26 Valid until 01/28', 'Valid until 01/28'],
    ['Store below 30°C. Mfd by Afya Labs', 'Store below 30°C.'],
    ['Take 1 tablet. Batch X7 Exp 08/2028', 'Take 1 tablet. Exp 08/2028'],
    ['Mfd by Afya Labs. Keep out of reach of children.', 'Keep out of reach of children.'],
    ['Expiry date: 08/2028', 'Expiry date: 08/2028'],
    ['1 to 2 tablets every 4 to 6 hours.', '1 to 2 tablets every 4 to 6 hours.'],
    ['Drink a lot of water.', 'Drink a lot of water.'],
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
      'Store below 30°C. Mfd by Afya Labs',
    ]),
  );

  it('skips batch, manufacturing, maker and barcode lines, even unsure ones, and keeps the expiry date and the storage line', () => {
    expect(buildSpeechPlan(lines)).toEqual([
      { kind: 'clip', phrase: 'label_says' },
      { kind: 'tts', text: 'PARACETAMOL', line: 0 },
      { kind: 'tts', text: '1 to 2 tablets every 4 to 6 hours.', line: 1 },
      { kind: 'tts', text: 'Exp: August 2028', line: 3 },
      { kind: 'tts', text: 'Store below 30°C.', line: 7 },
      { kind: 'clip', phrase: 'reading_end' },
    ]);
  });

  it('splits the lines for the screen: read lines first, details kept with their indices', () => {
    expect(splitDetails(lines)).toEqual({ read: [0, 1, 3, 7], details: [2, 4, 5, 6] });
  });

  it('an unsure expiry line is still marked and spoken as unsure, never dropped', () => {
    const plan = buildSpeechPlan(toLines(blocksFor(['AMOXICILLIN', { text: 'Exp: 08/2O28', confidence: 0.3 }])));
    expect(plan).toContainEqual({ kind: 'clip', phrase: 'line_unsure', line: 1 });
  });
});
