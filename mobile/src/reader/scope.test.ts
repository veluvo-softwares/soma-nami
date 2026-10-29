import fixtures from './__fixtures__/qvac-ocr-c2.json';
import { assessPhoto, labelLines, looksLikeHandwrittenDose, unreadableShare } from './assess';
import { toLines, type OcrBlock } from './ocrLines';
import { lineGroups, splitDetails, type LineGroup } from './scope';
import { blocksFor, PHOTO_SIZE } from './testing';
import { buildSpeechPlan } from '../speech/plan';

/** Lines with their own heights: [text, height] or [text, height, confidence], stacked down the photo. */
function label(rows: readonly (readonly [string, number] | readonly [string, number, number])[], left = 150, top = 120) {
  let y = top;
  const blocks: OcrBlock[] = rows.map(([text, h, confidence = 0.9]) => {
    const block: OcrBlock = { text, confidence, bbox: [left, y, left + 600, y + h] };
    y += h + 10;
    return block;
  });
  return blocks;
}

const groupsOf = (blocks: OcrBlock[]) => {
  const lines = toLines(blocks);
  const groups = lineGroups(lines);
  return Object.fromEntries(lines.map((l, i) => [l.text, groups[i]])) as Record<string, LineGroup>;
};

const spoken = (blocks: OcrBlock[]) => buildSpeechPlan(toLines(blocks)).flatMap((s) => (s.kind === 'tts' ? [s.text] : []));

// A Paracetamol-style box, as printed: big name, strength, then everything a box carries.
const PARACETAMOL_BOX = label([
  ['PARACETAMOL', 60],
  ['Tablets BP 500 mg', 34],
  ['Fast, effective relief from pain and fever', 24],
  ['100 Tablets', 24],
  ['Each tablet contains Paracetamol BP 500 mg', 24],
  ['Dosage: Adults and children over 12 years:', 24],
  ['1 to 2 tablets every 4 to 6 hours.', 24],
  ['Do not take more than 8 tablets in 24 hours.', 24],
  ['Store below 30°C. Protect from light.', 24],
  ['Keep out of reach of children.', 24],
  ['Do not use if the seal is broken.', 24],
  ['Batch No: PX2417 Exp: 08/2028', 24],
  ['Manufactured by: Generic Pharma Ltd, Nairobi', 24],
  ['5 012345 678900', 24],
]);

