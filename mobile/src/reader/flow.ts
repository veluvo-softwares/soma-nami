import type { Assessment } from './assess';
import type { LabelLine } from './ocrLines';
import type { PhraseId } from '../speech/phrases';

/**
 * The read flow (docs/ui.md screens 1-3 and 5):
 *   home        one big "Gusa kusoma" button
 *   aiming      camera; tap anywhere to take the photo. After a photo that
 *               needs adjusting it shows the spoken hint, and "Soma hii" when
 *               some text was read anyway
 *   processing  OCR running on the photo
 *   reading     the label lines, read aloud
 *   not-sure    "Sijaweza kusoma vizuri": nothing is read out
 */
export type FlowState =
  | { screen: 'home' }
  | { screen: 'aiming'; hint: PhraseId | null; found: LabelLine[] }
  | { screen: 'processing'; request: number }
  | { screen: 'reading'; lines: LabelLine[] }
  | { screen: 'not-sure'; reason: 'mostly-unreadable' | 'handwritten-dose' };

export type FlowAction =
  | { type: 'open-camera' }
  | { type: 'photo-taken'; request: number }
  | { type: 'assessed'; request: number; assessment: Assessment }
  | { type: 'failed'; request: number }
  | { type: 'read-anyway' }
  | { type: 'home' };

export const INITIAL_FLOW: FlowState = { screen: 'home' };

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'open-camera':
      return { screen: 'aiming', hint: null, found: [] };
    case 'photo-taken':
      return { screen: 'processing', request: action.request };
    case 'assessed': {
      // A result for a photo the user has already left behind is dropped.
      if (state.screen !== 'processing' || state.request !== action.request) return state;
      const a = action.assessment;
      if (a.kind === 'read') return { screen: 'reading', lines: a.lines };
      if (a.kind === 'not-sure') return { screen: 'not-sure', reason: a.reason };
      return { screen: 'aiming', hint: a.hint, found: a.lines };
    }
    case 'failed':
      if (state.screen !== 'processing' || state.request !== action.request) return state;
      return { screen: 'aiming', hint: 'error', found: [] };
    case 'read-anyway':
      if (state.screen !== 'aiming' || state.found.length === 0) return state;
      return { screen: 'reading', lines: state.found };
    case 'home':
      return { screen: 'home' };
    default:
      return state;
  }
}
