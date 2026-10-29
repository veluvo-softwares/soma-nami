import { lineRole } from '../reader/details';
import type { LabelLine } from '../reader/ocrLines';
import { splitDetails } from '../reader/scope';
import type { SpeechStep } from '../speech/plan';
import { checkTranslation, type CheckResult } from './numberCheck';
import { spokenClipsFor } from './spokenTemplate';
import type { PhraseId } from '../speech/phrases';

/**
 * "Tafsiri kwa Kiswahili" for a whole label (docs/scope.md §6, rule 1).
 *
 * Every confident English line is translated on the phone, then the number
 * check compares each translation with its own original line. The result for
 * a line is one of:
 *
 *   safe     numbers, units and frequencies all match: the translation is
 *            shown next to the original, labelled as a translation. It is
 *            spoken only if the ORIGINAL fits a template (spokenTemplate.ts).
 *   unsafe   something differs: the translation is dropped, the original is
 *            shown and the app says the translation isn't safe.
 *   failed   the model errored or returned nothing: same as unsafe, the
 *            original is shown.
 *   skipped  not translated: a Swahili line already, an unsure line, or a
 *            line under More details (reader/scope.ts: batch, barcode, maker,
 *            storage, marketing).
 */
export type LineTafsiri =
  | { kind: 'safe'; original: string; translation: string; clips: PhraseId[] | null }
  | { kind: 'unsafe'; original: string; translation: string; check: CheckResult }
  | { kind: 'failed'; original: string }
  | { kind: 'skipped' };

export type Translate = (englishLine: string) => Promise<string>;

/** True for the lines that should be sent to the model. */
export function isTranslatable(line: LabelLine): boolean {
  return !line.lowConfidence && line.language !== 'sw' && lineRole(line) === 'read' && line.text.trim() !== '';
}

/**
 * Indices of the lines tafsiriLines sends to the model: read aloud (not under
 * More details) and translatable. The screen counts its progress from this.
 */
export function translatedLines(lines: readonly LabelLine[]): number[] {
  const spoken = new Set(splitDetails(lines).read);
  return lines.flatMap((line, i) => (spoken.has(i) && isTranslatable(line) ? [i] : []));
}

/**
 * Translates and checks the lines one at a time (the phone runs one model
 * call at a time anyway). `cancelled()` is polled between lines so leaving
 * the screen stops the work; a cancelled run returns null and reports nothing.
 */
export async function tafsiriLines(
  lines: readonly LabelLine[],
  translate: Translate,
  cancelled: () => boolean = () => false,
): Promise<LineTafsiri[] | null> {
  const out: LineTafsiri[] = [];
  // Only lines that are read aloud: a line under More details isn't translated either.
  const sent = new Set(translatedLines(lines));
  for (const [i, line] of lines.entries()) {
    if (cancelled()) return null;
    if (!sent.has(i)) {
      out.push({ kind: 'skipped' });
      continue;
    }
    const original = line.text.trim();
    let translation: string;
    try {
      translation = (await translate(original)).trim();
    } catch {
      out.push({ kind: 'failed', original });
      continue;
    }
    if (cancelled()) return null;
    if (translation === '') {
      out.push({ kind: 'failed', original });
      continue;
    }
    const check = checkTranslation(original, translation);
    out.push(
      check.safe
        ? { kind: 'safe', original, translation, clips: spokenClipsFor(original) }
        : { kind: 'unsafe', original, translation, check },
    );
  }
  return cancelled() ? null : out;
}

/**
 * What the app says after translating. Clips only: the numbers in the spoken
 * template come from the original line, and an unsafe line gets the pre-made
 * "Tafsiri hii si salama" clip. Lines that are shown but not spoken get one
 * note saying the translation is on screen.
 */
export function buildTafsiriPlan(results: readonly LineTafsiri[]): SpeechStep[] {
  const steps: SpeechStep[] = [];
  let shownOnly = false;
  let failed = false;
  results.forEach((r, i) => {
    if (r.kind === 'safe') {
      if (r.clips) for (const phrase of r.clips) steps.push({ kind: 'clip', phrase, line: i });
      else shownOnly = true;
    } else if (r.kind === 'unsafe') {
      steps.push({ kind: 'clip', phrase: 'tafsiri_unsafe', line: i });
    } else if (r.kind === 'failed') {
      failed = true;
    }
  });
  if (failed) steps.push({ kind: 'clip', phrase: 'tafsiri_failed' });
  if (shownOnly) steps.push({ kind: 'clip', phrase: 'tafsiri_on_screen' });
  return steps;
}
