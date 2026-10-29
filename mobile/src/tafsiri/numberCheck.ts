/**
 * The number check for "Tafsiri kwa Kiswahili" (docs/scope.md section 6, rule 1).
 *
 * A translation is only shown if every number, unit and frequency in it is the
 * same as in the original line. Numbers also hide in words ("twice" is "mara
 * mbili", "half" is "nusu"), so both texts are reduced to the same plain
 * quantities first and the two are compared:
 *
 *   numbers      digits and number words in English and Swahili, fractions,
 *                month names; compared as a multiset (2 and 3 are different)
 *   frequencies  once / twice / N times / mara N; compared as a multiset
 *   units        mg, ml, hours, days, tablets, meal timing and so on;
 *                compared as a set
 *
 * Anything that differs, in either direction, means the translation is not
 * safe. The check errs on the side of refusing: a translation that merely
 * words things differently from what we know ("dawa" for "tablet") is refused
 * too. It does not check negation ("do not") or any other words; that is a
 * known gap, written up in docs/plan.md.
 *
 * First version: spike/numbers.mjs on branch spike/c2 (C2).
 */

export interface Diff {
  /** In the original but not in the translation. */
  missing: string[];
  /** In the translation but not in the original. */
  extra: string[];
}

export interface Quantities {
  numbers: string[];
  frequencies: string[];
  units: string[];
}

export interface CheckResult {
  safe: boolean;
  numbers: Diff;
  frequencies: Diff;
  units: Diff;
  /** Key terms (expiry, batch, manufactured) missing from or added to the translation. */
  terms: Diff;
}

// ---------------------------------------------------------------- vocabulary

const EN_UNITS: Record<number, string> = {
  1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
};
const EN_TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const EN_ONES: Record<string, number> = Object.fromEntries(Object.entries(EN_UNITS).map(([n, w]) => [w, Number(n)]));

/** Swahili 1-5 and 8 take a noun-class prefix: kimoja, viwili, wawili, mitatu, manne ... */
const SW_ONES: Record<string, number> = {
  moja: 1, mmoja: 1, kimoja: 1,
  mbili: 2, wawili: 2, viwili: 2, miwili: 2, mawili: 2,
  tatu: 3, watatu: 3, vitatu: 3, mitatu: 3, matatu: 3,
  nne: 4, wanne: 4, vinne: 4, minne: 4, manne: 4,
  tano: 5, watano: 5, vitano: 5, mitano: 5, matano: 5,
  sita: 6, saba: 7,
  nane: 8, wanane: 8, vinane: 8, minane: 8, mananane: 8,
  tisa: 9,
};
const SW_TEENS: Record<string, number> = { kumi: 10 };
const SW_TENS: Record<string, number> = {
  ishirini: 20, thelathini: 30, arobaini: 40, hamsini: 50, sitini: 60, sabini: 70, themanini: 80, tisini: 90,
};

const SW_MONTHS: Record<string, number> = {
  januari: 1, februari: 2, machi: 3, aprili: 4, mei: 5, juni: 6, julai: 7, agosti: 8,
  septemba: 9, oktoba: 10, novemba: 11, desemba: 12,
};
const EN_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};
const EN_MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

type Lang = 'en' | 'sw';

const alt = (words: Iterable<string>) => [...new Set(words)].sort((a, b) => b.length - a.length).join('|');

// -------------------------------------------------------------- normalising

const VULGAR: Record<string, string> = { '½': '.5', '¼': '.25', '¾': '.75' };
const SIMPLE_FRACTIONS: Record<string, string> = {
  '1/2': '0.5', '1/4': '0.25', '3/4': '0.75', '1/3': '1/3', '2/3': '2/3', '1/8': '0.125',
};

function canonicalNumber(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : raw;
}

