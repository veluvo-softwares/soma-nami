import { speakDates } from '../reader/spokenDate';

/**
 * Expiry, batch and manufacturing lines are never sent to the model (card D,
 * 30 Oct). On the iPhone the model turned "Batch No: PX2417 Exp: 08/2028"
 * into "Nambari ya mafunzo: PX2417 Maelezo ya mwisho: 08/2028" (training
 * number / final notes), and the number check let it through because the
 * numbers matched. These lines are a handful of fixed fields, so they are
 * written from fixed Swahili templates, with only the code and the date taken
 * from the original:
 *
 *   Exp: 08/2028          -> Inaisha muda: Agosti 2028
 *   Batch No: PX2417      -> Nambari ya kundi: PX2417
 *   Mfg: 03/2026          -> Imetengenezwa: Machi 2026
 *
 * A line that is one of these fields but has anything else on it, or a date
 * that is not a valid date, gets no translation at all (`unclear`): the
 * original is shown. The model is never asked.
 */

const EXPIRY = String.raw`(?:exp(?![a-z])\.?(?:\s*date)?|expiry(?:\s*date)?|expires|valid\s+(?:until|till|thru)|use\s+by|use\s+before|best\s+before)`;
const BATCH = String.raw`(?:batch(?:\s*(?:no\.?|number|#))?|lot(?:\s*(?:no\.?|number|#))?|b\.?\s?no\.?)`;
const MFG = String.raw`(?:mfg|mfd|mft|manufactured(?:\s+on)?|manufacturing\s+date|date\s+of\s+manufacture)\.?(?:\s*date)?`;
const SEP = String.raw`\s*[:.#-]?\s*`;

const START_EXPIRY = new RegExp(`^${EXPIRY}${SEP}`, 'i');
const START_BATCH = new RegExp(`^${BATCH}${SEP}([A-Za-z0-9-]*\\d[A-Za-z0-9-]*)`, 'i');
const START_MFG = new RegExp(`^${MFG}${SEP}`, 'i');
/** A date once speakDates(.., 'sw') has run: "Agosti 2028" or "12 Agosti 2028". */
const SW_DATE = /^(?:\d{1,2}\s+)?(?:Januari|Februari|Machi|Aprili|Mei|Juni|Julai|Agosti|Septemba|Oktoba|Novemba|Desemba)\s+\d{4}/;

/** True when the line has an expiry, batch or manufacturing field in it. */
export function isFixedField(text: string): boolean {
  const t = text.trim();
  return [START_EXPIRY, START_BATCH, START_MFG].some((re) => re.test(t)) || new RegExp(`\\b(?:${EXPIRY}|${MFG})\\s*[:.]?\\s*\\d`, 'i').test(t) || new RegExp(`\\b${BATCH}${SEP}[A-Za-z0-9-]*\\d`, 'i').test(t);
}

export type FixedResult = { kind: 'translated'; translation: string } | { kind: 'unclear' };

/**
 * The Swahili for a line made only of expiry / batch / manufacturing fields,
 * or `unclear` when the line is such a field but cannot be rendered exactly.
 * Returns null for any other line (the model handles those).
 */
export function fixedTranslation(original: string): FixedResult | null {
  if (!isFixedField(original)) return null;
  let rest = original.trim();
  const parts: string[] = [];
  while (rest !== '') {
    rest = rest.replace(/^[\s,;|/]+/, '');
    if (rest === '') break;
    const batch = START_BATCH.exec(rest);
    if (batch) {
      parts.push(`Nambari ya kundi: ${batch[1]}`);
      rest = rest.slice(batch[0].length);
      continue;
    }
    const field = START_EXPIRY.exec(rest) ?? START_MFG.exec(rest);
    if (!field) return { kind: 'unclear' };
    const label = START_EXPIRY.test(rest) ? 'Inaisha muda' : 'Imetengenezwa';
    // Dates glued to the next field ("08/2028 Batch ...") stop at the date: take the date alone.
    const after = rest.slice(field[0].length);
    const spoken = speakDates(after, 'sw', true);
    const date = SW_DATE.exec(spoken);
    if (!date) return { kind: 'unclear' };
    parts.push(`${label}: ${date[0]}`);
    // Continue after the date as printed: the date text is the shortest prefix of `after` that speaks to `date[0]`.
    let cut = 1;
    while (cut <= after.length && !speakDates(after.slice(0, cut), 'sw', true).startsWith(date[0])) cut++;
    if (cut > after.length) return { kind: 'unclear' };
    rest = after.slice(cut);
  }
  return parts.length === 0 ? { kind: 'unclear' } : { kind: 'translated', translation: parts.join('. ') };
}
