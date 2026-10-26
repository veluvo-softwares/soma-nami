import fixtures from './__fixtures__/qvac-ocr-c2.json';
import { assessPhoto } from './assess';
import { toLines, type OcrBlock } from './ocrLines';
import { buildSpeechPlan } from '../speech/plan';

/**
 * Real QVAC output: `ocr()` from @qvac/sdk 0.22.0 with the app's OCR_CONFIG
 * (canvasSize 1024, recognizerBatchSize 1) on the C2 spike's synthetic photos,
 * captured on the VPS. Checks the pipeline on what the engine actually
 * returns, misreads included, not just on hand-made blocks.
 */
const SIZES = {
  'p1_paracetamol_photo.jpg': { width: 1054, height: 653 },
  'p4_ors_sw_photo.jpg': { width: 1054, height: 555 },
  'h5_tds_indieflower.jpg': { width: 948, height: 532 },
  'p2_amoxicillin_hard.jpg': { width: 1054, height: 617 },
};

function run(name: keyof typeof SIZES) {
  const lines = toLines(fixtures[name] as OcrBlock[]);
  return { lines, assessment: assessPhoto(lines, SIZES[name]), plan: buildSpeechPlan(lines) };
}

describe('pipeline on real QVAC OCR output', () => {
  it('paracetamol photo: reads every confident line as printed, flags the misread one', () => {
    const { lines, assessment, plan } = run('p1_paracetamol_photo.jpg');
    expect(lines.map((l) => l.text)).toEqual([
      'PARACETAMOL',
      'Tablets BP 500 mg',
      '100 Tablets',
      'Dosage: Adults and children over 12 years:',
      '1 to 2 tablets every 4 to 6 hours:',
      'Do not take more than 8 tablets in 24 hours.',
      'Store below 30*C. Keep out of reach of children.',
      'Batch No: PX2417 Exp: 08/2028',
      'Manufactured by: Generic Pharma Ltd',
    ]);
    // "30°C" came back as "30*C" at confidence 0.41: below the gate, so never read out.
    expect(lines.filter((l) => l.lowConfidence).map((l) => l.text)).toEqual([
      'Store below 30*C. Keep out of reach of children.',
    ]);
    expect(assessment.kind).toBe('read');
    expect(plan.filter((s) => s.kind === 'clip' && s.phrase === 'line_unsure')).toEqual([
      { kind: 'clip', phrase: 'line_unsure', line: 6 },
    ]);
    // Batch and maker lines aren't read (Wesley, C4a); the expiry date on the batch line is.
    expect(plan.filter((s) => s.kind === 'tts').map((s) => (s.kind === 'tts' ? s.text : ''))).toEqual([
      'PARACETAMOL',
      'Tablets BP 500 mg',
      '100 Tablets',
      'Dosage: Adults and children over 12 years:',
      '1 to 2 tablets every 4 to 6 hours:',
      'Do not take more than 8 tablets in 24 hours.',
      'Exp: 08/2028',
    ]);
  });

  it('handwritten "Tab 1 tds": OCR returns "Tab 4 tds" above the confidence gate, and the app refuses to read it', () => {
    const { lines, assessment } = run('h5_tds_indieflower.jpg');
    expect(lines.map((l) => l.text)).toEqual(['Tab 4 tds', 'after food']);
    expect(lines[0]!.lowConfidence).toBe(false); // the gate alone would have let this through
    expect(assessment).toMatchObject({ kind: 'not-sure', reason: 'handwritten-dose' });
  });

  it('bilingual ORS pack: English lines go to the voice, Swahili lines are shown, not sent to it', () => {
    const { lines, assessment, plan } = run('p4_ors_sw_photo.jpg');
    expect(assessment.kind).toBe('read');
    const sw = lines.filter((l) => l.language === 'sw').map((l) => l.text);
    expect(sw).toEqual([
      'Chumvi ya Kurejesha Maji Mwilini',
      'Yeyusha pakiti moja katika lita 1 ya maji safi.',
      'Tumia ndani ya saa 24',
    ]);
    const spoken = plan.flatMap((s) => (s.kind === 'tts' ? [s.text] : []));
    for (const text of sw) expect(spoken).not.toContain(text);
    expect(spoken).toContain('ORAL REHYDRATION SALTS');
    expect(spoken).toContain('Use within 24 hours.');
  });

  it('hard amoxicillin photo: words on one line are joined left to right, and every spoken word is OCR text', () => {
    const { lines, assessment, plan } = run('p2_amoxicillin_hard.jpg');
    expect(lines.map((l) => l.text)).toContain('Take one capsule three times a day');
    expect(assessment.kind).toBe('read');
    const ocrText = (fixtures['p2_amoxicillin_hard.jpg'] as OcrBlock[]).map((b) => b.text);
    for (const step of plan) {
      if (step.kind === 'tts') for (const part of step.text.split(' ')) expect(ocrText.join(' ')).toContain(part);
    }
  });
});

describe('paracetamol label with a misread batch code (real QVAC blocks, batch score lowered)', () => {
  // The photo fixture has the batch code and the expiry as two blocks on one line. On the phone the clean
  // image scored the batch code low; the real blocks of that run were not captured, so lower it here.
  const blocks = (fixtures['p1_paracetamol_photo.jpg'] as OcrBlock[]).map((b) =>
    b.text.startsWith('Batch No') ? { ...b, confidence: 0.3 } : b,
  );

  it('still speaks the expiry', () => {
    const plan = buildSpeechPlan(toLines(blocks));
    expect(plan).toContainEqual(expect.objectContaining({ kind: 'tts', text: 'Exp: 08/2028' }));
    expect(JSON.stringify(plan)).not.toContain('PX2417');
  });

  it('does not speak the expiry when the expiry itself is unsure', () => {
    const unsure = blocks.map((b) => (b.text.startsWith('Exp') ? { ...b, confidence: 0.4 } : b));
    const plan = buildSpeechPlan(toLines(unsure));
    expect(JSON.stringify(plan)).not.toContain('08/2028');
  });
});