describe('reading scope: what is read aloud, and in which order', () => {
  it('Paracetamol-style box: name and strength, dose, expiry, warnings; the rest under More details', () => {
    expect(spoken(PARACETAMOL_BOX)).toEqual([
      'PARACETAMOL',
      'Tablets BP 500 mg',
      'Each tablet contains Paracetamol BP 500 mg',
      'Dosage: Adults and children over 12 years:',
      '1 to 2 tablets every 4 to 6 hours.',
      'Exp: August 2028',
      'Do not take more than 8 tablets in 24 hours.',
      'Keep out of reach of children.',
      'Do not use if the seal is broken.',
    ]);
    const lines = toLines(PARACETAMOL_BOX);
    expect(splitDetails(lines).details.map((i) => lines[i]!.text)).toEqual([
      'Fast, effective relief from pain and fever',
      '100 Tablets',
      'Store below 30°C. Protect from light.',
      'Manufactured by: Generic Pharma Ltd, Nairobi',
      '5 012345 678900',
    ]);
  });

  it('reads every line exactly as printed: nothing is reworded, only a batch field is cut out', () => {
    const printed = toLines(PARACETAMOL_BOX).map((l) => l.text);
    for (const text of spoken(PARACETAMOL_BOX)) {
      if (text === 'Exp: August 2028') continue; // the date gets its month name, as before (spokenDate.ts)
      expect(printed).toContain(text);
    }
  });

  it('a warning sharing a line with storage text is read whole, not cut', () => {
    expect(groupsOf(label([['IBUPROFEN', 50], ['Store below 25°C. Keep out of reach of children.', 24]]))).toMatchObject({
      'Store below 25°C. Keep out of reach of children.': 'warning',
    });
  });

  it.each<[string, LineGroup]>([
    ['Take one capsule three times a day', 'dose'],
    ['for 7 days, or as directed by the prescriber.', 'dose'],
    ['Complete the full course.', 'dose'],
    ['Dissolve one sachet in 1 litre of clean water', 'dose'],
    ['Adults: do not take more than 8 tablets in 24 hours', 'dose'],
    ['2 tablets', 'dose'],
    ['Chukua vidonge 2 mara tatu kwa siku', 'dose'],
    ['Do not exceed the stated dose.', 'warning'],
    ['Not suitable for children under 6 years.', 'warning'],
    ['If symptoms persist, consult your doctor.', 'warning'],
    ['Usizidishe kipimo', 'warning'],
    ['Weka mbali na watoto', 'warning'],
    ['Use before 08/2028', 'expiry'],
    ['Tarehe ya mwisho: 08/2028', 'expiry'],
    ['Amoxicillin 250 mg', 'name'],
    ['Oral suspension BP', 'name'],
    ['3 x 10 tablets', 'detail'],
    ['100 ml', 'detail'],
    ['Store in a cool dry place', 'detail'],
    ['Prescription only medicine', 'detail'],
    ['Lot 7731', 'detail'],
  ])('%s -> %s', (text, group) => {
    expect(groupsOf(label([['MEDICINE', 50], [text, 24]]))[text]).toBe(group);
  });

  it('the name is the line printed largest; a body-size line with no other role is a detail, not a name', () => {
    const g = groupsOf(label([['Pain relief you can trust', 24], ['PANADOL', 64], ['Paracetamol', 58], ['Clinically proven formula', 24], ['Take 2 tablets.', 24]]));
    expect(g).toMatchObject({ PANADOL: 'name', Paracetamol: 'name', 'Pain relief you can trust': 'detail', 'Clinically proven formula': 'detail' });
  });

  it('without positions from OCR, only the first line can be the name', () => {
    const lines = toLines([
      { text: 'PARACETAMOL', confidence: 0.9 },
      { text: 'Generic Pharma', confidence: 0.9 },
      { text: 'Take 2 tablets.', confidence: 0.9 },
    ]);
    expect(lineGroups(lines)).toEqual(['name', 'detail', 'dose']);
  });

  it('an unreadable line with a number on it is kept where a dose would be, and announced as unreadable', () => {
    const blocks = label([['PARACETAMOL', 50], ['Tak3 1 t0 2 tabl', 24, 0.3], ['Exp: 08/2028', 24]]);
    expect(buildSpeechPlan(toLines(blocks))).toEqual([
      { kind: 'clip', phrase: 'label_says' },
      { kind: 'tts', text: 'PARACETAMOL', line: 0 },
      { kind: 'clip', phrase: 'line_unsure', line: 1 },
      { kind: 'tts', text: 'Exp: August 2028', line: 2 },
      { kind: 'clip', phrase: 'reading_end' },
    ]);
  });

  it('unreadable artwork (no number, no medicine words) goes to More details and is not announced', () => {
    const blocks = label([['PARACETAMOL', 50], ['~ wW mM ~', 24, 0.2], ['Take 2 tablets.', 24]]);
    const plan = buildSpeechPlan(toLines(blocks));
    expect(plan.filter((s) => s.kind === 'clip' && s.phrase === 'line_unsure')).toEqual([]);
    expect(splitDetails(toLines(blocks)).details).toEqual([1]);
  });

  it('an unreadable name stands in for the name when nothing readable could be the name', () => {
    const blocks = label([['PARACETAMQL', 60, 0.3], ['Take 2 tablets.', 24]]);
    expect(lineGroups(toLines(blocks))).toEqual(['name', 'dose']);
  });

  it('real QVAC output, amoxicillin: pack count and "Prescription only" are details', () => {
    const lines = toLines(fixtures['p2_amoxicillin_hard.jpg'] as OcrBlock[]);
    expect(splitDetails(lines).read.map((i) => lines[i]!.text)).toEqual([
      'AMOXICILLIN',
      'Capsules BP 250 mg',
      'Take one capsule three times a day',
      'for 7 days, or as directed by the prescriber.',
      'Complete the full course.',
      'Batch: AM0391 Mfg: 03/2026 Exp: 02/2028',
    ]);
  });
});

