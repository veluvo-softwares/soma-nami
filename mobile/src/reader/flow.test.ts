import { flowReducer, INITIAL_FLOW, type FlowState } from './flow';
import { toLines } from './ocrLines';
import { blocksFor } from './testing';

const LINES = toLines(blocksFor(['PARACETAMOL', 'Tablets BP 500 mg']));

describe('flowReducer', () => {
  it('home -> aiming -> processing -> reading', () => {
    let s: FlowState = INITIAL_FLOW;
    s = flowReducer(s, { type: 'open-camera' });
    expect(s).toEqual({ screen: 'aiming', hint: null, found: [] });
    s = flowReducer(s, { type: 'photo-taken', request: 1 });
    expect(s).toEqual({ screen: 'processing', request: 1 });
    s = flowReducer(s, { type: 'assessed', request: 1, assessment: { kind: 'read', lines: LINES } });
    expect(s).toEqual({ screen: 'reading', lines: LINES });
  });

  it('a hint goes back to the camera with the hint, and "Soma hii" reads what was found', () => {
    let s = flowReducer({ screen: 'processing', request: 2 }, {
      type: 'assessed',
      request: 2,
      assessment: { kind: 'hint', hint: 'hint_left', lines: LINES },
    });
    expect(s).toEqual({ screen: 'aiming', hint: 'hint_left', found: LINES });
    s = flowReducer(s, { type: 'read-anyway' });
    expect(s).toEqual({ screen: 'reading', lines: LINES });
  });

  it('"Soma hii" does nothing when nothing was found', () => {
    const s: FlowState = { screen: 'aiming', hint: 'hint_no_text', found: [] };
    expect(flowReducer(s, { type: 'read-anyway' })).toBe(s);
  });

  it('not sure goes to the Not sure screen', () => {
    const s = flowReducer({ screen: 'processing', request: 1 }, {
      type: 'assessed',
      request: 1,
      assessment: { kind: 'not-sure', reason: 'handwritten-dose', lines: LINES },
    });
    expect(s).toEqual({ screen: 'not-sure', reason: 'handwritten-dose' });
  });

  it('a photo that lands after the user left the camera starts nothing', () => {
    const home: FlowState = { screen: 'home' };
    expect(flowReducer(home, { type: 'photo-taken', request: 5 })).toBe(home);
  });

  it('drops a result for a photo the user already left (went home, or took another)', () => {
    const home: FlowState = { screen: 'home' };
    expect(flowReducer(home, { type: 'assessed', request: 1, assessment: { kind: 'read', lines: LINES } })).toBe(home);
    const newer: FlowState = { screen: 'processing', request: 3 };
    expect(flowReducer(newer, { type: 'assessed', request: 2, assessment: { kind: 'read', lines: LINES } })).toBe(newer);
    expect(flowReducer(newer, { type: 'failed', request: 2 })).toBe(newer);
  });

  it('an OCR failure goes back to the camera and says something went wrong', () => {
    expect(flowReducer({ screen: 'processing', request: 4 }, { type: 'failed', request: 4 })).toEqual({
      screen: 'aiming',
      hint: 'error',
      found: [],
    });
  });
});
