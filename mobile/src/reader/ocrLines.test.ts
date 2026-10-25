import { detectLineLanguage } from './language';
import { LOW_CONFIDENCE, toLines, type OcrBlock } from './ocrLines';

describe('toLines', () => {
  it('joins blocks on the same visual line left to right and orders lines top to bottom', () => {
    const blocks: OcrBlock[] = [
      { text: 'tablets', bbox: [300, 210, 420, 240], confidence: 0.9 },
      { text: 'PARACETAMOL', bbox: [100, 100, 500, 150], confidence: 0.95 },
      { text: '1 to 2', bbox: [100, 212, 280, 242], confidence: 0.88 },
      { text: 'every 4 hours.', bbox: [440, 208, 700, 238], confidence: 0.91 },
    ];
    const lines = toLines(blocks);
    expect(lines.map((l) => l.text)).toEqual(['PARACETAMOL', '1 to 2 tablets every 4 hours.']);
    expect(lines[1]!.box).toEqual({ x1: 100, y1: 208, x2: 700, y2: 242 });
  });

  it('keeps the text exactly as OCR read it: no spelling fixes, no number changes', () => {
    const lines = toLines([{ text: ' Batch: AMO391 ', bbox: [0, 0, 100, 20], confidence: 0.8 }]);
    expect(lines[0]!.text).toBe('Batch: AMO391');
  });

  it("marks a line low-confidence from its weakest block, so one bad word flags the line", () => {
    const lines = toLines([
      { text: 'Take', bbox: [0, 0, 50, 20], confidence: 0.95 },
      { text: '4', bbox: [60, 0, 70, 20], confidence: 0.31 },
      { text: 'tablets', bbox: [80, 0, 150, 20], confidence: 0.93 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.minConfidence).toBeCloseTo(0.31);
    expect(lines[0]!.lowConfidence).toBe(true);
  });

  it('uses the 0.5 gate from the C2 spike, and a block with no confidence counts as unsure', () => {
    expect(LOW_CONFIDENCE).toBe(0.5);
    const [atGate, below, missing] = toLines([
      { text: 'a', bbox: [0, 0, 10, 10], confidence: 0.5 },
      { text: 'b', bbox: [0, 100, 10, 110], confidence: 0.49 },
      { text: 'c', bbox: [0, 200, 10, 210] },
    ]);
    expect(atGate!.lowConfidence).toBe(false);
    expect(below!.lowConfidence).toBe(true);
    expect(missing!.lowConfidence).toBe(true);
  });

  it('drops empty blocks and keeps blocks without a box in OCR order at the end', () => {
    const lines = toLines([
      { text: '   ', bbox: [0, 0, 10, 10], confidence: 0.9 },
      { text: 'no box', confidence: 0.9 },
      { text: 'boxed', bbox: [0, 0, 10, 10], confidence: 0.9 },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['boxed', 'no box']);
    expect(lines[1]!.box).toBeNull();
  });

  it('returns no lines for no blocks', () => {
    expect(toLines([])).toEqual([]);
  });

  it('tags each line with its language', () => {
    const lines = toLines([
      { text: 'Dissolve one sachet in 1 litre of clean water.', bbox: [0, 0, 100, 20], confidence: 0.9 },
      { text: 'Yeyusha pakiti moja katika lita 1 ya maji safi.', bbox: [0, 50, 100, 70], confidence: 0.9 },
    ]);
    expect(lines.map((l) => l.language)).toEqual(['en', 'sw']);
  });
});

describe('detectLineLanguage', () => {
  // The synthetic ORS pack from the C2 spike, both languages on one box.
  it.each([
    ['ORAL REHYDRATION SALTS', 'en'],
    ['Chumvi ya Kurejesha Maji Mwilini', 'sw'],
    ['Use within 24 hours.', 'en'],
    ['Tumia ndani ya saa 24.', 'sw'],
    ['Batch: OR8812  Exp: 05/2028', 'en'],
    ['Take one capsule three times a day', 'en'],
    ['Meza kidonge kimoja mara tatu kwa siku', 'sw'],
    ['500 mg', 'en'],
    ['', 'en'],
  ])('%j is %s', (text, lang) => {
    expect(detectLineLanguage(text)).toBe(lang);
  });
});