/** Lower-case, one kind of times sign, plain decimals, fractions as decimals. */
function normalise(input: string): string {
  let s = input.toLowerCase().normalize('NFC');
  s = s.replace(/[\u00a0\u2009\u202f]/g, ' ');
  s = s.replace(/(\d)\s*([½¼¾])/g, (_m, d: string, f: string) => `${d}${VULGAR[f]}`);
  s = s.replace(/[½¼¾]/g, (f) => ` 0${VULGAR[f]} `);
  s = s.replace(/(\d)\s*[x×*]\s*(\d)/g, '$1×$2');
  // 1,000 -> 1000 and 12,5 -> 12.5
  s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
  s = s.replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
  // 1/2 tablet -> 0.5 tablet; 03/2028 stays as it is
  s = s.replace(/(^|[^\d/])(\d)\/(\d)(?![\d/])/g, (m, pre: string, a: string, b: string) => {
    const f = SIMPLE_FRACTIONS[`${a}/${b}`];
    return f ? `${pre}${f}` : m;
  });
  return s;
}

/** "kumi na mbili", "twenty-one", "twenty one" become digits; single words follow. */
function numberWordsToDigits(s: string, lang: Lang): string {
  const ones = lang === 'en' ? EN_ONES : SW_ONES;
  const teens = lang === 'en' ? EN_TEENS : SW_TEENS;
  const tens = lang === 'en' ? EN_TENS : SW_TENS;
  const oneRe = alt(Object.keys(ones));
  const tensRe = alt([...Object.keys(tens), ...(lang === 'sw' ? Object.keys(SW_TEENS) : [])]);
  const tensVal = (w: string) => tens[w] ?? teens[w] ?? 0;

  const join = lang === 'en' ? '(?:[\\s-]+)' : '\\s+na\\s+';
  s = s.replace(new RegExp(`\\b(${tensRe})${join}(${oneRe})\\b`, 'g'), (_m, t: string, o: string) =>
    String(tensVal(t) + ones[o]!),
  );
  const single = alt([...Object.keys(ones), ...Object.keys(teens), ...Object.keys(tens)]);
  s = s.replace(new RegExp(`\\b(${single})\\b`, 'g'), (_m, w: string) => String(ones[w] ?? teens[w] ?? tens[w]));
  return s;
}

// ----------------------------------------------------------------- units

/** Forms that name a thing being counted or measured; each maps to one unit. */
const UNIT_PATTERNS: [string, RegExp[]][] = [
  ['mg', [/\bmg\b/, /\bmili?gramm?u\b/, /\bmilligrams?\b/, /\bmilligrammes?\b/]],
  ['mcg', [/\bmcg\b/, /[µμ]g\b/, /\bug\b/, /\bmikrogramu\b/, /\bmicrograms?\b/]],
  ['g', [/\d\s*g\b/, /\bgramu\b/, /\bgrams?\b/, /\bgrammes?\b/]],
  ['ml', [/\bmls?\b/, /\bmililita\b/, /\bmillilit(?:re|er)s?\b/]],
  ['l', [/\d\s*l\b/, /\blita\b/, /\blit(?:re|er)s?\b/]],
  ['iu', [/\biu\b/, /\bunits?\b/, /\by?uniti\b/]],
  ['%', [/%/, /\basilimia\b/, /\bper ?cent\b/]],
  ['degree', [/°/, /\bdegrees?\b/, /\bdigrii\b/]],
  ['celsius', [/°\s*c\b/, /\bcelsius\b/, /\bselsiasi\b/]],
  ['fahrenheit', [/°\s*f\b/, /\bfahrenheit\b/, /\bfaren?haiti\b/]],
  ['hour', [/\bhou[rn]s?\b/, /\bhrs?\b/, /\bsaa\b/]],
  ['minute', [/\bminutes?\b/, /\bmins?\b/, /\bdakika\b/]],
  ['day', [/\bdays?\b/, /\bdaily\b/, /\bsiku\b/]],
  ['week', [/\bweeks?\b/, /\bwiki\b/, /\bjuma\b/]],
  ['month', [/\bmonths?\b/, /\bmwezi\b/, /\bmiezi\b/]],
  ['year', [/\byears?\b/, /\bmwaka\b/, /\bmiaka\b/]],
  ['tablet', [/\btablets?\b/, /\btabs?\b/, /\bkibao\b/, /\bvibao\b/]],
  // Swahili "kidonge" means a pill: a tablet or a capsule (see unitDiff)
  ['pill', [/\bkidonge\b/, /\bvidonge\b/]],
  ['capsule', [/\bcapsules?\b/, /\bcaps?\b/, /\bkapsuli\b/]],
  ['drop', [/\bdrops?\b/, /\btone\b/, /\bmatone\b/]],
  ['spoon', [/\bteaspoons?\b/, /\btablespoons?\b/, /\bspoonfuls?\b/, /\bkijiko\b/, /\bvijiko\b/]],
  ['sachet', [/\bsachets?\b/, /\bsacheti\b/]],
  // "Dosage:" is the dose heading (kipimo); OCR also reads "hours" as "houn" above.
  ['dose', [/\bdos(?:e|es|age)\b/, /\bdozi\b/, /\bkipimo\b/, /\bvipimo\b/]],
  ['puff', [/\bpuffs?\b/, /\bpafu\b/]],
  ['patch', [/\bpatch(?:es)?\b/, /\bplasta\b/]],
  // when in the day
  ['morning', [/\bmorning\b/, /\basubuhi\b/]],
  ['afternoon', [/\bafternoon\b/, /\bmchana\b/]],
  ['evening', [/\bevening\b/, /\bjioni\b/]],
  ['night', [/\bnight\b/, /\busiku\b/, /\btonight\b/]],
];

