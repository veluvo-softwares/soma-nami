// Dose grammar for the handwriting spike. Strict on purpose: anything that does
// not parse exactly returns null ("not sure"). No OCR "repair" (I->1, l->1 ...):
// repairing is how wrong doses get spoken.
//
//   dose := [form] count [form] frequency [duration] [timing]
//   count     := 1 | 2 | 1/2 | ½
//   form      := tab | tabs | tablet(s) | cap | caps | capsule(s) | ml
//   frequency := od | bd | tds | qid | nocte | mane | x2..x4 | "mara" 2..4
//                ("1x3" is count 1 + frequency x3; "1 x 3" is the same)
//   duration  := "x" N "days" | N/7 | "x" N/7
//   timing    := after food
//
// A count is required: "tds" alone must not be spoken as a dose.

const FORM_WORDS = { tab: 'tab', tabs: 'tab', tablet: 'tab', tablets: 'tab', cap: 'cap', caps: 'cap', capsule: 'cap', capsules: 'cap', ml: 'ml' };
const FORM = '(tabs?|tablets?|caps?|capsules?|ml)';
const COUNT = '(1\\/2|½|1|2)';

/** Flatten a raw reading (string or list of lines) to plain lowercase text. */
export function normaliseReading(raw) {
  let s = Array.isArray(raw) ? raw.join(' ') : String(raw ?? '');
  s = s
    .replace(/\\text\s*\{([^}]*)\}/g, ' $1 ')
    .replace(/\\(quad|qquad|times|cdot)\b/g, (m, w) => (w === 'times' ? ' x ' : ' '))
    .replace(/[$\\]/g, ' ')
    .replace(/[×✕✖]/g, 'x')
    .replace(/[#*_`]/g, ' ')
    .toLowerCase()
    .replace(/[.,;:]+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

/**
 * Parse a reading into a canonical dose, or null.
 * Result: { count, form, freq, duration, food }.
 */
export function parseDose(raw) {
  const s = ` ${normaliseReading(raw)} `;
  if (/[^a-z0-9/½ ]/.test(s)) return null; // stray symbols: not a clean reading
  let rest = s.replace(/(\d)x/g, '$1 x').trim(); // "1x3" -> "1 x3"
  const take = (re) => {
    rest = rest.trimStart();
    const m = new RegExp(`^${re}(?=\\s|$)`).exec(rest);
    if (m) rest = rest.slice(m[0].length);
    return m;
  };
  const dose = { count: null, form: null, freq: null, duration: null, food: false };

  let m = take(FORM);
  if (m) dose.form = FORM_WORDS[m[1]];

  m = take(COUNT);
  if (!m) return null;
  dose.count = m[1] === '½' ? '1/2' : m[1];

  if (!dose.form) {
    m = take(FORM);
    if (m) dose.form = FORM_WORDS[m[1]];
  }

  m = take('(od|bd|tds|qid|nocte|mane)');
  if (m) dose.freq = m[1];
  else if ((m = take('mara ([2-4])'))) dose.freq = `x${m[1]}`;
  else if ((m = take('x ?([2-4])(?! ?days)(?!\\/)'))) dose.freq = `x${m[1]}`;
  if (!dose.freq) return null;

  if ((m = take('x ?(\\d{1,2}) ?days?'))) dose.duration = `${m[1]}d`;
  else if ((m = take('(?:x ?)?(\\d)\\/7'))) dose.duration = `${m[1]}/7`;

  if ((m = take('after food'))) dose.food = true;

  if (rest.trim() !== '') return null; // anything left over: not sure
  return dose;
}

/** Canonical one-line form, used for matching and for the report. */
export function doseKey(d) {
  if (!d) return null;
  return [d.form, d.count, d.freq, d.duration && `x ${d.duration}`, d.food && 'after food'].filter(Boolean).join(' ');
}

/**
 * Speak only if every reader parses and all agree exactly on the canonical
 * dose. Returns { speak: string|null, parsed: [key|null...] }.
 */
export function agree(readings) {
  const keys = readings.map((r) => doseKey(parseDose(r)));
  const speak = keys.every((k) => k && k === keys[0]) ? keys[0] : null;
  return { speak, parsed: keys };
}
