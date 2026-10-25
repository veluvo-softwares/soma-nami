import { buildSpeechPlan } from './plan';
import { toLines } from '../reader/ocrLines';
import { blocksFor } from '../reader/testing';

describe('buildSpeechPlan (OCR result -> what is said)', () => {
  it('frames the label, reads each confident English line exactly as printed, in order', () => {
    const plan = buildSpeechPlan(toLines(blocksFor(['AMOXICILLIN', 'Capsules BP 250 mg', 'Take one capsule three times a day'])));
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'label_says' },
      { kind: 'tts', text: 'AMOXICILLIN', line: 0 },
      { kind: 'tts', text: 'Capsules BP 250 mg', line: 1 },
      { kind: 'tts', text: 'Take one capsule three times a day', line: 2 },
      { kind: 'clip', phrase: 'reading_end' },
    ]);
  });

  it('never speaks a low-confidence line: it says it could not read it and to ask the pharmacist', () => {
    const plan = buildSpeechPlan(
      toLines(blocksFor(['PARACETAMOL', { text: 'Tab 4 tds', confidence: 0.42 }, 'Store below 30°C.'])),
    );
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'label_says' },
      { kind: 'tts', text: 'PARACETAMOL', line: 0 },
      { kind: 'clip', phrase: 'line_unsure', line: 1 },
      { kind: 'tts', text: 'Store below 30°C.', line: 2 },
      { kind: 'clip', phrase: 'reading_end' },
    ]);
    expect(JSON.stringify(plan)).not.toContain('Tab 4 tds');
  });

  it('does not send Swahili lines to the English voice; it says once that they are on screen', () => {
    const plan = buildSpeechPlan(
      toLines(
        blocksFor([
          'ORAL REHYDRATION SALTS',
          'Chumvi ya Kurejesha Maji Mwilini',
          'Use within 24 hours.',
          'Tumia ndani ya saa 24.',
        ]),
      ),
    );
    expect(plan).toEqual([
      { kind: 'clip', phrase: 'label_says' },
      { kind: 'tts', text: 'ORAL REHYDRATION SALTS', line: 0 },
      { kind: 'clip', phrase: 'line_swahili', line: 1 },
      { kind: 'tts', text: 'Use within 24 hours.', line: 2 },
      { kind: 'clip', phrase: 'reading_end' },
    ]);
  });

  it('marks an unsure Swahili line as unsure, not as Swahili', () => {
    const plan = buildSpeechPlan(toLines(blocksFor([{ text: 'Tumia ndani ya saa 24.', confidence: 0.2 }])));
    expect(plan[1]).toEqual({ kind: 'clip', phrase: 'line_unsure', line: 0 });
  });
});