const MEAL_WORDS_EN = '(?:meals?|food|eating|breakfast|lunch|dinner|supper)';
const MEAL_WORDS_SW = '(?:chakula|kula|kiamsha kinywa|kifungua kinywa|mlo|milo)';

/** Relative to meals: swapping before and after is as bad as swapping a number. */
function mealUnits(s: string, lang: Lang): string[] {
  const out: string[] = [];
  if (lang === 'en') {
    for (const m of s.matchAll(new RegExp(`\\b(before|after|with)\\s+(?:a\\s+|your\\s+|the\\s+)?${MEAL_WORDS_EN}\\b`, 'g'))) {
      out.push(`meal:${m[1]}`);
    }
  } else {
    for (const m of s.matchAll(new RegExp(`\\b(kabla|baada)\\s+ya\\s+${MEAL_WORDS_SW}`, 'g'))) {
      out.push(`meal:${m[1] === 'kabla' ? 'before' : 'after'}`);
    }
    if (new RegExp(`\\bpamoja\\s+na\\s+${MEAL_WORDS_SW}`).test(s)) out.push('meal:with');
  }
  return out;
}

function unitsOf(s: string, lang: Lang): string[] {
  const found = new Set<string>();
  for (const [unit, patterns] of UNIT_PATTERNS) {
    if (patterns.some((re) => re.test(s))) found.add(unit);
  }
  for (const m of mealUnits(s, lang)) found.add(m);
  return [...found];
}

// ------------------------------------------------------------ frequencies

const EN_COUNT_WORD = alt(Object.keys(EN_ONES));
const SW_COUNT_WORD = alt([...Object.keys(SW_ONES), ...Object.keys(SW_TEENS)]);

/**
 * Takes the frequency expressions out of the text ("twice", "3 times", "mara
 * tatu") and returns them as counts, plus the text without them so their
 * number words are not counted again as plain numbers.
 */