describe('only the label: text around it in the photo is dropped', () => {
  // The box photographed on a table, inside the frame, with other text around it:
  // a newspaper headline at the top, another pack's name at the side, a phone's clock.
  const box = blocksFor(['PARACETAMOL', 'Tablets BP 500 mg', '1 to 2 tablets every 4 to 6 hours.', 'Exp: 08/2028'], {
    left: 250,
    top: 260,
    width: 450,
    lineHeight: 30,
    gap: 10,
  });
  const around: OcrBlock[] = [
    { text: 'ELECTION RESULTS TONIGHT', confidence: 0.8, bbox: [20, 20, 600, 60] },
    { text: 'IBUPROFEN 400 mg', confidence: 0.85, bbox: [800, 300, 990, 330] },
    { text: 'Take 1 tablet three times a day', confidence: 0.8, bbox: [800, 340, 990, 360] },
    { text: '12:41', confidence: 0.9, bbox: [20, 740, 80, 770] },
  ];

  it('keeps the box lines and drops the rest', () => {
    const a = assessPhoto(toLines([...box, ...around]), PHOTO_SIZE);
    expect(a.kind).toBe('read');
    expect(a.lines.map((l) => l.text)).toEqual([
      'PARACETAMOL',
      'Tablets BP 500 mg',
      '1 to 2 tablets every 4 to 6 hours.',
      'Exp: 08/2028',
    ]);
  });

  it("never reads another pack's dose as this medicine's", () => {
    const a = assessPhoto(toLines([...box, ...around]), PHOTO_SIZE);
    const said = buildSpeechPlan(a.lines).flatMap((s) => (s.kind === 'tts' ? [s.text] : []));
    expect(said.join(' ')).not.toMatch(/IBUPROFEN|three times|ELECTION|12:41/);
  });

  it('keeps a big title printed apart from the body, in line with it', () => {
    const title: OcrBlock = { text: 'PARACETAMOL', confidence: 0.95, bbox: [250, 120, 700, 200] };
    const body = blocksFor(['Tablets BP 500 mg', 'Take 2 tablets.'], { left: 250, top: 330, width: 450, lineHeight: 24, gap: 10 });
    expect(labelLines(toLines([title, ...body])).map((l) => l.text)).toEqual(['PARACETAMOL', 'Tablets BP 500 mg', 'Take 2 tablets.']);
  });

  it('lines OCR returned without a position are kept', () => {
    const lines = toLines([{ text: 'PARACETAMOL', confidence: 0.9 }, ...box]);
    expect(labelLines(lines)).toHaveLength(5);
  });
});

describe('the Not sure rule', () => {
  const GOOD = ['PARACETAMOL', 'Tablets BP 500 mg', '1 to 2 tablets every 4 to 6 hours.', 'Exp: 08/2028'];

  it('unreadable artwork lines no longer tip a clear label into Not sure', () => {
    // 4 readable lines and 5 unreadable decorative ones: 5/9 > 0.5 sent this to Not sure before.
    const art = ['~~', 'wWw', 'Ooo', 'mMm', 'xXx'].map((text) => ({ text, confidence: 0.2 }));
    const l = toLines(blocksFor([...GOOD, ...art]));
    expect(unreadableShare(l)).toBe(0);
    expect(assessPhoto(l, PHOTO_SIZE).kind).toBe('read');
  });

  it('one or two unreadable lines on a short clear label do not either', () => {
    const l = toLines(blocksFor([...GOOD.slice(0, 3), { text: 'oOo', confidence: 0.1 }, { text: 'Ltd', confidence: 0.3 }]));
    expect(assessPhoto(l, PHOTO_SIZE).kind).toBe('read');
  });

  it('unreadable lines that may be the dose still count: half or more of them is still Not sure', () => {
    const l = toLines(
      blocksFor([
        ...GOOD,
        { text: 'Tak3 2 tab', confidence: 0.3 },
        { text: 'every 4 h0urs', confidence: 0.3 },
        { text: 'Do n0t take m0re than 8', confidence: 0.3 },
        { text: '1n 24 h', confidence: 0.3 },
        { text: 'Keep 0ut of reach', confidence: 0.3 },
      ]),
    );
    expect(assessPhoto(l, PHOTO_SIZE)).toMatchObject({ kind: 'not-sure', reason: 'mostly-unreadable' });
  });

  it('a blurry photo with fewer than three readable lines counts every line, as before', () => {
    const l = toLines(blocksFor(['PARACETAMOL', { text: 'xx', confidence: 0.2 }, { text: 'yy', confidence: 0.2 }]));
    expect(assessPhoto(l, PHOTO_SIZE)).toMatchObject({ kind: 'not-sure', reason: 'mostly-unreadable' });
  });

  it('artwork OCR read as "od" or "stat" (unsure, no number) is not taken for handwritten shorthand', () => {
    const l = toLines(blocksFor([...GOOD, { text: 'od', confidence: 0.2 }, { text: 'stat', confidence: 0.3 }]));
    expect(looksLikeHandwrittenDose(l)).toBe(false);
    expect(assessPhoto(l, PHOTO_SIZE).kind).toBe('read');
  });

  it('shorthand OCR was sure of, or with a number, still means a handwritten dose', () => {
    expect(looksLikeHandwrittenDose(toLines(blocksFor([...GOOD, 'tds'])))).toBe(true);
    expect(looksLikeHandwrittenDose(toLines(blocksFor([...GOOD, { text: '2 bd', confidence: 0.2 }])))).toBe(true);
  });

  it('a handwritten note beside the label is caught even though it is not part of the label', () => {
    const box = blocksFor(GOOD, { left: 250, top: 260, width: 450, lineHeight: 30, gap: 10 });
    const note: OcrBlock = { text: 'Tab 1 tds', confidence: 0.9, bbox: [820, 600, 990, 660] };
    expect(assessPhoto(toLines([...box, note]), PHOTO_SIZE)).toMatchObject({ kind: 'not-sure', reason: 'handwritten-dose' });
  });
});
