import { assessPhoto, framingHint, looksLikeHandwrittenDose } from './assess';
import { toLines } from './ocrLines';
import { blocksFor, PHOTO_SIZE } from './testing';

const PARACETAMOL = [
  'PARACETAMOL',
  'Tablets BP 500 mg',
  '100 Tablets',
  'Dosage: Adults and children over 12 years:',
  '1 to 2 tablets every 4 to 6 hours.',
  'Do not take more than 8 tablets in 24 hours.',
];

const lines = (...args: Parameters<typeof blocksFor>) => toLines(blocksFor(...args));

describe('assessPhoto', () => {
  it('reads a well-framed printed label', () => {
    const a = assessPhoto(lines(PARACETAMOL), PHOTO_SIZE);
    expect(a.kind).toBe('read');
    expect(a.lines.map((l) => l.text)).toEqual(PARACETAMOL);
  });

  it('asks to point at the label when no text was found', () => {
    expect(assessPhoto([], PHOTO_SIZE)).toEqual({ kind: 'hint', hint: 'hint_no_text', lines: [] });
  });

  it('still reads a label with a few unsure lines, which are marked, not dropped', () => {
    const l = lines([...PARACETAMOL.slice(0, 5), { text: 'Batch No: PX24I7', confidence: 0.3 }]);
    const a = assessPhoto(l, PHOTO_SIZE);
    expect(a.kind).toBe('read');
    expect(a.lines.filter((x) => x.lowConfidence).map((x) => x.text)).toEqual(['Batch No: PX24I7']);
  });

  it('goes to Not sure when more than half the lines are unreadable', () => {
    const l = lines([
      'PARACETAMOL',
      { text: 'Tablcts BP 5O0 mg', confidence: 0.35 },
      { text: '1 t0 2 tab', confidence: 0.2 },
      { text: 'Do n0t take', confidence: 0.4 },
    ]);
    expect(assessPhoto(l, PHOTO_SIZE)).toMatchObject({ kind: 'not-sure', reason: 'mostly-unreadable' });
  });

  it('goes to Not sure (not a framing hint) for a blurry photo that is also off-frame', () => {
    const l = lines(
      [
        { text: 'xx', confidence: 0.2 },
        { text: 'yy', confidence: 0.2 },
        { text: 'zz', confidence: 0.2 },
        { text: 'Dosage: Adults', confidence: 0.9 },
      ],
      { left: 0 },
    );
    expect(assessPhoto(l, PHOTO_SIZE).kind).toBe('not-sure');
  });

  // The C2 spike's handwritten labels, as written and as EasyOCR misread them
  // (several misreads came back with confidence above the 0.5 gate).
  it.each([
    [['1x3']],
    [['Ax3']],
    [['2 bd']],
    [['2 &d']],
    [['1 x 3', 'x 5 days']],
    [['2 bd x 7/7']],
    [['2 bd X +/4']],
    [['Tab 1 tds', 'after food']],
    [['Tab 4 tds', 'after food']],
    [['1 nocte']],
    [['nocte']],
  ])('never reads a handwritten dose label: %j', (texts) => {
    const a = assessPhoto(lines(texts), PHOTO_SIZE);
    expect(a).toMatchObject({ kind: 'not-sure', reason: 'handwritten-dose' });
  });

  it('does not treat a full printed pack as handwriting, even with "x" and "/" in it', () => {
    const l = lines([
      'IBUPROFEN 200 mg',
      '3 x 10 Tablets',
      'Adults: 1 or 2 tablets up to 3 times a day.',
      'Take with or after food.',
      'Batch IB7734 Exp 01/2028',
    ]);
    expect(looksLikeHandwrittenDose(l)).toBe(false);
    expect(assessPhoto(l, PHOTO_SIZE).kind).toBe('read');
  });

  it('catches prescriber shorthand on a longer page too (OCR may split handwriting into many lines)', () => {
    const l = lines(['Tab 4', 'tds', 'after food', 'x 5 days']);
    expect(assessPhoto(l, PHOTO_SIZE)).toMatchObject({ kind: 'not-sure', reason: 'handwritten-dose' });
  });

  it('reads a short printed line with no number, like a medicine name', () => {
    expect(assessPhoto(lines(['PARACETAMOL']), PHOTO_SIZE).kind).toBe('read');
  });
});

describe('framingHint', () => {
  const at = (opts: Parameters<typeof blocksFor>[1]) => framingHint(lines(PARACETAMOL.slice(0, 3), opts), PHOTO_SIZE);

  it('says nothing when the text sits inside the frame', () => {
    expect(at({})).toBeNull();
  });

  it('text cut off on the left: move left', () => {
    expect(at({ left: 0 })).toBe('hint_left');
  });

  it('text cut off on the right: move right', () => {
    expect(at({ left: 400, width: 600 })).toBe('hint_right');
  });

  it('text cut off at the top: move up', () => {
    expect(at({ top: 0 })).toBe('hint_up');
  });

  it('text cut off at the bottom: move down', () => {
    expect(at({ top: 700 })).toBe('hint_down');
  });

  it('text running off both sides: move further away', () => {
    expect(at({ left: 0, width: 1000 })).toBe('hint_further');
  });

  it('small text far away in the middle: move closer', () => {
    expect(at({ left: 450, top: 380, width: 100, lineHeight: 10, gap: 4 })).toBe('hint_closer');
  });

  it('a photo with a framing problem but readable text gives the hint and keeps the lines', () => {
    const a = assessPhoto(lines(PARACETAMOL, { left: 0 }), PHOTO_SIZE);
    expect(a).toMatchObject({ kind: 'hint', hint: 'hint_left' });
    expect(a.lines).toHaveLength(PARACETAMOL.length);
  });
});