function takeFrequencies(s: string, lang: Lang): { rest: string; frequencies: string[] } {
  const freqs: string[] = [];
  let rest = s;
  const take = (re: RegExp, value: (word: string) => string) => {
    rest = rest.replace(re, (_m: string, word?: string) => {
      freqs.push(value(word ?? ''));
      return ' ';
    });
  };
  if (lang === 'en') {
    take(/\bonce\b(?!\s+(?:opened|open|mixed|reconstituted|the|you|it|your|a)\b)/g, () => 'x1');
    take(/\btwice\b/g, () => 'x2');
    take(/\bthrice\b/g, () => 'x3');
    take(new RegExp(`\\b(\\d+|${EN_COUNT_WORD})\\s+times\\b`, 'g'), (w) => `x${EN_ONES[w] ?? canonicalNumber(w)}`);
  } else {
    take(new RegExp(`\\bmara\\s+(\\d+|${SW_COUNT_WORD})\\b`, 'g'), (w) => `x${SW_ONES[w] ?? SW_TEENS[w] ?? canonicalNumber(w)}`);
  }
  // "daily" / "kila siku" on its own means once a day. Left out when a count
  // is given ("twice daily"), and "3 tablets a day" is a daily limit, not a frequency.
  if (freqs.length === 0) {
    const daily = lang === 'en' ? /\b(?:daily|every day|each day|everyday)\b/ : /\bkila siku\b/;
    if (daily.test(rest)) freqs.push('x1');
  }
  return { rest, frequencies: freqs.sort() };
}

// ---------------------------------------------------------------- numbers

function monthsOf(s: string, lang: Lang): { rest: string; months: string[] } {
  const months: string[] = [];
  const table = lang === 'en' ? { ...EN_MONTHS } : { ...SW_MONTHS };
  const abbr = lang === 'en' ? EN_MONTH_ABBR : {};
  // "may" is also a verb, and "mar", "dec" etc. also words: only take them next to a year
  const withYear = new RegExp(`\\b(${alt([...Object.keys(table), ...Object.keys(abbr)])})\\.?,?\\s+(?=(?:20)?\\d\\d\\b)`, 'g');
  const standalone = new RegExp(
    `\\b(${alt(Object.keys(table).filter((m) => !(lang === 'en' && m === 'may')))})\\b`,
    'g',
  );
  let rest = s.replace(withYear, (_m, name: string) => {
    months.push(`month${table[name] ?? abbr[name as keyof typeof abbr]}`);
    return ' ';
  });
  rest = rest.replace(standalone, (_m, name: string) => {
    months.push(`month${table[name]}`);
    return ' ';
  });
  return { rest, months };
}

function numbersOf(s: string, lang: Lang): { numbers: string[]; frequencies: string[] } {
  const withMonths = monthsOf(s, lang);
  const { rest: noFreq, frequencies } = takeFrequencies(withMonths.rest, lang);
  let t = noFreq;
  // "a tablet" is one tablet, but "half a tablet" is half
  if (lang === 'en') {
    t = t.replace(/\b(half|quarter)\s+(?:of\s+)?(?:a|an)\s+/g, '$1 ');
    t = t.replace(/\b(?:a|an)\s+(?=(?:tablet|capsule|teaspoon|tablespoon|spoonful|sachet|drop|dose|puff|patch)s?\b)/g, '1 ');
  }
  t = numberWordsToDigits(t, lang);
  // "2 and a half", "kimoja na nusu"
  const andHalf = lang === 'en' ? /(\d+(?:\.\d+)?)\s+and\s+(?:a\s+)?half\b/g : /(\d+(?:\.\d+)?)\s+na\s+nusu\b/g;
  t = t.replace(andHalf, (_m, n: string) => String(Number(n) + 0.5));
  const half = lang === 'en' ? /\bhalf\b/g : /\bnusu\b/g;
  const quarter = lang === 'en' ? /\bquarter\b/g : /\brobo\b/g;
  const numbers: string[] = [...withMonths.months];
  t = t.replace(half, () => {
    numbers.push('0.5');
    return ' ';
  });
  t = t.replace(quarter, () => {
    numbers.push('0.25');
    return ' ';
  });
  for (const m of t.matchAll(/\d+(?:\.\d+)?(?:×\d+(?:\.\d+)?)*|\b\d\/\d\b/g)) {
    numbers.push(m[0].includes('×') ? m[0].split('×').map(canonicalNumber).join('×') : canonicalNumber(m[0]));
  }
  return { numbers: numbers.sort(), frequencies };
}

