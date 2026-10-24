// Number and unit guard for "tafsiri" (translation). Shared by the spike and,
// later, the app. The rule (docs/scope.md section 6): every number in a
// translation must match the original. If any differs, the app shows the
// original and says the translation is not safe.
//
// Extracts numeric tokens as canonical strings so "1x3", "1 × 3" and "1×3"
// compare equal, and "1,000" == "1000". Word-numbers are not converted: if a
// translation turns "twice" into "mara mbili" that is fine, but if it turns
// "5 mg" into "mg tano" the digit 5 is missing and the check fails, which is
// the safe direction.

const UNIT_WORDS = {
  mg: ['mg', 'miligramu', 'milligram', 'milligrams'],
  ml: ['ml', 'mililita', 'millilitre', 'milliliter', 'millilitres', 'milliliters'],
  g: ['g', 'gramu', 'gram', 'grams'],
  mcg: ['mcg', 'µg', 'ug', 'mikrogramu', 'microgram', 'micrograms'],
  iu: ['iu', 'units', 'vipimo'],
  '%': ['%', 'asilimia', 'percent'],
};

export function extractNumbers(text) {
  const s = text
    .replace(/(\d)\s*[x×X*]\s*(\d)/g, '$1×$2')
    .replace(/(\d),(\d{3})\b/g, '$1$2');
  const out = [];
  const re = /\d+(?:[.,]\d+)?(?:×\d+(?:[.,]\d+)?)*/g;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[0].replace(',', '.'));
  return out.sort();
}

export function extractUnits(text) {
  const t = ` ${text.toLowerCase()} `;
  const found = [];
  for (const [unit, words] of Object.entries(UNIT_WORDS)) {
    for (const w of words) {
      const esc = w.replace(/[.*+?^${}()|[\]\\%]/g, '\\$&');
      const re = unit === '%' ? new RegExp(esc) : new RegExp(`(\\d|\\b)${esc}\\b`);
      if (re.test(t)) {
        found.push(unit);
        break;
      }
    }
  }
  return found.sort();
}

function multisetDiff(a, b) {
  const counts = new Map();
  for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const x of b) counts.set(x, (counts.get(x) ?? 0) - 1);
  const missing = [];
  const extra = [];
  for (const [k, v] of counts) {
    for (let i = 0; i < v; i++) missing.push(k);
    for (let i = 0; i < -v; i++) extra.push(k);
  }
  return { missing, extra };
}

// Frequency words carry numbers without digits ("twice daily"). Map both
// languages to a count so "twice" -> "mara tatu" is caught.
const EN_FREQ = [
  [/\bonce\b/g, '1'],
  [/\btwice\b/g, '2'],
  [/\bthrice\b/g, '3'],
  [/\b(one|two|three|four|five|six) times\b/g, null],
  [/\bhalf\b/g, '0.5'],
];
const EN_WORDS = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6' };
const SW_WORDS = { moja: '1', mbili: '2', tatu: '3', nne: '4', tano: '5', sita: '6' };

export function extractFrequencies(text) {
  const t = text.toLowerCase();
  const out = [];
  for (const [re, val] of EN_FREQ) {
    for (const m of t.matchAll(re)) out.push(val ?? EN_WORDS[m[1]]);
  }
  for (const m of t.matchAll(/\bmara\s+(moja|mbili|tatu|nne|tano|sita)\b/g)) out.push(SW_WORDS[m[1]]);
  for (const m of t.matchAll(/\bmara\s+(\d+)\b/g)) out.push(m[1]);
  if (/\bnusu\b/.test(t)) out.push('0.5');
  return out.sort();
}

// Returns { safe, numbers, units, frequencies }, each {missing, extra}.
// A frequency mismatch only fails the check when the source has a frequency
// word: the translation may legitimately add "mara" phrasing around digits.
export function checkTranslation(source, translation) {
  const numbers = multisetDiff(extractNumbers(source), extractNumbers(translation));
  const units = multisetDiff(extractUnits(source), extractUnits(translation));
  const srcFreq = extractFrequencies(source);
  const frequencies = srcFreq.length
    ? multisetDiff(srcFreq, extractFrequencies(translation))
    : { missing: [], extra: [] };
  const safe = [numbers, units, frequencies].every(
    (d) => d.missing.length === 0 && d.extra.length === 0,
  );
  return { safe, numbers, units, frequencies };
}