/** Everything the check compares, taken out of one text. */
export function quantities(text: string, lang: Lang): Quantities {
  const s = normalise(text);
  const { numbers, frequencies } = numbersOf(s, lang);
  // Units are read from the normalised text, so "twice daily" still shows its "daily".
  return { numbers, frequencies, units: unitsOf(s, lang).sort() };
}

// ------------------------------------------------------------- comparing

function multisetDiff(original: readonly string[], translated: readonly string[]): Diff {
  const counts = new Map<string, number>();
  for (const x of original) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const x of translated) counts.set(x, (counts.get(x) ?? 0) - 1);
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [k, v] of counts) {
    for (let i = 0; i < v; i++) missing.push(k);
    for (let i = 0; i < -v; i++) extra.push(k);
  }
  return { missing, extra };
}

function setDiff(original: readonly string[], translated: readonly string[]): Diff {
  const a = new Set(original);
  const b = new Set(translated);
  return { missing: [...a].filter((x) => !b.has(x)), extra: [...b].filter((x) => !a.has(x)) };
}

/**
 * Units compared as sets, except that Swahili "kidonge" (a pill) stands for
 * either an English tablet or capsule. "kapsuli" and "kibao" stay specific, so
 * tablet to capsule is still refused.
 */
function unitDiff(original: readonly string[], translated: readonly string[]): Diff {
  const d = setDiff(original, translated);
  if (translated.includes('pill')) {
    d.missing = d.missing.filter((u) => u !== 'tablet' && u !== 'capsule');
    d.extra = d.extra.filter((u) => u !== 'pill');
  }
  return d;
}

const same = (d: Diff) => d.missing.length === 0 && d.extra.length === 0;

/**
 * Key label terms that must come through with the right meaning. A term in
 * the original needs one of its Swahili words in the translation, and the
 * translation may not carry the Swahili word without the English term. The
 * model once wrote "mafunzo" (training) for batch and "maelezo ya mwisho"
 * (final notes) for expiry; the numbers matched, so nothing flagged it.
 * Cheap on purpose: only terms where a wrong meaning is dangerous.
 */
const KEY_TERMS: [string, RegExp, RegExp][] = [
  ['expiry', /\b(?:exp(?![a-z])|expiry|expires|expiration|use by|use before|best before|valid (?:until|till))/, /\b(?:inaisha|inakwisha|kumalizika|kwisha|muda wa (?:matumizi|kuisha|kumalizika)|kuisha muda|mwisho wa matumizi|tarehe ya (?:kuisha|mwisho wa matumizi)|tumia kabla)/],
  ['batch', /\b(?:batch|lot)\b/, /\b(?:kundi|bechi|betchi|batch)\b/],
  ['manufactured', /\b(?:mfg|mfd|manufactured|manufacture)\b/, /\b(?:imetengenezwa|kutengenezwa|utengenezaji)\b/],
];

function termDiff(original: string, translation: string): Diff {
  const o = original.toLowerCase();
  const t = translation.toLowerCase();
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [name, en, sw] of KEY_TERMS) {
    const inEn = en.test(o);
    const inSw = sw.test(t);
    if (inEn && !inSw) missing.push(name);
    if (!inEn && inSw) extra.push(name);
  }
  return { missing, extra };
}

/**
 * Compares an English original with its Swahili translation. `safe` is true
 * only when no number, frequency or unit differs.
 */
export function checkTranslation(original: string, translation: string): CheckResult {
  const a = quantities(original, 'en');
  const b = quantities(translation, 'sw');
  const numbers = multisetDiff(a.numbers, b.numbers);
  const frequencies = multisetDiff(a.frequencies, b.frequencies);
  const units = unitDiff(a.units, b.units);
  const terms = termDiff(original, translation);
  return { safe: same(numbers) && same(frequencies) && same(units) && same(terms), numbers, frequencies, units, terms };
}
